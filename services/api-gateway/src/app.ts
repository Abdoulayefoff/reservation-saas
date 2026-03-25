import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticate } from './middleware/auth';
import { TICKET_INSTANCES, getNextTicketUrl } from './ticketLoadBalancer';

const app = express();

app.set('trust proxy', 1); // Faire confiance au proxy nginx
const PORT = parseInt(process.env.PORT ?? '8000', 10);

// URLs des microservices (réseau Docker interne)
// Ces URLs pointent vers les noms de services Docker Compose (réseau interne).
// En développement local, elles peuvent être surchargées via les variables d'env.
const AUTH_URL    = process.env.AUTH_SERVICE_URL    ?? 'http://auth-service:8001';
const USER_URL    = process.env.USER_SERVICE_URL    ?? 'http://user-service:8002';
const EVENT_URL   = process.env.EVENT_SERVICE_URL   ?? 'http://event-service:8003';


// Sécurité globale

// Helmet : headers HTTP de sécurité (anti-XSS, anti-clickjacking, etc.)
// Appliqué en premier car il doit agir sur toutes les réponses sans exception.
app.use(helmet());

// Lecture et nettoyage de la liste des origines CORS autorisées.
// La variable d'env est une chaîne CSV (ex: "http://localhost:3000,https://prod.com").
// .split(',') découpe, .map(trim) supprime les espaces éventuels autour des virgules.
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? 'http://localhost:3000,http://localhost')
  .split(',')
  .map((origin) => origin.trim());

// Configuration du middleware CORS :
// - origin : liste blanche des domaines autorisés (frontend, etc.)
// - methods : verbes HTTP permis — OPTIONS est requis pour les requêtes preflight
// - allowedHeaders : seuls Content-Type et Authorization sont nécessaires
// - credentials : autorise l'envoi des cookies de session cross-origin
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Rate limiting : 100 requêtes / minute par IP (anti-DDoS)
// Placé après Helmet/CORS mais avant toutes les routes pour être universel.
app.use(rateLimiter);

//  Swagger UI 
// __dirname désigne le dossier du fichier compilé (dist/src/), pas du source.
// YAML.load parse le fichier YAML en objet JS que swagger-ui-express peut afficher.
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// Monte Swagger UI à /api-docs : swagger-ui.serve sert les assets statiques
// (JS/CSS), swagger-ui.setup génère la page avec la définition chargée.
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
// Déclaré AVANT le middleware d'auth pour être toujours accessible
// Ce endpoint est utilisé par Docker (HEALTHCHECK) et les outils de monitoring pour s'assurer que le service est opérationnel.
// Le préfixe _ sur _req signale que le paramètre est intentionnellement inutilisé.
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    upstreams: {
      auth:    AUTH_URL,
      users:   USER_URL,
      events:  EVENT_URL,
      tickets: TICKET_INSTANCES.map((i) => `${i.url} (weight=${i.weight})`),
    },
  });
});

// Proxy helper : crée un proxy vers un microservice
/**
 * Crée un proxy vers un microservice.
 * Injecte les headers X-User-Id et X-User-Roles si l'utilisateur est authentifié.
 * Supprime le header Authorization pour que les services backend
 * n'aient pas accès au JWT brut (ils font confiance aux headers X-User-*).
 *
 * @param target  - URL de base du microservice cible (ex: http://auth-service:8001)
 * @param _pathFrom - Préfixe de la route Gateway (non utilisé, Express le strip déjà)
 * @param pathTo  - Préfixe à injecter dans l'URL destination du microservice
 */
function makeProxy(target: string, _pathFrom: string, pathTo: string) {
  const proxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const user = (req as Request).user;
        if (user) {
          proxyReq.setHeader('X-User-Id', user.userId);
          proxyReq.setHeader('X-User-Roles', user.roles.join(','));
          proxyReq.setHeader('X-User-Email', user.email);
          proxyReq.removeHeader('Authorization');
        }
      },
      error: (err, _req, res) => {
        console.error(`[Gateway] Proxy error → ${target}:`, (err as Error).message);
        (res as Response).status(502).json({
          error: 'Bad Gateway',
          message: 'Le service en aval est temporairement indisponible.',
        });
      },
    },
  });

  // Express strip le préfixe /api/xxx de req.url — on le remet manuellement
  // pour que le microservice reçoive l'URL complète attendue.
  // Exemple : GET /api/events/42 -> Express strip /api/events -> req.url = /42
  //           On le remap en /events/42 pour l'event-service.
  return (req: Request, res: Response, next: NextFunction) => {
    // Si req.url est '/', on n'ajoute pas de slash superflu (évite /events/)
    req.url = `/${pathTo}${req.url === '/' ? '' : req.url}`;
    proxy(req, res, next);
  };
}

