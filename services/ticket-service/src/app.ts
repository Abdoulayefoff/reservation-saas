import express from 'express'; 
import cors from 'cors'; 
import swaggerUi from 'swagger-ui-express'; 
import YAML from 'yamljs'; 
import path from 'path';
import ticketRoutes from './routes/ticketRoutes'; 

const app = express(); 

// MIDDLEWARES DE BASE

// Configuration du CORS restreint : sécurité réseau
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://api-gateway:8000')
  .split(',') // Divise la chaîne par virgule si plusieurs origines
  .map((o) => o.trim()); // Nettoie les espaces blancs autour
  
app.use(cors({ origin: allowedOrigins })); 

app.use(express.json());

// DOCUMENTATION SWAGGER (OPENAPI) 
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml')); 
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); 
} catch (error) { 
  console.warn('Swagger YAML file not found or invalid.');
}

// Route de Health Check (Docker Healthcheck & Orchestration)
// Doit être accessible en racine car bypass souvent la Gateway
app.get('/health', (req, res) => { 
  res.status(200).json({ status: 'ok', service: 'ticket-service' }); 
});

// Branchement des routes métiers : Prefix /tickets
// L'API Gateway réécrit souvent /api/tickets -> /tickets avant de proxyfier
app.use('/tickets', ticketRoutes); 

//  GESTIONNAIRE D'ERREURS GLOBAL (MIDDLEWARE)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack); 
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

export default app;
