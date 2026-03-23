<?php

namespace App\Tests\Service;

use App\Entity\Event;
use App\Repository\EventRepository;
use App\Service\EventService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\AbstractQuery;
use Doctrine\ORM\Query;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Uid\Uuid;

class EventServiceTest extends TestCase
{
    private $eventRepository;
    private $entityManager;
    private $eventService;

    protected function setUp(): void
    {
        $this->eventRepository = $this->createMock(EventRepository::class);
        $this->entityManager = $this->createMock(EntityManagerInterface::class);

        $this->eventService = new EventService(
            $this->eventRepository,
            $this->entityManager
        );
    }

    public function testCreateEvent(): void
    {
        $creatorId = Uuid::v4()->toRfc4122();
        $data = [
            'title'      => 'Test Event',
            'description' => 'Description test',
            'eventDate'  => '2025-01-01T10:00:00Z',
            'venue'      => 'Paris',
            'price'      => '50.00',
            'totalSeats' => 100,
            'status'     => 'PUBLISHED',
        ];

        $this->eventRepository->expects($this->once())
            ->method('save')
            ->with($this->isInstanceOf(Event::class), true);

        $event = $this->eventService->createEvent($data, $creatorId);

        $this->assertInstanceOf(Event::class, $event);
        $this->assertEquals('Test Event', $event->getTitle());
        $this->assertEquals(100, $event->getAvailableSeats());
        $this->assertEquals($creatorId, $event->getCreatorId()->toRfc4122());
    }

    public function testGetEventNotFound(): void
    {
        $this->eventRepository->method('find')->willReturn(null);

        $this->expectException(NotFoundHttpException::class);
        $this->eventService->getEvent('invalid-id');
    }

    public function testUpdateEventSuccess(): void
    {
        $creatorId = Uuid::v4()->toRfc4122();
        $eventId   = Uuid::v4()->toRfc4122();

        $event = new Event();
        $event->setCreatorId(Uuid::fromString($creatorId));
        $event->setTotalSeats(100);
        $event->setAvailableSeats(100);

        $this->eventRepository->method('find')
            ->with($eventId)
            ->willReturn($event);

        $this->entityManager->expects($this->once())
            ->method('flush');

        $updatedEvent = $this->eventService->updateEvent($eventId, ['title' => 'Updated Title'], $creatorId, ['ROLE_USER']);

        $this->assertEquals('Updated Title', $updatedEvent->getTitle());
    }

    public function testUpdateEventAccessDenied(): void
    {
        $creatorId   = Uuid::v4()->toRfc4122();
        $otherUserId = Uuid::v4()->toRfc4122();
        $eventId     = Uuid::v4()->toRfc4122();

        $event = new Event();
        $event->setCreatorId(Uuid::fromString($creatorId));

        $this->eventRepository->method('find')
            ->with($eventId)
            ->willReturn($event);

        $this->expectException(AccessDeniedHttpException::class);
        $this->eventService->updateEvent($eventId, ['title' => 'Updated Title'], $otherUserId, ['ROLE_USER']);
    }

    public function testReservePlacesSuccess(): void
    {
        $eventId = Uuid::v4()->toRfc4122();

        $event = new Event();
        $event->setAvailableSeats(10);

        $this->eventRepository->expects($this->once())
            ->method('find')
            ->with($eventId, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE)
            ->willReturn($event);

        $this->entityManager->expects($this->once())->method('flush');
        $this->entityManager->expects($this->once())->method('commit');

        $result = $this->eventService->reservePlaces($eventId, 5);

        $this->assertTrue($result);
        $this->assertEquals(5, $event->getAvailableSeats());
    }

    public function testReservePlacesNotEnough(): void
    {
        $eventId = Uuid::v4()->toRfc4122();

        $event = new Event();
        $event->setAvailableSeats(3);

        $this->eventRepository->expects($this->once())
            ->method('find')
            ->with($eventId, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE)
            ->willReturn($event);

        $this->entityManager->expects($this->once())->method('rollback');

        $result = $this->eventService->reservePlaces($eventId, 5);

        $this->assertFalse($result);
        $this->assertEquals(3, $event->getAvailableSeats());
    }
}
