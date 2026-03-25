/**
 * Weighted Round-Robin Load Balancer – ticket-service
 *
 * Construit un pool d'URLs pondéré et le parcourt en boucle.
 * Exemple avec weight=[6,4] :
 *   pool = [url1, url1, url1, url1, url1, url1, url2, url2, url2, url2]
 *   Sur 10 requêtes : 6 vers url1 (60%), 4 vers url2 (40%)
 */

export interface TicketInstance {
  url: string;
  weight: number;
}

export const TICKET_INSTANCES: TicketInstance[] = [
  { url: process.env.TICKET_SERVICE_URL_1 ?? 'http://ticket-service-1:8004', weight: 6 },
  { url: process.env.TICKET_SERVICE_URL_2 ?? 'http://ticket-service-2:8004', weight: 4 },
];

// Pool pondéré : chaque URL répétée selon son poids
export const ticketPool: string[] = TICKET_INSTANCES.flatMap(({ url, weight }) =>
  Array<string>(weight).fill(url)
);

let ticketRRIndex = 0;

/**
 * Retourne la prochaine URL selon le weighted round-robin.
 * Thread-safe en Node.js (event loop mono-thread).
 */
export function getNextTicketUrl(): string {
  const url = ticketPool[ticketRRIndex % ticketPool.length];
  ticketRRIndex++;
  return url;
}

/** Réinitialise le compteur (utilisé uniquement dans les tests). */
export function resetIndex(): void {
  ticketRRIndex = 0;
}
