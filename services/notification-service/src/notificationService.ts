import axios from 'axios';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL ?? 'http://user-service:8002';

// INTERFACE DU MESSAGE RABBITMQ
export interface TicketConfirmedMessage {
  ticketId:     string; 
  ticketNumber: string;
  userId:       string; 
  userEmail?:   string | null;
  eventId:      string; 
  eventName?:   string;
  eventDate?:   string;
  venue?:       string;
  amountPaid?:  number;
  purchasedAt:  string;
  
  // Champs historiques conservés pour rétrocompatibilité
  pricePaid?:   number; 
  eventTitle?:  string; 
  purchaseDate?: string; 
  quantity?:    number; 
} 

/**
 * Récupère le nom et l'email d'un utilisateur depuis le User Service.
 * @param userId ID recherché
 * @returns Objet avec email et firstName (ou null si impossible)
 */
export async function getUserInfo(
  userId: string
): Promise<{ email: string; firstName?: string } | null> {
  try { 
    const response = await axios.get(`${USER_SERVICE_URL}/users/${userId}`, { 
      timeout: 3000,
      headers: {
        'X-Internal-Service': 'notification-service',
        'X-User-Roles':       'ROLE_ADMIN',
        'X-User-Id':          userId,
      },
    });
    return {
      email:     response.data?.email ?? response.data?.profile?.email ?? null,
      firstName: response.data?.firstName ?? response.data?.profile?.first_name ?? null,
    };
  } catch {
    console.warn(`[Notification] ⚠️  User Service injoignable pour userId=${userId}. Mode dégradé.`);
    return null;
  } 
}

/**
 * Traite la réception d'une confirmation de billet (Simule un envoi de Mail).
 * Formate un reçu élégant dans la console de sortie.
 * @param data Contenu du message débloqué
 */
export async function processTicketConfirmed(
  data: TicketConfirmedMessage
): Promise<void> {
  let recipient: string;
  let firstName = 'Client'; 

  // ÉTAPE 1 : Résolution du destinataire (Email) & Prénom
  if (data.userEmail) { // Si l'email était déjà dans le message RabbitMQ
    recipient = data.userEmail; 
    const userInfo = await getUserInfo(data.userId);
    if (userInfo?.firstName) firstName = userInfo.firstName;
  } else { // Si RabbitMQ ne contenait pas l'email
    const userInfo = await getUserInfo(data.userId);
    recipient  = userInfo?.email     ?? `userId:${data.userId}`;
    firstName  = userInfo?.firstName ?? 'Client'; 
  }

  // ÉTAPE 2 : Préparation des variables d'affichage
  const ticketNumber = data.ticketNumber ?? data.ticketId?.substring(0, 8); // Numéro court si absent
  const eventName    = data.eventName    ?? data.eventTitle ?? data.eventId; // Titre ou ID
  
  // Formatage de la date à la Française (Ex: lundi 10 mars 2026 à 20:00)
  const eventDate    = data.eventDate
    ? new Date(data.eventDate).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    : 'Non précisée';

  const venue        = data.venue ?? 'Non précisé';
  const amount       = data.amountPaid ?? data.pricePaid;
  
  // Date d'achat formatée
  const purchaseDate = new Date(data.purchasedAt ?? data.purchaseDate ?? Date.now())
    .toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  // ÉTAPE 3 : "Envoi" de la notification 
  console.log('');
  console.log('--------------------------------------------------------------------------');
  console.log(`[NOTIFICATION] 📩 Confirmation d'achat — Billet ${ticketNumber} -> ${recipient}`);
  console.log(`[NOTIFICATION]`);
  console.log(`[NOTIFICATION]   Bonjour ${firstName},`);
  console.log(`[NOTIFICATION]`);
  console.log(`[NOTIFICATION]   Votre réservation a bien été confirmée.`);
  console.log(`[NOTIFICATION]   --------------------------------------------`);
  console.log(`[NOTIFICATION]   │  N° Billet   : ${ticketNumber}`);
  console.log(`[NOTIFICATION]   │  Événement   : ${eventName}`);
  console.log(`[NOTIFICATION]   │  Date        : ${eventDate}`);
  console.log(`[NOTIFICATION]   │  Lieu        : ${venue}`);
  if (amount !== undefined) {
    console.log(`[NOTIFICATION]   │  Montant payé: ${Number(amount).toFixed(2)} €`);
  }
  if (data.quantity !== undefined && data.quantity > 1) { // Optionnel
    console.log(`[NOTIFICATION]   │  Quantité    : ${data.quantity} billet(s)`);
  }
  console.log(`[NOTIFICATION]   │  Acheté le   : ${purchaseDate}`);
  console.log(`[NOTIFICATION]   --------------------------------------------------`);
  console.log(`[NOTIFICATION]`);
  console.log(`[NOTIFICATION]   Merci de votre confiance. À bientôt !`);
  console.log('-----------------------------------------------------------------------------');
  console.log('');
}