// ─── PARTIE 1 : Routes AUTH (publiques – auth-service gère sa propre sécurité)
// /api/auth/* -> auth-service:8001/auth/*
//
// Routes publiques (pas de JWT requis par la gateway) :
//   POST /api/auth/register -> inscription
//   POST /api/auth/login    -> connexion
//   POST /api/auth/refresh  -> renouvellement du JWT
//
// Routes protégées (auth-service valide lui-même le JWT) :
//   POST /api/auth/logout   -> déconnexion
//   GET  /api/auth/me       -> profil connecté
//   GET  /api/auth/validate -> validation interne
//
// La gateway ne filtre pas /api/auth/* car l'auth-service gère sa sécurité.
app.use(
  '/api/auth',
  (req: Request, _res: Response, next: NextFunction) => {
    // Express strip /api/auth — on préfixe avec /auth
    req.url = `/auth${req.url === '/' ? '' : req.url}`;
    next();
  },
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    on: {
      // Gestion d'erreur spécifique à l'auth-service — message adapté au contexte
      error: (_err, _req, res) => {
        (res as Response).status(502).json({
          error: 'Bad Gateway',
          message: 'Auth service indisponible.',
        });
      },
    },
  })
);

// PARTIE 2b : Route EVENTS/MINE (authentifiée — tous statuts du créateur)
// Doit être déclarée AVANT le handler général /api/events pour prendre priorité.
// Réutilise makeProxy pour ne pas créer de nouvelles fonctions non couvertes.
app.get(
  '/api/events/mine',
  authenticate,
  (req: Request, _res: Response, next: NextFunction) => {
    req.url = '/'; // makeProxy rebuilds: /events/mine + '' = /events/mine
    next();
  },
  makeProxy(EVENT_URL, '', 'events/mine')
);

// PARTIE 2 : Routes EVENTS (GET public, reste protégé)
// /api/events/* → event-service:8003/events/*
//
// Règle RBAC :
//   GET  /api/events   → public (liste des concerts publiés)
//   GET  /api/events/:id → public (détail d'un concert)
//   POST /api/events   → JWT requis (ROLE_EVENT_CREATOR ou ROLE_ADMIN)
//   PUT  /api/events/:id → JWT requis (créateur ou admin)
app.use(
  '/api/events',
  (req: Request, res: Response, next: NextFunction) => {
    // Les requêtes GET sont publiques (consultation du catalogue)
    if (req.method === 'GET') {
      return next();
    }
    // Toute autre méthode nécessite un JWT valide
    authenticate(req, res, next);
  },
  // makeProxy construit dynamiquement le proxy et réécrit l'URL de /events/* vers l'event-service
  makeProxy(EVENT_URL, 'events', 'events')
);

// PARTIE 3 : Routes USERS (protégées)
// /api/users/* -> user-service:8002/users/*
// JWT requis sur toutes les routes — les données personnelles sont sensibles, un utilisateur non authentifié ne doit jamais accéder aux profils.
app.use(
  '/api/users',
  authenticate,
  makeProxy(USER_URL, 'users', 'users')
);

// PARTIE 4 : Routes TICKETS (protégées)
// /api/tickets/* → ticket-service-1:8004 ou ticket-service-2:8004 (weighted round-robin)
// JWT requis : l'achat et la consultation de tickets sont liés à un compte.
app.use(
  '/api/tickets',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    makeProxy(getNextTicketUrl(), 'tickets', 'tickets')(req, res, next);
  }
);

// PARTIE 5 : Route Admin tickets
// GET /api/admin/tickets → ticket-service (weighted round-robin) /tickets/admin
// JWT + ROLE_ADMIN requis (vérifié côté ticket-service via X-User-Roles)
app.use(
  '/api/admin/tickets',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    req.url = '/tickets/admin' + (req.url === '/' ? '' : req.url);
    makeProxy(getNextTicketUrl(), '', 'tickets/admin')(req, res, next);
  }
);

// 404
// Middleware catchall : capte toutes les requêtes qui n'ont pas été interceptées par les routes précédentes et retourne une réponse 404 claire.
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    // req.method et req.originalUrl permettent d'indiquer exactement ce qui n'a pas été trouvé
    message: `Route ${req.method} ${req.originalUrl} introuvable.`,
    // Aide au débogage : liste exhaustive des routes connues de la gateway
    availableRoutes: [
      'POST   /api/auth/register',
      'POST   /api/auth/login',
      'POST   /api/auth/logout',
      'POST   /api/auth/refresh',
      'GET    /api/auth/me',
      'GET    /api/events',
      'GET    /api/events/:id',
      'POST   /api/events',
      'PUT    /api/events/:id',
      'DELETE /api/events/:id',
      'GET    /api/users/:id',
      'PUT    /api/users/:id',
      'GET    /api/tickets',
      'POST   /api/tickets/buy',
      'POST   /api/tickets/purchase',
      'GET    /api/admin/tickets',
      'GET    /api/events/:id/availability',
      'GET    /health',
    ],
  });
});

// Démarrage (désactivé en mode test pour Supertest)
// En mode test (NODE_ENV=test), Supertest monte l'app directement sans passer par app.listen(), évitant ainsi les conflits de port et permettant des tests plus rapides et déterministes.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // Confirmation de démarrage avec les URLs configurées pour faciliter le débogage
    console.log(`[API Gateway] ✅ Démarré sur le port ${PORT}`);
    console.log(`[API Gateway] Upstreams configurés :`);
    console.log(`               Auth    → ${AUTH_URL}`);
    console.log(`               Users   → ${USER_URL}`);
    console.log(`               Events  → ${EVENT_URL}`);
    TICKET_INSTANCES.forEach((i) =>
      console.log(`               Tickets → ${i.url} (weight=${i.weight})`)
    );
    console.log(`[API Gateway] CORS autorisé pour : ${allowedOrigins.join(', ')}`);
  });
}

export default app;
