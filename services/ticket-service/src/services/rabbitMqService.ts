import amqplib from 'amqplib'; 

/**
 * Service de gestion de la messagerie RabbitMQ (Pattern Singleton).
 * Responsabilités :
 * - Connexion résiliente avec tentatives multiples (Retry).
 * - Déclaration des Exchanges (Échanges) de messages.
 * - Publication des messages asynchrones (ex: Confirmation de billet).
 */
export class RabbitMQService { 
  private static instance: RabbitMQService; 
  private connection: any = null; 
  private channel: any = null; 
  private isConnecting: boolean = false; 

  // Constructeur privé pour empêcher l'instanciation directe (new)
  private constructor() {} 

  /**
   * Récupère l'instance unique du service (Singleton).
   */
  public static getInstance(): RabbitMQService { 
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService(); 
    } 
    return RabbitMQService.instance; 
  } 

  /**
   * Établit la connexion avec RabbitMQ avec mécanisme de Retry.
   * @param retries Nombre de tentatives avant abandon
   * @param delay Délai en ms entre deux tentatives
   */
  public async connect(retries = 10, delay = 2000): Promise<void> { 
    // Évite de lancer plusieurs procédures de connexion en même temps
    if (this.connection || this.isConnecting) return; 
    this.isConnecting = true;

    // Récupère l'URL de connexion (Injecté par Docker Compose)
    const url = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672'; 

    // Boucle de tentatives de reconnexion (Résilience au démarrage)
    for (let i = 0; i < retries; i++) { 
      try { 
        console.log(`[RabbitMQ] Attempting connection to ${url} (Attempt ${i + 1}/${retries})`);
        
        // 1. Connexion physique au serveur RabbitMQ
        this.connection = await amqplib.connect(url); 
        
        // 2. Création du canal de communication
        this.channel = await this.connection.createChannel(); 
        
        console.log('[RabbitMQ] Connected successfully');
        
        // 3. Déclaration de l'Exchange (Point d'entrée des messages)
        // 'ticket_events' : Nom de l'échange
        // 'topic' : Type permettant un routage par mot-clé (ex: ticket.confirmed)
        // durable: true : L'échange survit au redémarrage du serveur RabbitMQ
        await this.channel.assertExchange('ticket_events', 'topic', { durable: true });

        // Gestionnaire d'évènements en cas de coupure de connexion
        this.connection.on('close', () => { 
          console.error('[RabbitMQ] Connection closed. Reconnecting...'); 
          this.connection = null; 
          this.channel = null; 
          this.isConnecting = false; 
          setTimeout(() => this.connect(), delay); 
        }); 

        this.isConnecting = false; 
        return;
      } catch (error) { 
        console.error(`[RabbitMQ] Connection failed. Retrying in ${delay / 1000} seconds...`);
        // Attente asynchrone avant l'itération suivante
        await new Promise((resolve) => setTimeout(resolve, delay)); 
      }
    }
    this.isConnecting = false;
    throw new Error('[RabbitMQ] Failed to connect after multiple retries.');
  }

  /**
   * Publie un message asynchrone dans un Exchange.
   * @param exchange Nom de l'échange cible
   * @param routingKey Clé de routage (ex: 'ticket.confirmed')
   * @param message Objet JavaScript à envoyer (Sera sérialisé en JSON)
   * @returns true si le message est accepté par RabbitMQ
   */
  public async publishMessage(exchange: string, routingKey: string, message: any): Promise<boolean> {
    if (!this.channel) {
      console.warn('[RabbitMQ] Channel not available. Message not sent.');
      return false;
    }
    try { 
      // Sérialisation de l'objet JS en Buffer Binaire (Format requis par amqplib)
      const buffer = Buffer.from(JSON.stringify(message)); 
      
      // Publication avec option persistent: true 
      return this.channel.publish(exchange, routingKey, buffer, { persistent: true }); 
    } catch (error) { 
      console.error('[RabbitMQ] Error publishing message:', error); 
      return false; 
    } 
  } 
}
