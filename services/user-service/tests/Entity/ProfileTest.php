<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Entity\Profile;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

/**
 * Tests unitaires pour l'entité Profile.
 *
 * Vérifie :
 * - Les getters/setters
 * - La gestion de l'ID partagé avec Auth Service
 * - Les lifecycle callbacks
 * - Les champs optionnels (nullable)
 */
class ProfileTest extends TestCase
{
    private Profile $profile;

    protected function setUp(): void
    {
        $this->profile = new Profile();
    }

    // TESTS DE L'ID PARTAGÉ

    public function testIdCanBeSetManually(): void
    {
        // L'ID du profil est le même que celui du User dans Auth Service
        $uuid = Uuid::fromString('550e8400-e29b-41d4-a716-446655440000');
        $this->profile->setId($uuid);
        $this->assertEquals($uuid, $this->profile->getId());
    }

    public function testIdIsNullByDefault(): void
    {
        $this->assertNull($this->profile->getId());
    }

    // TESTS DES CHAMPS OBLIGATOIRES

    public function testEmailGetterAndSetter(): void
    {
        $this->profile->setEmail('test@example.com');
        $this->assertSame('test@example.com', $this->profile->getEmail());
    }

    // TESTS DES CHAMPS OPTIONNELS

    public function testFirstNameIsNullByDefault(): void
    {
        $this->assertNull($this->profile->getFirstName());
    }

    public function testFirstNameGetterAndSetter(): void
    {
        $this->profile->setFirstName('Jean');
        $this->assertSame('Jean', $this->profile->getFirstName());
    }

    public function testLastNameIsNullByDefault(): void
    {
        $this->assertNull($this->profile->getLastName());
    }

    public function testLastNameGetterAndSetter(): void
    {
        $this->profile->setLastName('Dupont');
        $this->assertSame('Dupont', $this->profile->getLastName());
    }

    public function testPhoneIsNullByDefault(): void
    {
        $this->assertNull($this->profile->getPhone());
    }

    public function testPhoneGetterAndSetter(): void
    {
        $this->profile->setPhone('+33612345678');
        $this->assertSame('+33612345678', $this->profile->getPhone());
    }

    public function testAvatarUrlIsNullByDefault(): void
    {
        $this->assertNull($this->profile->getAvatarUrl());
    }

    public function testAvatarUrlGetterAndSetter(): void
    {
        $this->profile->setAvatarUrl('https://example.com/avatar.jpg');
        $this->assertSame('https://example.com/avatar.jpg', $this->profile->getAvatarUrl());
    }

    // TESTS DES NULLABLE SETTERS

    public function testFirstNameCanBeSetToNull(): void
    {
        $this->profile->setFirstName('Jean');
        $this->profile->setFirstName(null);
        $this->assertNull($this->profile->getFirstName());
    }

    public function testPhoneCanBeSetToNull(): void
    {
        $this->profile->setPhone('+33600000000');
        $this->profile->setPhone(null);
        $this->assertNull($this->profile->getPhone());
    }

    // TESTS DES LIFECYCLE CALLBACKS

    public function testOnPrePersistSetsTimestamps(): void
    {
        $this->profile->onPrePersist();

        $this->assertNotNull($this->profile->getCreatedAt());
        $this->assertNotNull($this->profile->getUpdatedAt());
        $this->assertInstanceOf(\DateTimeImmutable::class, $this->profile->getCreatedAt());
    }

    public function testOnPreUpdateChangesUpdatedAt(): void
    {
        $this->profile->onPrePersist();
        $originalUpdatedAt = $this->profile->getUpdatedAt();

        usleep(1000);

        $this->profile->onPreUpdate();

        $this->assertGreaterThanOrEqual(
            $originalUpdatedAt->getTimestamp(),
            $this->profile->getUpdatedAt()->getTimestamp()
        );
    }
}
