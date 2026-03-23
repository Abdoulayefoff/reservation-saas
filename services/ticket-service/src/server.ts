import app from './app'; 
import { RabbitMQService } from './services/rabbitMqService';

const PORT = process.env.PORT || 8004; // Définition du port d'écoute (8004 par défaut pour ce service)

/**
 * Fonction maîtresse d'initialisation et de démarrage du Serveur Node/Express.
 */
async function startServer() { 
  try { 
    
    // étape 1 : Connexion au BUS de Messages (RabbitMQ)
    // essentiel pour que l'achat de billets puisse émettre des notifications
    const rabbitMQService = RabbitMQService.getInstance();
    await rabbitMQService.connect(); 

    // étape 2 : Lancement de l'écoute HTTP Express
    app.listen(PORT, () => { 
      console.log(`[ticket-service] Server running on port ${PORT}`); 
    }); 
  } catch (error) { 
    console.error('Failed to start server:', error);
    process.exit(1);
  } 
} 
startServer();
