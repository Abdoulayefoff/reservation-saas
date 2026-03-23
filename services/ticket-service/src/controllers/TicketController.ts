import { Request, Response } from 'express'; 
import { TicketService } from '../services/ticketService'; 
const ticketService = new TicketService(); 

export class TicketController { 

  /**
   * POST /tickets/buy (Spécification standard de l'endpoint)
   * POST /tickets/purchase (Alias historique – Conservé pour rétrocompatibilité)
   * ACHETER UN BILLET
   */
  public async purchase(req: Request, res: Response): Promise<void> { 
    // Récupération des En-têtes injectés par l'API Gateway
    const userId      = req.headers['x-user-id'] as string; // Identifiant unique de l'utilisateur
    const userEmail   = req.headers['x-user-email'] as string | undefined ?? null; 
    const rolesHeader = req.headers['x-user-roles'] as string || ''; 
    const roles       = rolesHeader.split(','); // Éclate les rôles en tableau JavaScript

    if (!userId) { 
      res.status(401).json({ error: 'Unauthorized' }); 
      return; 
    } 

    const { eventId, quantity, cardNumber } = req.body;

    // Validation des champs obligatoires
    if (!eventId || !quantity || quantity < 1) { 
      res.status(400).json({ error: 'Missing or invalid fields. Require eventId and quantity.' }); 
      return; 
    }

    // Anonymisation basique du numéro de carte bancaire (Garde uniquement les 4 derniers chiffres)
    const cardLast4 = cardNumber ? String(cardNumber).replace(/\s/g, '').slice(-4) : null; 

    try { 
      // Appel du service pour enregistrer l'achat et décrémenter les places
      const tickets = await ticketService.purchaseTicket(eventId, userId, quantity, userEmail, cardLast4); 
      res.status(201).json({ message: 'Ticket purchased successfully', tickets }); 
    } catch (error: any) { 
      res.status(400).json({ error: error.message }); 
    } 
  } 

  /**
   * GET /tickets – Liste les billets de l'utilisateur connecté
   */
  public async listUserTickets(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string; 
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    } 
    try { 
      // Récupère la liste via le service
      const tickets = await ticketService.getUserTickets(userId); 
      res.status(200).json(tickets); 
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    } 
  } 

  /**
   * GET /admin/tickets — Liste TOUS les billets du système (Admin uniquement)
   */
  public async listAllTickets(req: Request, res: Response): Promise<void> { 
    const rolesHeader = req.headers['x-user-roles'] as string || ''; 
    const roles       = rolesHeader.split(','); 

    // Contrôle d'accès strict : Seul l'administrateur passe
    if (!roles.includes('ROLE_ADMIN')) { 
      res.status(403).json({ error: 'Forbidden — Admin only' }); 
      return;
    }

    // Gestion de la pagination via les Query parameters (Casting en entier)
    const page  = parseInt(req.query.page as string ?? '1', 10); // Page 1 par défaut
    const limit = parseInt(req.query.limit as string ?? '20', 10); // 20 par défaut

    try { 
      // Demande l'index global au service
      const result = await ticketService.getAllTickets(page, limit); 
      res.status(200).json(result); 
    } catch (error: any) { 
      res.status(500).json({ error: error.message }); 
    } 
  } 

  /**
   * GET /tickets/:id – Détails d'un billet spécifique
   */
  public async getTicketDetails(req: Request, res: Response): Promise<void> { 
    const userId      = req.headers['x-user-id'] as string; 
    const rolesHeader = req.headers['x-user-roles'] as string || ''; 
    const roles       = rolesHeader.split(',');
    const { id }      = req.params; 

    if (!userId) { 
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try { 
      // Demande au service d'obtenir le billet, en vérifiant si l'utilisateur est légitime (Owner/Admin)
      const ticket = await ticketService.getTicket(id, userId, roles); 
      res.status(200).json(ticket); 
    } catch (error: any) { 
      if (error.message === 'Ticket not found.') { 
        res.status(404).json({ error: error.message }); 
      } else if (error.message === 'Unauthorized.') { 
        res.status(403).json({ error: error.message });
      } else { 
        res.status(500).json({ error: error.message }); 
      } 
    } 
  }

  /**
   * POST/PUT /tickets/:id/cancel – Annulation d'un billet
   */
  public async cancel(req: Request, res: Response): Promise<void> { 
    const userId      = req.headers['x-user-id'] as string; 
    const rolesHeader = req.headers['x-user-roles'] as string || ''; 
    const roles       = rolesHeader.split(',');
    const { id }      = req.params; 

    if (!userId) { 
      res.status(401).json({ error: 'Unauthorized' });
      return;
    } 
    try { 
      // Lance la procédure d'annulation (Remboursement, Incrémentation stock Évènement) dans le service
      const ticket = await ticketService.cancelTicket(id, userId, roles); 
      res.status(200).json({ message: 'Ticket cancelled successfully', ticket }); 
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  } 
}
