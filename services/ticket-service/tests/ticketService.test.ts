import axios, { AxiosError } from 'axios';
import { RabbitMQService } from '../src/services/rabbitMqService';
import { TicketService } from '../src/services/ticketService';

// Mocks

jest.mock('axios');
jest.mock('../src/services/rabbitMqService');

jest.mock('@prisma/client', () => {
  const mPrisma = {
    ticket: {
      create:     jest.fn(),
      findMany:   jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
      count:      jest.fn(),
    },
    paymentLog: {
      create: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mPrisma),
    TicketStatus:  { ACTIVE: 'ACTIVE',    CANCELLED: 'CANCELLED', USED: 'USED'      },
    PaymentStatus: { PENDING: 'PENDING',  COMPLETED: 'COMPLETED', FAILED: 'FAILED'  },
  };
});

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient() as any;

// Helpers

/** Crée un faux AxiosError dont instanceof AxiosError === true */
function makeAxiosError(status: number): AxiosError {
  const err = Object.create((AxiosError as any).prototype ?? Error.prototype) as AxiosError;
  (err as any).response = { status };
  (err as any).isAxiosError = true;
  return err;
}

const mockTicket = {
  id:            'tick-123',
  ticketNumber:  'TKT-2025-ABCDE',
  eventId:       'evt-1',
  eventTitle:    'Test Event',
  eventDate:     new Date('2025-10-01T20:00:00Z'),
  venue:         'Paris',
  userId:        'user-1',
  pricePaid:     50,
  purchaseDate:  new Date(),
  status:        'ACTIVE',
  paymentMethod: 'CARD',
  paymentStatus: 'COMPLETED',
};

const mockEventResponse = {
  data: {
    availableSeats: 10,
    price:          50.0,
    title:          'Test Event',
    eventDate:      '2025-10-01T20:00:00Z',
    venue:          'Paris',
  },
};

// Setup

