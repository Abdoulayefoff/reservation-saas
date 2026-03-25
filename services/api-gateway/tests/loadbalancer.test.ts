/**
 * Tests unitaires – Weighted Round-Robin (ticketLoadBalancer.ts)
 *
 * On teste directement le module de load balancing, sans HTTP ni mock.
 * Cela garantit que la logique de distribution est correcte indépendamment
 * du framework (Express, http-proxy-middleware, etc.).
 */

// Réinitialise l'index à 0 avant chaque test pour des résultats déterministes
import { getNextTicketUrl, ticketPool, TICKET_INSTANCES, resetIndex } from '../src/ticketLoadBalancer';

beforeEach(() => {
  resetIndex();
});


describe('ticketLoadBalancer – configuration du pool', () => {
  test('le pool contient exactement 10 entrées (sum des poids : 6 + 4)', () => {
    expect(ticketPool).toHaveLength(10);
  });

  test('TICKET_INSTANCES définit 2 instances', () => {
    expect(TICKET_INSTANCES).toHaveLength(2);
  });

  test('instance 1 a le poids 6', () => {
    expect(TICKET_INSTANCES[0].weight).toBe(6);
  });

  test('instance 2 a le poids 4', () => {
    expect(TICKET_INSTANCES[1].weight).toBe(4);
  });

  test('les 6 premières entrées du pool pointent vers ticket-service-1', () => {
    const url1 = TICKET_INSTANCES[0].url;
    expect(ticketPool.slice(0, 6).every(u => u === url1)).toBe(true);
  });

  test('les 4 dernières entrées du pool pointent vers ticket-service-2', () => {
    const url2 = TICKET_INSTANCES[1].url;
    expect(ticketPool.slice(6, 10).every(u => u === url2)).toBe(true);
  });
});


describe('getNextTicketUrl – distribution sur 1 cycle (10 appels)', () => {
  test('distribue exactement 6 fois vers ticket-service-1', () => {
    const results = Array.from({ length: 10 }, () => getNextTicketUrl());
    const count1 = results.filter(u => u === TICKET_INSTANCES[0].url).length;
    expect(count1).toBe(6);
  });

  test('distribue exactement 4 fois vers ticket-service-2', () => {
    const results = Array.from({ length: 10 }, () => getNextTicketUrl());
    const count2 = results.filter(u => u === TICKET_INSTANCES[1].url).length;
    expect(count2).toBe(4);
  });

  test('les URL retournées appartiennent toutes au pool valide', () => {
    const validUrls = TICKET_INSTANCES.map(i => i.url);
    const results = Array.from({ length: 10 }, () => getNextTicketUrl());
    results.forEach(u => expect(validUrls).toContain(u));
  });
});


describe('getNextTicketUrl – distribution sur 2 cycles (20 appels)', () => {
  test('distribue 12 fois vers ticket-service-1 et 8 fois vers ticket-service-2', () => {
    const results = Array.from({ length: 20 }, () => getNextTicketUrl());
    const count1 = results.filter(u => u === TICKET_INSTANCES[0].url).length;
    const count2 = results.filter(u => u === TICKET_INSTANCES[1].url).length;
    expect(count1).toBe(12);
    expect(count2).toBe(8);
  });
});


describe('getNextTicketUrl – ratio exact 60/40', () => {
  test('le ratio url1/total est exactement 0.6 sur 100 appels', () => {
    const results = Array.from({ length: 100 }, () => getNextTicketUrl());
    const count1 = results.filter(u => u === TICKET_INSTANCES[0].url).length;
    expect(count1 / results.length).toBeCloseTo(0.6, 5);
  });

  test('aucune autre URL n\'est retournée', () => {
    const validUrls = new Set(TICKET_INSTANCES.map(i => i.url));
    const results = Array.from({ length: 100 }, () => getNextTicketUrl());
    results.forEach(u => expect(validUrls.has(u)).toBe(true));
  });
});


describe('getNextTicketUrl – cycle et bouclage', () => {
  test('le cycle se répète : le 11ème appel retourne la même URL que le 1er', () => {
    const first = getNextTicketUrl();
    for (let i = 1; i < 10; i++) getNextTicketUrl(); // consomme le reste du cycle
    const eleventh = getNextTicketUrl();
    expect(eleventh).toBe(first);
  });

  test('ordre déterministe : ticket-service-1 en premier (positions 0-5)', () => {
    const results = Array.from({ length: 6 }, () => getNextTicketUrl());
    results.forEach(u => expect(u).toBe(TICKET_INSTANCES[0].url));
  });

  test('ordre déterministe : ticket-service-2 aux positions 6-9', () => {
    for (let i = 0; i < 6; i++) getNextTicketUrl(); // saute les 6 premières
    const results = Array.from({ length: 4 }, () => getNextTicketUrl());
    results.forEach(u => expect(u).toBe(TICKET_INSTANCES[1].url));
  });
});
