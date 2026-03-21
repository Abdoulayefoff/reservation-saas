<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Entity\RefreshToken;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;

/**
 * Tests unitaires pour l'entité RefreshToken.
 *
 * Vérifie :
 * - Les getters/setters
 * - La logique d'expiration
 * - Les lifecycle callbacks
 */
class RefreshTokenTest extends TestCase
{
    private RefreshToken $refreshToken;

    protected function setUp(): void
    {
        $this->refreshToken = new RefreshToken();
    }

    // TESTS DES GETTERS/SETTERS

    public function testIdIsNullByDefault(): void
    {
        $this->assertNull($this->refreshToken->getId());
    }

    public function testUserIdGetterAndSetter(): void
    {
        $uuid = Uuid::v4();
        $this->refreshToken->setUserId($uuid);
        $this->assertEquals($uuid, $this->refreshToken->getUserId());
    }

    public function testTokenGetterAndSetter(): void
    {
        $hashedToken = hash('sha256', 'raw_token_value');
        $this->refreshToken->setToken($hashedToken);
        $this->assertSame($hashedToken, $this->refreshToken->getToken());
    }

    public function testExpiresAtGetterAndSetter(): void
    {
        $expiresAt = new \DateTimeImmutable('+7 days');
        $this->refreshToken->setExpiresAt($expiresAt);
        $this->assertEquals($expiresAt, $this->refreshToken->getExpiresAt());
    }

    // TESTS DE LA LOGIQUE D'EXPIRATION

    public function testIsExpiredReturnsFalseForFutureDate(): void
    {
        // Token expirant dans 7 jours → pas expiré
        $this->refreshToken->setExpiresAt(new \DateTimeImmutable('+7 days'));
        $this->assertFalse($this->refreshToken->isExpired());
    }

    public function testIsExpiredReturnsTrueForPastDate(): void
    {
        // Token expiré depuis 1 jour → expiré
        $this->refreshToken->setExpiresAt(new \DateTimeImmutable('-1 day'));
        $this->assertTrue($this->refreshToken->isExpired());
    }

    public function testIsExpiredReturnsTrueForPastSeconds(): void
    {
        // Token expiré depuis 1 seconde → expiré
        $this->refreshToken->setExpiresAt(new \DateTimeImmutable('-1 second'));
        $this->assertTrue($this->refreshToken->isExpired());
    }

    // TESTS DES LIFECYCLE CALLBACKS

    public function testOnPrePersistSetsCreatedAt(): void
    {
        $this->refreshToken->onPrePersist();
        $this->assertNotNull($this->refreshToken->getCreatedAt());
        $this->assertInstanceOf(\DateTimeImmutable::class, $this->refreshToken->getCreatedAt());
    }
}
