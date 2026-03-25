<?php

namespace App\Tests\Controller;

use App\Service\EventService;
use App\Entity\Event;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\Uid\Uuid;

class EventControllerTest extends WebTestCase
{
    private $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();

        // Disable reboot between requests to preserve our mocked service
        $this->client->disableReboot();

        // Create a mock for EventService
        $eventServiceMock = $this->createMock(EventService::class);

        $mockEvent = current($this->getMockEvents());

        $eventServiceMock->method('createEvent')->willReturn($mockEvent);
        $eventServiceMock->method('listEvents')->willReturn($this->getMockEvents());
        $eventServiceMock->method('getEvent')->willReturn($mockEvent);
        $eventServiceMock->method('updateEvent')->willReturn($mockEvent);

        // Inject the mock into the container
        static::getContainer()->set(EventService::class, $eventServiceMock);
    }

    private function getMockEvents(): array
    {
        $event = new Event();
        $event->setTitle('Test Event');
        $event->setAvailableSeats(100);
        $reflectionId = new \ReflectionProperty(Event::class, 'id');
        $reflectionId->setAccessible(true);
        $reflectionId->setValue($event, Uuid::v4());

        return [$event];
    }

    public function testCreateEventUnauthorized(): void
    {
        $this->client->request('POST', '/events', [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title'      => 'Concert',
            'eventDate'  => '2025-05-01T20:00:00Z',
            'venue'      => 'Stadium',
            'price'      => '150.00',
            'totalSeats' => 5000,
            'status'     => 'PUBLISHED',
        ]));

        $this->assertResponseStatusCodeSame(401);
    }

    public function testCreateEventSuccess(): void
    {
        $userId = Uuid::v4()->toRfc4122();

        $this->client->request('POST', '/events', [], [], [
            'CONTENT_TYPE'     => 'application/json',
            'HTTP_X_USER_ID'   => $userId,
            'HTTP_X_USER_ROLES' => 'ROLE_ORGANIZER',
        ], json_encode([
            'title'      => 'Tech Conference 2025',
            'eventDate'  => '2025-10-15T09:00:00Z',
            'venue'      => 'Convention Center',
            'price'      => '299.99',
            'totalSeats' => 1000,
            'status'     => 'PUBLISHED',
        ]));

        $this->assertResponseStatusCodeSame(201);
        $content = json_decode($this->client->getResponse()->getContent(), true);
        if (!isset($content['id'])) {
            var_dump($this->client->getResponse()->getContent());
        }

        $this->assertArrayHasKey('id', $content);
        $this->assertEquals('Test Event', $content['title']);
        $this->assertEquals(100, $content['availableSeats']);
    }

    public function testListEvents(): void
    {
        $this->client->request('GET', '/events');

        $this->assertResponseIsSuccessful();
        $this->assertResponseHeaderSame('content-type', 'application/json');

        $content = json_decode($this->client->getResponse()->getContent(), true);
        $this->assertIsArray($content);
        $this->assertGreaterThan(0, count($content));
    }

    public function testUpdateEventUnauthorized(): void
    {
        $eventId = Uuid::v4()->toRfc4122();

        $this->client->request('PUT', '/events/' . $eventId, [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'title' => 'Updated Title',
        ]));

        $this->assertResponseStatusCodeSame(401);
    }
}
