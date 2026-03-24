import 'dotenv/config';
import * as amqp from 'amqplib'; 
import express, { Request, Response } from 'express'; 
import { processTicketConfirmed, TicketConfirmedMessage } from './notificationService'; 

const PORT         = parseInt(process.env.PORT        ?? '8005', 10);
const RABBITMQ_URL = process.env.RABBITMQ_URL         ?? 'amqp://guest:guest@rabbitmq:5672/';
const QUEUE_NAME    = 'ticket.confirmed';
const EXCHANGE_NAME = 'ticket_events';
const ROUTING_KEY   = 'ticket.confirmed';
const MAX_RETRIES  = 30;
const RETRY_DELAY_MS = 2000;

// PARTIE 1 : Serveur HTTP minimal pour le Healthcheck (Supervision Docker)

// Indicateur d'état pour savoir si le consommateur est branché au Bus
export let isConsumerReady = false; 

const httpApp = express();

/**
 * Route /health d'auto-surveillance.
 * Permet à Docker de savoir si le conteneur est opérationnel (Ready).
 */
httpApp.get('/health', (_req: Request, res: Response) => {
  const status     = isConsumerReady ? 'ok' : 'starting';
  const httpStatus = isConsumerReady ? 200 : 503;

  res.status(httpStatus).json({
    status,
    service: 'notification-service',
    consumer: isConsumerReady ? 'connected' : 'connecting',
    queue: QUEUE_NAME,
    timestamp: new Date().toISOString(),
  });
});

export { httpApp };

// Démarrer le serveur uniquement si on n'est pas en mode TEST
if (process.env.NODE_ENV !== 'test') {
  httpApp.listen(PORT, () => { 
    console.log(`[Notification] Serveur HTTP démarré sur le port ${PORT}`);
  });
}

// PARTIE 2 : Consommateur RabbitMQ (Abonnement et Traitement)

/**
 * Lance la boucle d'écoute de la file d'attente RabbitMQ.
 * Gère la résilience (Retry) si RabbitMQ n'est pas prêt.
 */
export async function startConsumer(): Promise<void> {
  let retries = 0; 

  while (retries < MAX_RETRIES) { 
    try {
      console.log(`[Notification] Tentative de connexion à RabbitMQ (${retries + 1}/${MAX_RETRIES})...`);

      // 1. Connexion physique au serveur RabbitMQ
      const connection = await amqp.connect(RABBITMQ_URL); 
      const channel    = await connection.createChannel(); 

      // 2. Déclaration de l'Exchange (Miroir de l'émetteur Ticket Service)
      await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      // 3. Déclaration de la file (Queue) durable
      await channel.assertQueue(QUEUE_NAME, { durable: true });

      // 4. Liaison (Binding) entre Queue et Exchange via la Routing Key
      await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

      // 5. Configuration QoS (Quality of Service)
      // prefetch(1) : Ne donne qu'un seul message à la fois au consommateur.
      // Évite l'engorgement si le traitement (ex: envoi de mail) est lent.
      channel.prefetch(1);

      isConsumerReady = true; 
      console.log(`[Notification] ✅ Connecté à RabbitMQ. En attente de messages sur "${QUEUE_NAME}"...`);

      // 6. Lancement de l'écoute active (Consommation)
      channel.consume(QUEUE_NAME, async (msg) => {
        if (!msg) return;
        try { 
          const data: TicketConfirmedMessage = JSON.parse(msg.content.toString()); 
          console.log(`[Notification] 📥 Message reçu : ticketId=${data.ticketId}, userId=${data.userId}`);

          // APPEL MÉTIER : Procédure d'envoi de notification (Mail/Console)
          await processTicketConfirmed(data); 

          // ACQUITTEMENT (ACK) : Dit à RabbitMQ "C'est bon, supprime le message"
          // Crucial pour ne pas repasser le message en boucle
          channel.ack(msg); 
          console.log(`[Notification] ✅ ACK envoyé pour ticketId=${data.ticketId}`);

        } catch (err) {
          console.error(`[Notification] ❌ Erreur de traitement:`, (err as Error).message);
          
          // NON-ACQUITTEMENT (NACK) : Dit à RabbitMQ "Échec de traitement"
          // Argument 2 (false) : Ne pas nacker tous les messages précédents
          // Argument 3 (true)  : Remettre le message dans la file (Requeue) pour re-tentative
          channel.nack(msg, false, true); 
        }
      });

      // Gestionnaire de déconnexion inattendue du Bus
      connection.on('close', () => {
        isConsumerReady = false;
        console.warn('[Notification] ⚠️  Connexion RabbitMQ fermée. Reconnexion dans 2s...');
        setTimeout(() => { startConsumer().catch(console.error); }, RETRY_DELAY_MS);
      });

      connection.on('error', (err: Error) => { 
        isConsumerReady = false;
        console.error('[Notification] Erreur de connexion RabbitMQ:', err.message);
      }); 
      return;
    } catch (err) {
      retries++;
      console.error(
        `[Notification] Impossible de se connecter (${(err as Error).message}).` +
        ` Retry ${retries}/${MAX_RETRIES}...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  // Si on sort de la boucle, c'est que MAX_RETRIES est atteint
  console.error('[Notification] ❌ Échec de connexion à RabbitMQ après tous les essais. Arrêt.');
  process.exit(1);
}

// Démarrage autonome hors environnement de Test
if (process.env.NODE_ENV !== 'test') {
  startConsumer().catch((err) => {
    console.error('[Notification] Erreur de démarrage du Consumer:', err);
    process.exit(1);
  });
}
