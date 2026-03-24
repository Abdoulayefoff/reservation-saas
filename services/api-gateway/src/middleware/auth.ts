import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import fs from 'fs';

// Type du payload JWT (structure des données encodées dans le token)
export interface JwtPayload {
  id?: string;
  userId?: string;
  email: string;
  roles: string[];
  iat?: number; 
  exp?: number; 
} 
// Extension du type Express Request pour y ajouter l'objet 'user'
declare global {
  namespace Express { 
    interface Request {
      user?: {
        userId: string;
        email: string;
        roles: string[];
      }; 
    }
  } 
}

/**
 * Middleware d'authentification JWT.
 * - Intercepte la requête avant qu'elle n'atteigne les routes.
 * - Vérifie la présence du Token Bearer.
 * - Décode et authentifie via clé Publique (RS256) ou secrète (HS256).
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization; 
  if (!authHeader || !authHeader.startsWith('Bearer ')) { 
    res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Token JWT manquant ou format invalide. En-tête attendu : Authorization: Bearer <token>', 
    }); 
    return;
  }

  const token = authHeader.slice(7); // Extrait le Token pur (supprime 'Bearer ' soit 7 caractères)

  const publicKeyPath = process.env.JWT_PUBLIC_KEY; 
  let keyOrSecret: string | undefined; 
  let algorithms: jwt.Algorithm[]; 

  if (publicKeyPath) {
    try { 
      keyOrSecret = fs.readFileSync(publicKeyPath, 'utf8'); 
      algorithms = ['RS256'];
    } catch { 
      console.error('[Auth Middleware] Impossible de lire JWT_PUBLIC_KEY:', publicKeyPath); 
      res.status(500).json({ error: 'Erreur de configuration serveur' }); 
      return;
    }
  } else {
    keyOrSecret = process.env.JWT_SECRET;
    algorithms = ['HS256'];
  }

  if (!keyOrSecret) { // Vérification de sécurité : aucune clé n'est chargée
    console.error('[Auth Middleware] ERREUR CRITIQUE : JWT_SECRET et JWT_PUBLIC_KEY non configurés'); 
    res.status(500).json({ error: 'Erreur de configuration serveur' });
    return;
  }

  try { 
    // Vérifie et décode le token avec la clé et l'algorithme spécifiés
    const payload = jwt.verify(token, keyOrSecret, { algorithms }) as JwtPayload; 

    // Normalisation de l'id : récupère soit userId soit id
    const userId = payload.userId ?? payload.id;
    if (!userId) { 
      res.status(401).json({ error: 'Unauthorized', message: 'Payload JWT invalide : identifiant manquant' });
      return; 
    }

    // Injection des données de l'utilisateur dans l'objet 'req' (Requête)
    req.user = {
      userId, 
      email: payload.email, 
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };

    next(); // Jeton valide : passe au middleware ou contrôleur suivant
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token JWT expiré. Utilisez poster /api/auth/refresh pour le renouveler.',
      });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Token JWT invalide ou signature incorrecte.',
      });
    } else {
      console.error('[Auth Middleware] Erreur inattendue:', err);
      res.status(500).json({ error: 'Erreur interne lors de la vérification du token' });
    }
  }
}