describe('TicketService', () => {
  let ticketService: TicketService;

  beforeEach(() => {
    ticketService = new TicketService();
    jest.clearAllMocks();

    RabbitMQService.getInstance = jest.fn().mockReturnValue({
      publishMessage: jest.fn().mockResolvedValue(true),
    });
  });

  // purchaseTicket

  describe('purchaseTicket', () => {

    it('devrait lever une erreur si l\'évènement est introuvable (AxiosError 404)', async () => {
      (axios.get as jest.Mock).mockRejectedValue(makeAxiosError(404));

      await expect(
        ticketService.purchaseTicket('invalid-id', 'user-1', 1, null, null)
      ).rejects.toThrow('Event not found.');
    });

    it('devrait lever une erreur de communication pour une erreur non-404', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null)
      ).rejects.toThrow('Failed to communicate with Event Service.');
    });

    it('devrait lever une erreur si les places disponibles sont insuffisantes', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { ...mockEventResponse.data, availableSeats: 1 },
      });

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 5, null, null)
      ).rejects.toThrow('Not enough places available.');
    });

    it('devrait lever une erreur si le paiement est refusé', async () => {
      (axios.get as jest.Mock).mockResolvedValue(mockEventResponse);
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(false);

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null)
      ).rejects.toThrow('Payment failed due to insufficient funds or bank rejection.');
    });

    it('devrait lever une erreur si la réservation retourne 400 (places sold out)', async () => {
      (axios.get  as jest.Mock).mockResolvedValue(mockEventResponse);
      (axios.patch as jest.Mock).mockRejectedValue(makeAxiosError(400));
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null)
      ).rejects.toThrow('Places unfortunately sold out during payment process. Refund issued.');
    });

    it('devrait lever une erreur générale si la réservation échoue', async () => {
      (axios.get  as jest.Mock).mockResolvedValue(mockEventResponse);
      (axios.patch as jest.Mock).mockRejectedValue(new Error('Server error'));
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null)
      ).rejects.toThrow('Failed to reserve places reliably.');
    });

    it('devrait acheter un billet avec succès (email fourni)', async () => {
      (axios.get  as jest.Mock).mockResolvedValue(mockEventResponse);
      (axios.patch as jest.Mock).mockResolvedValue({ data: { message: 'Reserved' } });
      (prisma.ticket.create     as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      const tickets = await ticketService.purchaseTicket('evt-1', 'user-1', 1, 'user@test.fr', null);

      expect(tickets).toHaveLength(1);
      expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1/reserve'),
        { quantity: 1 }
      );
    });

    it('devrait résoudre l\'email via getUserEmail si aucun email fourni', async () => {
      (axios.get as jest.Mock)
        .mockResolvedValueOnce(mockEventResponse)              // event service
        .mockResolvedValueOnce({ data: { email: 'resolved@test.fr' } }); // user service
      (axios.patch as jest.Mock).mockResolvedValue({ data: {} });
      (prisma.ticket.create     as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      const tickets = await ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null);

      expect(tickets).toHaveLength(1);
      // getUserEmail appelle /users/:userId
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/users/user-1'),
        expect.any(Object)
      );
    });

    it('devrait fonctionner en mode dégradé si getUserEmail échoue', async () => {
      (axios.get as jest.Mock)
        .mockResolvedValueOnce(mockEventResponse)             // event service
        .mockRejectedValueOnce(new Error('User Service down')); // user service
      (axios.patch as jest.Mock).mockResolvedValue({ data: {} });
      (prisma.ticket.create     as jest.Mock).mockResolvedValue(mockTicket);
      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      // Ne doit pas lever d'exception
      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 1, null, null)
      ).resolves.toBeDefined();
    });

    it('devrait supporter availablePlaces au lieu de availableSeats', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { availablePlaces: 2, price: 30, title: 'T', eventDate: '2025-01-01', venue: 'V' },
      });
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      // quantity = 5 > availablePlaces = 2 → doit rejeter
      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 5, null, null)
      ).rejects.toThrow('Not enough places available.');
    });
  });

  // getUserTickets

  describe('getUserTickets', () => {
    it('devrait retourner les billets d\'un utilisateur', async () => {
      const mockTickets = [mockTicket];
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue(mockTickets);

      const result = await ticketService.getUserTickets('user-1');

      expect(result).toEqual(mockTickets);
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where:   { userId: 'user-1' },
        orderBy: { purchaseDate: 'desc' },
      });
    });

    it('devrait retourner un tableau vide si l\'utilisateur n\'a pas de billets', async () => {
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([]);

      const result = await ticketService.getUserTickets('user-unknown');

      expect(result).toEqual([]);
    });
  });

  // getAllTickets

  describe('getAllTickets', () => {
    it('devrait retourner des billets paginés avec le total', async () => {
      (prisma.ticket.count    as jest.Mock).mockResolvedValue(25);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([mockTicket]);

      const result = await ticketService.getAllTickets(2, 10);

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.data).toHaveLength(1);
    });

    it('devrait utiliser les valeurs par défaut (page=1, limit=20)', async () => {
      (prisma.ticket.count    as jest.Mock).mockResolvedValue(5);
      (prisma.ticket.findMany as jest.Mock).mockResolvedValue([mockTicket]);

      const result = await ticketService.getAllTickets();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });
  });

  // getTicket

  describe('getTicket', () => {
    it('devrait retourner le billet pour son propriétaire', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);

      const result = await ticketService.getTicket('tick-123', 'user-1', []);

      expect(result.id).toBe('tick-123');
    });

    it('devrait retourner le billet pour un admin', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({ ...mockTicket, userId: 'other-user' });

      const result = await ticketService.getTicket('tick-123', 'admin-user', ['ROLE_ADMIN']);

      expect(result.id).toBe('tick-123');
    });

    it('devrait lever une erreur si le billet est introuvable', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ticketService.getTicket('tick-999', 'user-1', [])
      ).rejects.toThrow('Ticket not found.');
    });

    it('devrait lever une erreur Unauthorized pour un utilisateur non propriétaire', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({ ...mockTicket, userId: 'owner-user' });

      await expect(
        ticketService.getTicket('tick-123', 'other-user', ['ROLE_USER'])
      ).rejects.toThrow('Unauthorized.');
    });
  });

  // cancelTicket

  describe('cancelTicket', () => {
    it('devrait annuler un billet actif avec succès', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (axios.patch as jest.Mock).mockResolvedValue({ data: {} });
      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-refund' });
      (prisma.ticket.update     as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'CANCELLED' });

      const result = await ticketService.cancelTicket('tick-123', 'user-1', []);

      expect(result.status).toBe('CANCELLED');
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1/release'),
        { quantity: 1 }
      );
    });

    it('devrait lever une erreur si le billet est déjà annulé', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'CANCELLED' });

      await expect(
        ticketService.cancelTicket('tick-123', 'user-1', [])
      ).rejects.toThrow('Only active tickets can be cancelled.');
    });

    it('devrait poursuivre l\'annulation même si le Event Service est indisponible', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(mockTicket);
      (axios.patch as jest.Mock).mockRejectedValue(new Error('Service unavailable'));
      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-refund' });
      (prisma.ticket.update     as jest.Mock).mockResolvedValue({ ...mockTicket, status: 'CANCELLED' });

      // Ne doit pas lever d'exception malgré l'échec du release
      const result = await ticketService.cancelTicket('tick-123', 'user-1', []);

      expect(result.status).toBe('CANCELLED');
    });

    it('devrait lever une erreur si le billet n\'existe pas', async () => {
      (prisma.ticket.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        ticketService.cancelTicket('tick-999', 'user-1', [])
      ).rejects.toThrow('Ticket not found.');
    });
  });

  // simulatePayment

  describe('simulatePayment (méthode privée)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach (() => jest.useRealTimers());

    it('devrait retourner true pour la carte de test 4242 (succès forcé)', async () => {
      const promise = (ticketService as any).simulatePayment(100, '4242');
      jest.runAllTimers();
      expect(await promise).toBe(true);
    });

    it('devrait retourner false pour la carte de test 0002 (échec forcé)', async () => {
      const promise = (ticketService as any).simulatePayment(100, '0002');
      jest.runAllTimers();
      expect(await promise).toBe(false);
    });

    it('devrait retourner true si random < 0.90 (succès aléatoire)', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const promise = (ticketService as any).simulatePayment(100, null);
      jest.runAllTimers();
      expect(await promise).toBe(true);
      (Math.random as jest.Mock).mockRestore();
    });

    it('devrait retourner false si random >= 0.90 (échec aléatoire)', async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.95);
      const promise = (ticketService as any).simulatePayment(100, null);
      jest.runAllTimers();
      expect(await promise).toBe(false);
      (Math.random as jest.Mock).mockRestore();
    });
  });
});
