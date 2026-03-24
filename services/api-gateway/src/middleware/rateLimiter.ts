import rateLimit from 'express-rate-limit';

/**
 * Rate limiter : 100 requêtes par minute par adresse IP.
 * Protège contre les attaques DDoS et les abus.
 * Le health check est exclu du rate limiting.
 */
export const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // Fenêtre de temps : 1 minute (60 000 ms)
  max: 100,            // Nombre maximum de requêtes autorisées par IP par fenêtre
  standardHeaders: true, 
  legacyHeaders: false, 
  message: {
    error: 'Too Many Requests', 
    message: 'Vous avez dépassé la limite de 100 requêtes par minute. Réessayez dans un instant.',
    retryAfter: 60,
  }, 
  // Fonction pour exclure certaines routes de la limitation (ex: Healthcheck)
  skip: (req) => req.path === '/health',
});
