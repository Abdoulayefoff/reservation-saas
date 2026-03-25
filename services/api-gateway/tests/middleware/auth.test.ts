import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../src/middleware/auth';

// Helpers
const TEST_SECRET = 'test_secret_for_unit_tests';

function makeReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function makeRes(): { res: Partial<Response>; statusCode: number; body: unknown } {
  const ctx = { statusCode: 200, body: {} as unknown };
  const res: Partial<Response> = {
    status: jest.fn().mockImplementation((code: number) => {
      ctx.statusCode = code;
      return res as Response;
    }),
    json: jest.fn().mockImplementation((data: unknown) => {
      ctx.body = data;
      return res as Response;
    }),
  };
  return { res, statusCode: ctx.statusCode, body: ctx.body };
}

function makeNext(): jest.Mock { return jest.fn(); }

function signToken(
  payload: object,
  secret = TEST_SECRET,
  options?: jwt.SignOptions
): string {
  return jwt.sign(payload, secret, options);
}

// Setup : définir JWT_SECRET pour tous les tests
beforeEach(() => {
  process.env.JWT_SECRET = TEST_SECRET;
  // Désactiver JWT_PUBLIC_KEY (RS256) pour forcer le fallback HS256 en test
  delete process.env.JWT_PUBLIC_KEY;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

// Tests du middleware authenticate

describe('authenticate middleware', () => {

  // 1. En-tête Authorization absent
  test('retourne 401 si en-tête Authorization absent', () => {
    const req = makeReq();
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 2. Format Bearer manquant
  test('retourne 401 si le préfixe Bearer est absent', () => {
    const req = makeReq({ authorization: 'Token quelquechose' });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 3. Token expiré
  test('retourne 401 avec message spécifique si le token est expiré', () => {
    const expiredToken = signToken(
      { userId: 'user-1', email: 'a@b.com', roles: ['ROLE_USER'] },
      TEST_SECRET,
      { expiresIn: -1 } // Déjà expiré
    );
    const req = makeReq({ authorization: `Bearer ${expiredToken}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.message).toContain('expiré');
    expect(next).not.toHaveBeenCalled();
  });

  // 4. Signature invalide
  test('retourne 401 si la signature du token est invalide', () => {
    const tokenWithWrongSig = signToken(
      { userId: 'user-1', email: 'a@b.com', roles: ['ROLE_USER'] },
      'mauvais_secret'
    );
    const req = makeReq({ authorization: `Bearer ${tokenWithWrongSig}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Unauthorized', message: expect.stringContaining('invalide') })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // 5. Token valide avec userId
  test('appelle next() et injecte req.user si le token est valide (champ userId)', () => {
    const token = signToken({
      userId: 'abc-123',
      email: 'user@test.com',
      roles: ['ROLE_USER', 'ROLE_EVENT_CREATOR'],
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user).toEqual({
      userId: 'abc-123',
      email: 'user@test.com',
      roles: ['ROLE_USER', 'ROLE_EVENT_CREATOR'],
    });
  });

  // 6. Token valide avec champ 'id' (alternative)
  test('normalise le champ "id" en "userId" si userId est absent du payload', () => {
    const token = signToken({
      id: 'xyz-456',
      email: 'autre@test.com',
      roles: ['ROLE_ADMIN'],
    });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user?.userId).toBe('xyz-456');
  });

  // 7. Tableau roles absent dans le payload
  test('initialise roles à [] si le payload ne contient pas de roles', () => {
    const token = signToken({ userId: 'user-789', email: 'noroles@test.com' });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user?.roles).toEqual([]);
  });

  // 8. JWT_SECRET et JWT_PUBLIC_KEY non configurés -> 500
  test('retourne 500 si JWT_SECRET et JWT_PUBLIC_KEY ne sont pas configurés', () => {
    delete process.env.JWT_SECRET;
    delete process.env.JWT_PUBLIC_KEY;

    const token = signToken({ userId: 'u1', email: 'a@b.com', roles: [] });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  // 9. Payload sans userId ni id -> 401
  test('retourne 401 si le payload ne contient ni userId ni id', () => {
    const token = signToken({ email: 'a@b.com', roles: ['ROLE_USER'] });
    const req = makeReq({ authorization: `Bearer ${token}` });
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
