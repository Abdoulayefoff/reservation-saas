import { TicketService } from '../src/services/ticketService';
import axios from 'axios';
import { RabbitMQService } from '../src/services/rabbitMqService';

// Setup Mocks
jest.mock('axios');
jest.mock('../src/services/rabbitMqService');

jest.mock('@prisma/client', () => {
  const mPrisma = {
    ticket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    paymentLog: {
      create: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

describe('TicketService', () => {
  let ticketService: TicketService;

  beforeEach(() => {
    ticketService = new TicketService();
    jest.clearAllMocks();

    // Setup RabbitMQ Mock
    RabbitMQService.getInstance = jest.fn().mockReturnValue({
      publishMessage: jest.fn().mockResolvedValue(true),
    });
  });

  describe('purchaseTicket', () => {
    it('should throw an error if event is not found', async () => {
      (axios.get as jest.Mock).mockRejectedValue({ response: { status: 404 } });

      await expect(
        ticketService.purchaseTicket('invalid-id', 'user-1', 1, null, null)
      ).rejects.toThrow();
    });

    it('should successfully purchase a ticket when everything is correct', async () => {
      // Mock Event Service responses
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          availableSeats: 10,
          price: 50.0,
          title: 'Test Event',
          eventDate: '2025-10-01T20:00:00Z',
          venue: 'Paris',
        },
      });
      (axios.patch as jest.Mock).mockResolvedValue({
        data: { message: 'Reserved' },
      });

      // Mock Prisma creation
      (prisma.ticket.create as jest.Mock).mockResolvedValue({
        id: 'tick-123',
        ticketNumber: 'TKT-2025-ABCDE',
        eventId: 'evt-1',
        eventTitle: 'Test Event',
        eventDate: new Date('2025-10-01T20:00:00Z'),
        venue: 'Paris',
        userId: 'user-1',
        pricePaid: 50,
        purchaseDate: new Date(),
        status: 'ACTIVE',
        paymentMethod: 'CARD',
        paymentStatus: 'COMPLETED',
      });

      (prisma.paymentLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });

      // Bypass payment simulation
      (ticketService as any).simulatePayment = jest.fn().mockResolvedValue(true);

      const tickets = await ticketService.purchaseTicket('evt-1', 'user-1', 1, 'user@test.fr', null);

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/events/evt-1'));
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/events/evt-1/reserve'),
        { quantity: 1 }
      );
      expect(prisma.ticket.create).toHaveBeenCalledTimes(1);
    });

    it('should throw error if available seats < quantity', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          availableSeats: 1,
          price: 50.0,
          title: 'Test Event',
          eventDate: '2025-10-01T20:00:00Z',
          venue: 'Paris',
        },
      });

      await expect(
        ticketService.purchaseTicket('evt-1', 'user-1', 5, null, null)
      ).rejects.toThrow('Not enough places available.');
    });
  });
});
