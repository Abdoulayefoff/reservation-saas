import axios from 'axios';
import { getUserInfo, processTicketConfirmed, TicketConfirmedMessage } from '../src/notificationService';

// ─── Mock Axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock console.log pour les assertions
const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  consoleSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

// Tests de getUserInfo

describe('getUserInfo', () => {

  test('retourne l\'email et le prénom si le User Service répond', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'alice@example.com', first_name: 'Alice' } },
    });

    const result = await getUserInfo('user-uuid-123');

    expect(result).toEqual({ email: 'alice@example.com', firstName: 'Alice' });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/users/user-uuid-123'),
      expect.objectContaining({ timeout: 3000 })
    );
  });

  test('retourne null en mode dégradé si le User Service est injoignable', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getUserInfo('user-uuid-456');

    expect(result).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('User Service injoignable')
    );
  });

  test('retourne null si le User Service retourne une erreur 404', async () => {
    mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

    const result = await getUserInfo('user-uuid-inconnu');

    expect(result).toBeNull();
  });

  test('retourne email uniquement si firstName est absent', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'bob@example.com' } },
    });

    const result = await getUserInfo('user-uuid-789');

    expect(result).toEqual({ email: 'bob@example.com', firstName: null });
  });
});

// Tests de processTicketConfirmed

