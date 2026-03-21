<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\Profile;
use App\Repository\ProfileRepository;
use App\Service\UserService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Tests unitaires pour UserService.
 *
 * Utilise des mocks pour isoler le service de ses dépendances.
 */
class UserServiceTest extends TestCase
{
    private UserService $userService;
    private MockObject&ProfileRepository $profileRepository;
    private MockObject&HttpClientInterface $httpClient;

    protected function setUp(): void
    {
        $this->profileRepository = $this->createMock(ProfileRepository::class);
        $this->httpClient = $this->createMock(HttpClientInterface::class);

        $this->userService = new UserService(
            $this->profileRepository,
            $this->httpClient,
            'http://ticket-service:8004', // ticketServiceUrl
        );
    }

    // TESTS DE CRÉATION

    public function testCreateProfileSuccessfully(): void
    {
        $uuid = Uuid::v4();

        // Pas de profil existant
        $this->profileRepository
            ->method('find')
            ->willReturn(null);

        $this->profileRepository
            ->expects($this->once())
            ->method('save');

        $profile = $this->userService->createProfile((string) $uuid, 'test@example.com');

        $this->assertSame('test@example.com', $profile->getEmail());
        $this->assertEquals($uuid, $profile->getId());
    }

    public function testCreateProfileThrowsExceptionForDuplicateId(): void
    {
        $uuid = Uuid::v4();

        // Profil existant
        $existingProfile = new Profile();
        $existingProfile->setId($uuid);

        $this->profileRepository
            ->method('find')
            ->willReturn($existingProfile);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Un profil avec cet ID existe déjà.');

        $this->userService->createProfile((string) $uuid, 'test@example.com');
    }

    // TESTS DE LECTURE

    public function testGetProfileReturnsProfile(): void
    {
        $uuid = Uuid::v4();
        $profile = new Profile();
        $profile->setId($uuid);
        $profile->setEmail('test@example.com');

        $this->profileRepository
            ->method('find')
            ->willReturn($profile);

        $result = $this->userService->getProfile((string) $uuid);
        $this->assertNotNull($result);
        $this->assertSame('test@example.com', $result->getEmail());
    }

    public function testGetProfileReturnsNullForNonExistent(): void
    {
        $this->profileRepository
            ->method('find')
            ->willReturn(null);

        $result = $this->userService->getProfile((string) Uuid::v4());
        $this->assertNull($result);
    }

    public function testListProfilesReturnsPaginatedResults(): void
    {
        $profile = new Profile();
        $profile->setId(Uuid::v4());
        $profile->setEmail('test@example.com');
        $profile->onPrePersist(); // Pour initialiser les timestamps

        $this->profileRepository
            ->method('findAllPaginated')
            ->with(1, 20)
            ->willReturn([$profile]);

        $this->profileRepository
            ->method('countAll')
            ->willReturn(1);

        $result = $this->userService->listProfiles(1, 20);

        $this->assertArrayHasKey('profiles', $result);
        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('page', $result);
        $this->assertArrayHasKey('limit', $result);
        $this->assertCount(1, $result['profiles']);
        $this->assertSame(1, $result['total']);
    }

    // TESTS DE MISE À JOUR

    public function testUpdateProfileModifiesFields(): void
    {
        $uuid = Uuid::v4();
        $profile = new Profile();
        $profile->setId($uuid);
        $profile->setEmail('test@example.com');

        $this->profileRepository
            ->method('find')
            ->willReturn($profile);

        $this->profileRepository
            ->expects($this->once())
            ->method('save');

        $result = $this->userService->updateProfile((string) $uuid, [
            'first_name' => 'Jean',
            'last_name' => 'Dupont',
            'phone' => '+33600000000',
        ]);

        $this->assertSame('Jean', $result->getFirstName());
        $this->assertSame('Dupont', $result->getLastName());
        $this->assertSame('+33600000000', $result->getPhone());
    }

    public function testUpdateProfileThrowsExceptionForNonExistent(): void
    {
        $this->profileRepository
            ->method('find')
            ->willReturn(null);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Profil introuvable.');

        $this->userService->updateProfile((string) Uuid::v4(), ['first_name' => 'Test']);
    }

