import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock http-proxy-middleware
// Les tests unitaires ne doivent pas faire d'appels réels aux microservices.
// On remplace chaque proxy par un handler qui retourne 200 avec le service cible.
jest.mock('http-proxy-middleware', () => ({
  createProxyMiddleware: (options: { target: string }) =>
    (_req: unknown, res: { json: (d: unknown) => void }, next: () => void) => {
      // Simuler une réponse du service proxié
      if (res && typeof (res as any).json === 'function') {
        (res as any).status(200).json({ proxied: true, target: options.target });
      } else {
        next();
      }
    },
}));

const TEST_SECRET = 'test_secret_gateway';

// Définir JWT_SECRET avant d'importer l'app
beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.NODE_ENV   = 'test';
});

// Importer l'app après avoir configuré les env vars
import app from '../src/app';

function makeValidToken(roles = ['ROLE_USER']): string {
  return jwt.sign(
    { userId: 'user-test-123', email: 'test@example.com', roles },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

// Tests des routes de l'API Gateway

describe('API Gateway – Routes', () => {

  // Health check
  describe('GET /health', () => {
    test('retourne 200 avec status ok', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('api-gateway');
      expect(res.body.timestamp).toBeDefined();
    });

    test('retourne la liste des upstreams', async () => {
      const res = await request(app).get('/health');

      expect(res.body.upstreams).toBeDefined();
      expect(res.body.upstreams).toHaveProperty('auth');
      expect(res.body.upstreams).toHaveProperty('users');
      expect(res.body.upstreams).toHaveProperty('events');
      expect(res.body.upstreams).toHaveProperty('tickets');
    });
  });

  // Route inconnue -> 404
  describe('Routes inconnues', () => {
    test('retourne 404 pour une route inexistante', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });

    test('retourne 404 pour une route racine inconnue', async () => {
      const res = await request(app).get('/foobar');

      expect(res.status).toBe(404);
    });
  });

  // Routes AUTH (publiques – pas de JWT requis)
  describe('Routes /api/auth (publiques)', () => {
    test('POST /api/auth/login passe sans token (route publique)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'a@b.com', password: 'password' });

      // La gateway ne doit pas bloquer cette route (200 du proxy mock)
      expect(res.status).not.toBe(401);
    });

    test('POST /api/auth/register passe sans token (route publique)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'new@b.com', password: 'password123' });

      expect(res.status).not.toBe(401);
    });

    test('POST /api/auth/refresh passe sans token (route publique)', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'some-token' });

      expect(res.status).not.toBe(401);
    });
  });

  // Routes EVENTS (GET public, POST protégé)
  describe('Routes /api/events', () => {
    test('GET /api/events passe sans token (consultation publique)', async () => {
      const res = await request(app).get('/api/events');

      expect(res.status).not.toBe(401);
    });

    test('GET /api/events/:id passe sans token', async () => {
      const res = await request(app).get('/api/events/some-uuid');

      expect(res.status).not.toBe(401);
    });

    test('POST /api/events sans token retourne 401', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({ title: 'Concert Test' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('PUT /api/events/:id sans token retourne 401', async () => {
      const res = await request(app)
        .put('/api/events/some-uuid')
        .send({ title: 'Modifié' });

      expect(res.status).toBe(401);
    });

    test('DELETE /api/events/:id sans token retourne 401', async () => {
      const res = await request(app).delete('/api/events/some-uuid');

      expect(res.status).toBe(401);
    });

    test('POST /api/events avec token valide est proxié', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${makeValidToken(['ROLE_EVENT_CREATOR'])}`)
        .send({ title: 'Concert Test' });

      expect(res.status).not.toBe(401);
    });
  });

  // Routes USERS (protégées)
  describe('Routes /api/users (protégées)', () => {
    test('GET /api/users/:id sans token retourne 401', async () => {
      const res = await request(app).get('/api/users/user-123');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('PUT /api/users/:id sans token retourne 401', async () => {
      const res = await request(app)
        .put('/api/users/user-123')
        .send({ firstName: 'Abdoulaye' });

      expect(res.status).toBe(401);
    });

    test('GET /api/users/:id avec token valide est proxié', async () => {
      const res = await request(app)
        .get('/api/users/user-123')
        .set('Authorization', `Bearer ${makeValidToken()}`);

      expect(res.status).not.toBe(401);
    });
  });

  // Routes TICKETS (protégées)
  describe('Routes /api/tickets (protégées)', () => {
    test('GET /api/tickets sans token retourne 401', async () => {
      const res = await request(app).get('/api/tickets');

      expect(res.status).toBe(401);
    });

    test('POST /api/tickets/purchase sans token retourne 401', async () => {
      const res = await request(app)
        .post('/api/tickets/purchase')
        .send({ eventId: 'event-123' });

      expect(res.status).toBe(401);
    });

    test('POST /api/tickets/purchase avec token valide est proxié', async () => {
      const res = await request(app)
        .post('/api/tickets/purchase')
        .set('Authorization', `Bearer ${makeValidToken()}`)
        .send({ eventId: 'event-123' });

      expect(res.status).not.toBe(401);
    });
  });

  // Token expiré sur routes protégées
  describe('Token JWT expiré', () => {
    test('retourne 401 avec message de renouvellement pour token expiré', async () => {
      const expiredToken = jwt.sign(
        { userId: 'u1', email: 'a@b.com', roles: ['ROLE_USER'] },
        TEST_SECRET,
        { expiresIn: -1 }
      );

      const res = await request(app)
        .get('/api/users/u1')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expiré');
      expect(res.body.message).toContain('/api/auth/refresh');
    });
  });

  // Route admin tickets
  describe('Routes /api/admin/tickets (protégées)', () => {
    test('GET /api/admin/tickets sans token retourne 401', async () => {
      const res = await request(app).get('/api/admin/tickets');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    test('GET /api/admin/tickets avec token valide est proxié', async () => {
      const res = await request(app)
        .get('/api/admin/tickets')
        .set('Authorization', `Bearer ${makeValidToken(['ROLE_ADMIN'])}`);

      expect(res.status).not.toBe(401);
    });
  });

  // Route inconnue -> 404
  describe('Route inconnue', () => {
    test('retourne 404 pour une route qui n\'existe pas', async () => {
      const res = await request(app).get('/api/inexistant');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
