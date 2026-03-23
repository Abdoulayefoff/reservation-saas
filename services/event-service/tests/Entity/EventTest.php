<?php

namespace App\Tests\Entity;

use App\Entity\Event;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

class EventTest extends TestCase
{
    public function testEventDefaults(): void
    {
        $event = new Event();

        $this->assertFalse($event->isPublished());
        $this->assertInstanceOf(\DateTimeImmutable::class, $event->getCreatedAt());
        $this->assertInstanceOf(\DateTimeInterface::class, $event->getUpdatedAt());
        $this->assertNull($event->getId());
        $this->assertNull($event->getTitle());
        $this->assertNull($event->getDescription());
        $this->assertNull($event->getEventDate());
        $this->assertNull($event->getVenue());
        $this->assertNull($event->getPrice());
        $this->assertNull($event->getTotalSeats());
        $this->assertNull($event->getAvailableSeats());
        $this->assertNull($event->getCreatorId());
    }

    public function testGettersAndSetters(): void
    {
        $event = new Event();

        $title = 'Sample Event';
        $event->setTitle($title);
        $this->assertEquals($title, $event->getTitle());

        $description = 'This is an event description';
        $event->setDescription($description);
        $this->assertEquals($description, $event->getDescription());

        $date = new \DateTime('+1 day');
        $event->setEventDate($date);
        $this->assertEquals($date, $event->getEventDate());

        $venue = 'Paris';
        $event->setVenue($venue);
        $this->assertEquals($venue, $event->getVenue());

        $price = '100.50';
        $event->setPrice($price);
        $this->assertEquals($price, $event->getPrice());

        $totalSeats = 200;
        $event->setTotalSeats($totalSeats);
        $this->assertEquals($totalSeats, $event->getTotalSeats());

        $availableSeats = 150;
        $event->setAvailableSeats($availableSeats);
        $this->assertEquals($availableSeats, $event->getAvailableSeats());

        $creatorId = Uuid::v4();
        $event->setCreatorId($creatorId);
        $this->assertEquals($creatorId, $event->getCreatorId());

        $event->setStatus(Event::STATUS_PUBLISHED);
        $this->assertTrue($event->isPublished());

        $createdAt = new \DateTimeImmutable('2020-01-01');
        $event->setCreatedAt($createdAt);
        $this->assertEquals($createdAt, $event->getCreatedAt());

        $updatedAt = new \DateTime('2022-01-01');
        $event->setUpdatedAt($updatedAt);
        $this->assertEquals($updatedAt, $event->getUpdatedAt());
    }

    public function testPreUpdateLifecycleCallback(): void
    {
        $event = new Event();
        $initialUpdatedAt = $event->getUpdatedAt();

        // Simulate some time passing (in a real scenario, this would be negligible or mocked)
        sleep(1);

        $event->setUpdatedAtValue();

        $this->assertNotEquals($initialUpdatedAt->format('Y-m-d H:i:s'), $event->getUpdatedAt()->format('Y-m-d H:i:s'));
        $this->assertGreaterThan($initialUpdatedAt, $event->getUpdatedAt());
    }
}