describe('processTicketConfirmed', () => {

  const baseMessage: TicketConfirmedMessage = {
    ticketId:     'ticket-abc-123',
    ticketNumber: 'ticket-abc-123',
    eventId:      'event-xyz-456',
    userId:       'user-111',
    purchasedAt:  '2026-03-22T10:30:00.000Z',
  };

  test('logue l\'identifiant du billet et l\'email de l\'utilisateur', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'alice@concert.fr', first_name: 'Alice' } },
    });

    await processTicketConfirmed(baseMessage);

    // Vérifier que la ligne clé "📩 Envoi" est bien loguée
    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const notifLine = allLogs.find((l) =>
      typeof l === 'string' && l.includes('📩') && l.includes('ticket-abc-123')
    );
    expect(notifLine).toBeDefined();
    expect(notifLine).toContain('alice@concert.fr');
  });

  test('logue le billet ID dans la ligne de confirmation', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'bob@test.com', first_name: 'Bob' } },
    });

    await processTicketConfirmed({ ...baseMessage, ticketId: 'ticket-SPECIAL-999', ticketNumber: 'ticket-SPECIAL-999' });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasTicketId = allLogs.some(
      (l) => typeof l === 'string' && l.includes('ticket-SPECIAL-999')
    );
    expect(hasTicketId).toBe(true);
  });

  test('utilise l\'eventTitle si disponible', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'c@d.com', first_name: 'Carl' } },
    });

    await processTicketConfirmed({
      ...baseMessage,
      eventTitle: 'Tournée Mondiale 2026',
    });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasTitle = allLogs.some(
      (l) => typeof l === 'string' && l.includes('Tournée Mondiale 2026')
    );
    expect(hasTitle).toBe(true);
  });

  test('repli sur eventId si eventTitle absent', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'c@d.com', first_name: 'Carl' } },
    });

    await processTicketConfirmed(baseMessage); // Pas de eventTitle

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasEventId = allLogs.some(
      (l) => typeof l === 'string' && l.includes('event-xyz-456')
    );
    expect(hasEventId).toBe(true);
  });

  test('logue le montant payé si pricePaid est fourni', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'd@e.com', first_name: 'Diane' } },
    });

    await processTicketConfirmed({ ...baseMessage, pricePaid: 49.99 });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasPriceLine = allLogs.some(
      (l) => typeof l === 'string' && l.includes('49.99')
    );
    expect(hasPriceLine).toBe(true);
  });

  test('n\'affiche pas la ligne montant si pricePaid est absent', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'e@f.com', first_name: 'Eva' } },
    });

    await processTicketConfirmed(baseMessage); // Pas de pricePaid

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasMontant = allLogs.some(
      (l) => typeof l === 'string' && l.includes('Montant payé')
    );
    expect(hasMontant).toBe(false);
  });

  test('logue la quantité si supérieure à 1', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'f@g.com', first_name: 'Félix' } },
    });

    await processTicketConfirmed({ ...baseMessage, quantity: 3 });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasQuantity = allLogs.some(
      (l) => typeof l === 'string' && l.includes('3 billet(s)')
    );
    expect(hasQuantity).toBe(true);
  });

  test('fonctionne en mode dégradé si User Service indisponible', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

    // Ne doit pas lever d'exception
    await expect(processTicketConfirmed(baseMessage)).resolves.not.toThrow();

    // Le recipient doit être userId: au lieu d'un email
    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasFallback = allLogs.some(
      (l) => typeof l === 'string' && l.includes('userId:user-111')
    );
    expect(hasFallback).toBe(true);
  });

  test('utilise "Client" comme prénom si User Service indisponible', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('network error'));

    await processTicketConfirmed(baseMessage);

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasBonjour = allLogs.some(
      (l) => typeof l === 'string' && l.includes('Bonjour Client')
    );
    expect(hasBonjour).toBe(true);
  });

  test('utilise userEmail du message directement si fourni', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'ignored@test.com', first_name: 'Zara' } },
    });

    await processTicketConfirmed({
      ...baseMessage,
      userEmail: 'direct@email.fr',
    });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasDirectEmail = allLogs.some(
      (l) => typeof l === 'string' && l.includes('direct@email.fr')
    );
    expect(hasDirectEmail).toBe(true);
  });

  test('reste "Client" si userEmail fourni mais userInfo sans firstName', async () => {
    // User Service retourne un profil sans first_name
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'x@x.com' } }, // pas de first_name
    });

    await processTicketConfirmed({
      ...baseMessage,
      userEmail: 'preset@email.fr',
    });

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasClient = allLogs.some(
      (l) => typeof l === 'string' && l.includes('Bonjour Client')
    );
    expect(hasClient).toBe(true);
  });

  test('getUserInfo fonctionne quand data n\'a pas de wrapper profile', async () => {
    // User Service retourne directement les champs sans le sous-objet "profile"
    mockedAxios.get.mockResolvedValueOnce({
      data: { email: 'flat@user.com', first_name: 'Flat' },
    });

    await processTicketConfirmed(baseMessage);

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasEmail = allLogs.some(
      (l) => typeof l === 'string' && l.includes('flat@user.com')
    );
    expect(hasEmail).toBe(true);
  });

  test('utilise ticketId quand ticketNumber absent du message', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { profile: { email: 'g@h.com', first_name: 'Grace' } },
    });

    // Message sans ticketNumber -> doit utiliser ticketId.substring(0, 8)
    const msgWithoutNumber = {
      ticketId:    'ticket-fallback-id',
      eventId:     'event-xyz-456',
      userId:      'user-111',
      purchasedAt: '2026-03-22T10:30:00.000Z',
    };

    await processTicketConfirmed(msgWithoutNumber as any);

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    // ticketId.substring(0, 8) = 'ticket-f'
    const hasTicketFallback = allLogs.some(
      (l) => typeof l === 'string' && l.includes('ticket-f')
    );
    expect(hasTicketFallback).toBe(true);
  });

  test('getUserInfo gère la réponse avec firstName en camelCase', async () => {
    // User Service retourne email + firstName (camelCase) directement sans wrapper profile
    mockedAxios.get.mockResolvedValueOnce({
      data: { email: 'camel@email.fr', firstName: 'Camel' },
    });

    await processTicketConfirmed(baseMessage);

    const allLogs = consoleSpy.mock.calls.map((c) => c[0]);
    const hasCamel = allLogs.some(
      (l) => typeof l === 'string' && l.includes('camel@email.fr')
    );
    expect(hasCamel).toBe(true);
    const hasCamelName = allLogs.some(
      (l) => typeof l === 'string' && l.includes('Bonjour Camel')
    );
    expect(hasCamelName).toBe(true);
  });
});

// Tests du serveur HTTP health (consumer.ts)

describe('Serveur HTTP healthcheck', () => {
  // On importe httpApp directement (consumer ne démarre pas en mode test)
  let httpApp: import('express').Express;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Import dynamique pour s'assurer que NODE_ENV est set avant
    const consumerModule = await import('../src/consumer');
    httpApp = consumerModule.httpApp;
  });

  test('GET /health retourne 503 quand le consumer n\'est pas connecté', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const supertest = require('supertest');
    const res = await supertest(httpApp).get('/health');

    // isConsumerReady est false par défaut en test (pas de vrai RabbitMQ)
    expect(res.status).toBe(503);
    expect(res.body.service).toBe('notification-service');
    expect(res.body.consumer).toBe('connecting');
  });
});
