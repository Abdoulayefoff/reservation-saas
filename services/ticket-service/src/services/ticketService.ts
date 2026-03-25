import axios, { AxiosError } from 'axios';
import { PrismaClient, TicketStatus, PaymentStatus } from '@prisma/client';
import { RabbitMQService } from './rabbitMqService';

const prisma = new PrismaClient(); 
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || 'http://event-service:8003'; 
const USER_SERVICE_URL  = process.env.USER_SERVICE_URL  || 'http://user-service:8002';

/**
 * Génère un numéro de billet unique au format standard : TKT-AANN-XXXXX
 * (Exemple: TKT-2026-A1B2C)
 */
function generateTicketNumber(): string { 
  const year   = new Date().getFullYear(); 
  // Génère 5 caractères aléatoires alphanumériques en majuscules
  const suffix = Math.random().toString(36).substring(2, 7).toUpperCase(); 
  return `TKT-${year}-${suffix}`; // Concatène le tout
} 

/**
 * Récupère l'email d'un utilisateur auprès du User Service (Mode Dégradation Gracieuse).
 * Si le service User plante, retourne null plutôt que de faire crasher l'achat.
 */
async function getUserEmail(userId: string): Promise<string | null> { 
  try {
    const res = await axios.get(`${USER_SERVICE_URL}/users/${userId}`, { 
      timeout: 3000, 
      headers: {
        'X-User-Id':    userId,
        'X-User-Roles': 'ROLE_ADMIN', 
      },
    });
    
    // Extraction selon la structure de réponse du User Service
    return res.data?.email ?? res.data?.profile?.email ?? null; 
  } catch { 
    return null;
  } 
} 

export class TicketService { 

  /**
   * FLUX DE TRAVAIL PRINCIPAL : ACHETER UN BILLET
   * @param eventId ID de l'évènement
   * @param userId ID de l'acheteur
   * @param quantity Nombre de billets
   * @param userEmail Email transmis par la Gateway (Optionnel)
   * @param cardLast4 4 derniers chiffres CB (Simulé)
   */
  public async purchaseTicket( 
    eventId: string,
    userId: string,
    quantity: number,
    userEmail: string | null,
    cardLast4: string | null = null,
  ): Promise<any> {

    //  ÉTAPE 1 : Vérifier la disponibilité de l'évènement
    let eventDetails: any; // Structure de stockage
    try { 
      const response = await axios.get(`${EVENT_SERVICE_URL}/events/${eventId}`); 
      eventDetails = response.data; 
    } catch (error) { 
      if (error instanceof AxiosError && error.response?.status === 404) { 
        throw new Error('Event not found.'); 
      } 
      throw new Error('Failed to communicate with Event Service.');
    } 

    // Vérifie le stock restant 
    if ((eventDetails.availableSeats ?? eventDetails.availablePlaces ?? 0) < quantity) { 
      throw new Error('Not enough places available.');
    } 

    // Calcul financier du montant total
    const pricePerTicket = parseFloat(eventDetails.price ?? eventDetails.price);
    const totalAmount    = pricePerTicket * quantity; 

    // Dénormalisation des données de l'évènement (Instantané au moment de l'achat)
    // Recommandé pour l'historique des billets (Même si l'évènement change de nom plus tard)
    const eventTitle = eventDetails.title ?? ''; 
    const eventDate  = new Date(eventDetails.eventDate ?? eventDetails.date);
    const venue      = eventDetails.venue ?? eventDetails.location ?? '';

    // ── ÉTAPE 2 : Simuler le paiement bancaire (90% de succès) 
    const paymentSuccess = await this.simulatePayment(totalAmount, cardLast4);
    if (!paymentSuccess) {
      throw new Error('Payment failed due to insufficient funds or bank rejection.'); 
    } 

    // ÉTAPE 3 : Réserver Atométriquement les places dans Event Service 
    try { 
      await axios.patch(`${EVENT_SERVICE_URL}/events/${eventId}/reserve`, { quantity }); 
    } catch (error) { 
      if (error instanceof AxiosError && error.response?.status === 400) { 
        throw new Error('Places unfortunately sold out during payment process. Refund issued.');
      }
      throw new Error('Failed to reserve places reliably.');
    } 

    // ÉTAPE 4 : Résoudre l'Email de l'utilisateur si non fourni
    const resolvedEmail = userEmail ?? await getUserEmail(userId);

    // ÉTAPE 5 : Création physique des Billets et Logs de Paiement
    const transactionId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tickets       = []; 

    // Boucle de création pour x quantité
    for (let i = 0; i < quantity; i++) { 
      const ticketNumber = generateTicketNumber();

      // Insertion Prisma
      const ticket = await prisma.ticket.create({ 
        data: {
          ticketNumber,
          eventId,
          userId,
          eventTitle,
          eventDate, 
          venue, 
          pricePaid:     pricePerTicket, 
          paymentMethod: 'CARD',
          paymentStatus: PaymentStatus.COMPLETED,
          status:        TicketStatus.ACTIVE,
          transactionId,
        },
      }); 

      // Création du Log de Paiement (Traçabilité)
      await prisma.paymentLog.create({ 
        data: {
          ticketId:  ticket.id, 
          userId, 
          amount:    pricePerTicket, 
          status:    'SUCCESS', 
          cardLast4: cardLast4 ?? '4242', 
        },
      });

      tickets.push(ticket); 

      // ── ÉTAPE 6 : Publier l'évènement dans RabbitMQ pour notification 
      // Communication asynchrone pour l'envoi de mail de confirmation
      await RabbitMQService.getInstance().publishMessage('ticket_events', 'ticket.confirmed', {
        ticketId:     ticket.id,
        ticketNumber: ticket.ticketNumber,
        userId:       ticket.userId,
        userEmail:    resolvedEmail, // Transmet l'email résolu pour le Mailer
        eventId:      ticket.eventId,
        eventName:    ticket.eventTitle,
        eventDate:    ticket.eventDate.toISOString(),
        venue:        ticket.venue,
        amountPaid:   Number(ticket.pricePaid),
        purchasedAt:  ticket.purchaseDate.toISOString(),
      }); 
    } 

    return tickets; 
  }