    public function testUpdateProfileOnlyModifiesProvidedFields(): void
    {
        $uuid = Uuid::v4();
        $profile = new Profile();
        $profile->setId($uuid);
        $profile->setEmail('test@example.com');
        $profile->setFirstName('OriginalFirst');
        $profile->setLastName('OriginalLast');

        $this->profileRepository
            ->method('find')
            ->willReturn($profile);

        $this->profileRepository->method('save');

        // Ne modifier que le prénom
        $result = $this->userService->updateProfile((string) $uuid, [
            'first_name' => 'NouveauPrenom',
        ]);

        $this->assertSame('NouveauPrenom', $result->getFirstName());
        // Le nom de famille ne doit pas changer
        $this->assertSame('OriginalLast', $result->getLastName());
    }

    // TESTS DE SUPPRESSION

    public function testDeleteProfileSuccessfully(): void
    {
        $uuid = Uuid::v4();
        $profile = new Profile();
        $profile->setId($uuid);

        $this->profileRepository
            ->method('find')
            ->willReturn($profile);

        $this->profileRepository
            ->expects($this->once())
            ->method('remove')
            ->with($profile);

        $this->userService->deleteProfile((string) $uuid);
    }

    public function testDeleteProfileThrowsExceptionForNonExistent(): void
    {
        $this->profileRepository
            ->method('find')
            ->willReturn(null);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Profil introuvable.');

        $this->userService->deleteProfile((string) Uuid::v4());
    }

    // TESTS DES PERMISSIONS

    public function testIsAuthorizedReturnsTrueForOwner(): void
    {
        $userId = (string) Uuid::v4();
        $result = $this->userService->isAuthorized($userId, $userId, 'ROLE_USER');
        $this->assertTrue($result);
    }

    public function testIsAuthorizedReturnsTrueForAdmin(): void
    {
        $profileId = (string) Uuid::v4();
        $adminId = (string) Uuid::v4(); // Différent ID
        $result = $this->userService->isAuthorized($profileId, $adminId, 'ROLE_ADMIN');
        $this->assertTrue($result);
    }

    public function testIsAuthorizedReturnsFalseForOtherUser(): void
    {
        $profileId = (string) Uuid::v4();
        $otherId = (string) Uuid::v4(); // Différent ID
        $result = $this->userService->isAuthorized($profileId, $otherId, 'ROLE_USER');
        $this->assertFalse($result);
    }

    public function testIsAuthorizedReturnsFalseForEventCreatorOnOtherProfile(): void
    {
        $profileId = (string) Uuid::v4();
        $creatorId = (string) Uuid::v4();
        $result = $this->userService->isAuthorized($profileId, $creatorId, 'ROLE_EVENT_CREATOR');
        $this->assertFalse($result);
    }

    // TESTS DE SÉRIALISATION

    public function testSerializeProfileReturnsCorrectStructure(): void
    {
        $uuid = Uuid::v4();
        $profile = new Profile();
        $profile->setId($uuid);
        $profile->setEmail('test@example.com');
        $profile->setFirstName('Jean');
        $profile->setLastName('Dupont');
        $profile->setPhone('+33600000000');
        $profile->onPrePersist();

        $result = $this->userService->serializeProfile($profile);

        $this->assertArrayHasKey('id', $result);
        $this->assertArrayHasKey('email', $result);
        $this->assertArrayHasKey('first_name', $result);
        $this->assertArrayHasKey('last_name', $result);
        $this->assertArrayHasKey('phone', $result);
        $this->assertArrayHasKey('avatar_url', $result);
        $this->assertArrayHasKey('created_at', $result);
        $this->assertArrayHasKey('updated_at', $result);

        $this->assertSame((string) $uuid, $result['id']);
        $this->assertSame('test@example.com', $result['email']);
        $this->assertSame('Jean', $result['first_name']);
        $this->assertSame('Dupont', $result['last_name']);
    }
}
