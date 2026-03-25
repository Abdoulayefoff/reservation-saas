import amqplib from 'amqplib';
import { RabbitMQService } from '../src/services/rabbitMqService';

jest.mock('amqplib');
const mockedAmqplib = amqplib as jest.Mocked<typeof amqplib>;

// Helpers

function makeMockChannel(publishReturn = true) {
  return {
    assertExchange: jest.fn().mockResolvedValue({}),
    publish:        jest.fn().mockReturnValue(publishReturn),
  };
}

function makeMockConnection(channel: ReturnType<typeof makeMockChannel>) {
  const closeHandlers: (() => void)[] = [];
  return {
    createChannel: jest.fn().mockResolvedValue(channel),
    on: jest.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'close') closeHandlers.push(cb);
    }),
    _triggerClose: () => closeHandlers.forEach((cb) => cb()),
  };
}

// Tests

describe('RabbitMQService', () => {

  beforeEach(() => {
    // Réinitialise le singleton entre chaque test
    (RabbitMQService as any).instance   = undefined;
    jest.clearAllMocks();
  });

  // getInstance

  describe('getInstance', () => {
    it('devrait retourner toujours la même instance (Singleton)', () => {
      const a = RabbitMQService.getInstance();
      const b = RabbitMQService.getInstance();
      expect(a).toBe(b);
    });
  });

  // connect

  describe('connect', () => {

    it('devrait se connecter avec succès et déclarer l\'exchange', async () => {
      const channel    = makeMockChannel();
      const connection = makeMockConnection(channel);
      mockedAmqplib.connect.mockResolvedValueOnce(connection as any);

      const service = RabbitMQService.getInstance();
      await service.connect(1, 0);

      expect(mockedAmqplib.connect).toHaveBeenCalledTimes(1);
      expect(connection.createChannel).toHaveBeenCalled();
      expect(channel.assertExchange).toHaveBeenCalledWith('ticket_events', 'topic', { durable: true });
      expect(connection.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('devrait ne rien faire si déjà connecté', async () => {
      const channel    = makeMockChannel();
      const connection = makeMockConnection(channel);
      mockedAmqplib.connect.mockResolvedValue(connection as any);

      const service = RabbitMQService.getInstance();
      await service.connect(1, 0);
      await service.connect(1, 0); // deuxième appel : connexion déjà établie

      expect(mockedAmqplib.connect).toHaveBeenCalledTimes(1);
    });

    it('devrait lever une erreur après épuisement de toutes les tentatives', async () => {
      mockedAmqplib.connect.mockRejectedValue(new Error('Connection refused'));

      const service = RabbitMQService.getInstance();

      await expect(service.connect(2, 0)).rejects.toThrow(
        '[RabbitMQ] Failed to connect after multiple retries.'
      );
      expect(mockedAmqplib.connect).toHaveBeenCalledTimes(2);
    });

    it('devrait se reconnecter quand la connexion se ferme', async () => {
      const channel    = makeMockChannel();
      const connection = makeMockConnection(channel);

      // Première connexion réussie, deuxième aussi (pour la reconnexion)
      mockedAmqplib.connect.mockResolvedValue(connection as any);

      const service = RabbitMQService.getInstance();
      await service.connect(1, 0);

      // Simule la fermeture de la connexion
      (service as any).connection = null;
      (service as any).channel    = null;
      (service as any).isConnecting = false;

      // La reconnexion est planifiée via setTimeout — on la déclenche manuellement
      jest.useFakeTimers();
      connection._triggerClose();
      jest.runAllTimers();
      jest.useRealTimers();

      // La propriété connection a été mise à null par le handler close
      expect((service as any).connection).toBeNull();
    });
  });

  // publishMessage

  describe('publishMessage', () => {

    it('devrait publier un message avec succès', async () => {
      const channel    = makeMockChannel(true);
      const connection = makeMockConnection(channel);
      mockedAmqplib.connect.mockResolvedValueOnce(connection as any);

      const service = RabbitMQService.getInstance();
      await service.connect(1, 0);

      const result = await service.publishMessage('ticket_events', 'ticket.confirmed', { id: '1' });

      expect(result).toBe(true);
      expect(channel.publish).toHaveBeenCalledWith(
        'ticket_events',
        'ticket.confirmed',
        expect.any(Buffer),
        { persistent: true }
      );
    });

    it('devrait retourner false si le channel n\'est pas disponible', async () => {
      const service = RabbitMQService.getInstance();
      // Pas de connexion établie → channel est null

      const result = await service.publishMessage('ticket_events', 'ticket.confirmed', { id: '1' });

      expect(result).toBe(false);
    });

    it('devrait retourner false si channel.publish lève une exception', async () => {
      const channel    = makeMockChannel();
      channel.publish  = jest.fn().mockImplementation(() => { throw new Error('Channel closed'); });
      const connection = makeMockConnection(channel);
      mockedAmqplib.connect.mockResolvedValueOnce(connection as any);

      const service = RabbitMQService.getInstance();
      await service.connect(1, 0);

      const result = await service.publishMessage('ticket_events', 'ticket.confirmed', { id: '1' });

      expect(result).toBe(false);
    });

    it('devrait sérialiser le message en JSON Buffer', async () => {
      const channel    = makeMockChannel(true);
      const connection = makeMockConnection(channel);
      mockedAmqplib.connect.mockResolvedValueOnce(connection as any);

      const service  = RabbitMQService.getInstance();
      await service.connect(1, 0);

      const message = { ticketId: 'abc', userId: 'user-1' };
      await service.publishMessage('ticket_events', 'ticket.confirmed', message);

      const calledBuffer: Buffer = channel.publish.mock.calls[0][2];
      expect(JSON.parse(calledBuffer.toString())).toEqual(message);
    });
  });
});