  /**
   * Récupère tous les billets d'un utilisateur donné.
   */
  public async getUserTickets(userId: string) { 
    return prisma.ticket.findMany({ 
      where:   { userId }, 
      orderBy: { purchaseDate: 'desc' }, 
    }); 
  }

  /**
   * Récupère TOUS les billets du système avec Pagination (Admin).
   */
  public async getAllTickets(page = 1, limit = 20) { 
    const skip  = (page - 1) * limit; 
    const total = await prisma.ticket.count(); 
    const data  = await prisma.ticket.findMany({ 
      skip, 
      take:    limit,
      orderBy: { purchaseDate: 'desc' },
    }); 
    
    // Retourne un dictionnaire consolidé de pagination
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) }; 
  } 

  /**
   * Récupère un billet spécifique avec vérification des droits.
   */
  public async getTicket(ticketId: string, userId: string, roles: string[]) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } }); 
    if (!ticket) throw new Error('Ticket not found.');

    // Vérifie si l'utilisateur est le PROPRIÉTAIRE ou un ADMINISTRATEUR
    if (ticket.userId !== userId && !roles.includes('ROLE_ADMIN')) { 
      throw new Error('Unauthorized.'); 
    } 
    return ticket; 
  } 

  /**
   * Annule un billet (Seuls les billets ACTIVE peuvent l'être).
   */
  public async cancelTicket(ticketId: string, userId: string, roles: string[]) {
    const ticket = await this.getTicket(ticketId, userId, roles); 

    if (ticket.status !== TicketStatus.ACTIVE) {
      throw new Error('Only active tickets can be cancelled.'); // Bloque
    } // Fin test statut

    //  ÉTAPE 1 : Libérer la place dans le Event Service 
    try { 
      await axios.patch(`${EVENT_SERVICE_URL}/events/${ticket.eventId}/release`, { quantity: 1 }); 
    } catch (error) { 
      // Log l'erreur mais poursuit l'annulation pour ne pas bloquer l'utilisateur de force
      console.error('Failed to release seat in Event Service, proceeding anyway', error); 
    }

    // ÉTAPE 2 : Créer un Log de Paiement pour Remboursement 
    await prisma.paymentLog.create({ // SQL INSERT
      data: {
        ticketId: ticket.id,
        userId,
        amount:   ticket.pricePaid, 
        status:   'FAILURE',
        cardLast4: null,
      },
    });

    // ÉTAPE 3 : Mettre à jour le statut du Billet 
    return prisma.ticket.update({ 
      where: { id: ticketId }, 
      data:  { status: TicketStatus.CANCELLED },
    }); 
  } 

  /**
   * SIMULATION DU PAIEMENT BANCAIRE (1 seconde d'attente). 
   * @param amount Montant à débiter
   * @param cardLast4 4 derniers chiffres (pour tests)
   */
  private async simulatePayment(amount: number, cardLast4: string | null = null): Promise<boolean> { 
    return new Promise((resolve) => { 
      setTimeout(() => { 
        // Conventions de test inspirées de Stripe
        if (cardLast4 === '4242') { resolve(true); return; } // Succès forcé (Stripe standard)
        if (cardLast4 === '0002') { resolve(false); return; } // Échec forcé (Stripe standard)
        resolve(Math.random() < 0.90); // 90% de chance de succès par défaut
      }, 1000); 
    }); 
  } 
}
