import { Router } from 'express'; 
import { TicketController } from '../controllers/TicketController';

const router = Router(); 
const ticketController = new TicketController(); 

/**
 * Wrapper de sécurité pour les fonctions asynchrones (async/await) Express.
 * Node/Express 4 ne gère pas nativement les erreurs des promesses dans les routes.
 * Ce Wrapper force un `.catch(next)` pour envoyer l'erreur au middleware d'erreur global de app.ts.
 * @param fn Fonction de rappel (Contrôleur)
 */
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => { 
  Promise.resolve(fn(req, res, next)).catch(next);
}; 

//  DÉFINITION DES ROUTES 

// Route Admin : Liste tous les billets de la base
router.get('/admin', asyncHandler((req: any, res: any) => ticketController.listAllTickets(req, res)));

router.post('/buy', asyncHandler((req: any, res: any) => ticketController.purchase(req, res)));

router.post('/purchase', asyncHandler((req: any, res: any) => ticketController.purchase(req, res)));

router.get('/', asyncHandler((req: any, res: any) => ticketController.listUserTickets(req, res)));

router.get('/:id', asyncHandler((req: any, res: any) => ticketController.getTicketDetails(req, res)));

router.patch('/:id/cancel', asyncHandler((req: any, res: any) => ticketController.cancel(req, res)));

export default router;
