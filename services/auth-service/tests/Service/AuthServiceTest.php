<?php

declare(strict_types=1);

namespace App\Tests\Service;

use App\Entity\RefreshToken;
use App\Entity\User;
use App\Repository\RefreshTokenRepository;
use App\Repository\UserRepository;
use App\Service\AuthService;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

/**
 * Tests unitaires pour AuthService.
 *
 * Utilise des mocks pour isoler le service de ses dépendances
 * (DB, JWT, HTTP client, password hasher).
 */
class AuthServiceTest extends TestCase
{
    private AuthService $authService;
    private MockObject&UserRepository $userRepository;
    private MockObject&RefreshTokenRepository $refreshTokenRepository;
    private MockObject&UserPasswordHasherInterface $passwordHasher;
    private MockObject&JWTTokenManagerInterface $jwtManager;
    private MockObject&HttpClientInterface $httpClient;

    protected function setUp(): void
    {
        $this->userRepository = $this->createMock(UserRepository::class);
        $this->refreshTokenRepository = $this->createMock(RefreshTokenRepository::class);
        $this->passwordHasher = $this->createMock(UserPasswordHasherInterface::class);
        $this->jwtManager = $this->createMock(JWTTokenManagerInterface::class);
        $this->httpClient = $this->createMock(HttpClientInterface::class);

        $this->authService = new AuthService(
            $this->userRepository,
            $this->refreshTokenRepository,
            $this->passwordHasher,
            $this->jwtManager,
            $this->httpClient,
            'http://user-service:8002', // userServiceUrl
            604800, // jwtRefreshTtl (7 jours)
        );
    }

    // TESTS D'INSCRIPTION

    public function testRegisterCreatesUserSuccessfully(): void
    {
        // L'email n'existe pas encore
        $this->userRepository
            ->method('findByEmail')
            ->with('new@example.com')
            ->willReturn(null);

        // Le hashage du mot de passe fonctionne
        $this->passwordHasher
            ->method('hashPassword')
            ->willReturn('$2y$12$hashed_password');

        // La sauvegarde est appelée
        $this->userRepository
            ->expects($this->once())
            ->method('save');

        // L'appel HTTP vers le User Service (création du profil)
        $response = $this->createMock(ResponseInterface::class);
        $this->httpClient
            ->method('request')
            ->willReturn($response);

        $user = $this->authService->register('new@example.com', 'SecureP@ss123');

        $this->assertSame('new@example.com', $user->getEmail());
        $this->assertSame('$2y$12$hashed_password', $user->getPassword());
        $this->assertContains('ROLE_USER', $user->getRoles());
    }

    public function testRegisterThrowsExceptionForDuplicateEmail(): void
    {
        // L'email existe déjà
        $existingUser = new User();
        $existingUser->setEmail('existing@example.com');

        $this->userRepository
            ->method('findByEmail')
            ->with('existing@example.com')
            ->willReturn($existingUser);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Un compte avec cet email existe déjà.');

        $this->authService->register('existing@example.com', 'password123');
    }

    public function testRegisterWithCustomRole(): void
    {
        $this->userRepository->method('findByEmail')->willReturn(null);
        $this->passwordHasher->method('hashPassword')->willReturn('hashed');
        $this->userRepository->expects($this->once())->method('save');

        $response = $this->createMock(ResponseInterface::class);
        $this->httpClient->method('request')->willReturn($response);

        $user = $this->authService->register(
            'creator@example.com',
            'password123',
            ['ROLE_EVENT_CREATOR']
        );

        $this->assertContains('ROLE_EVENT_CREATOR', $user->getRoles());
    }

    // TESTS DE CONNEXION

    public function testLoginReturnsTokensForValidCredentials(): void
    {
        // Créer un utilisateur mock avec un ID
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(Uuid::v4());
        $user->method('getEmail')->willReturn('user@example.com');
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('isActive')->willReturn(true);
        $user->method('getCreatedAt')->willReturn(new \DateTimeImmutable());
        $user->method('getUpdatedAt')->willReturn(new \DateTimeImmutable());

        $this->userRepository
            ->method('findByEmail')
            ->with('user@example.com')
            ->willReturn($user);

        // Mot de passe valide
        $this->passwordHasher
            ->method('isPasswordValid')
            ->with($user, 'correct_password')
            ->willReturn(true);

        // JWT généré
        $this->jwtManager
            ->method('create')
            ->with($user)
            ->willReturn('jwt_token_here');

        // Refresh token: supprimer les anciens + sauvegarder le nouveau
        $this->refreshTokenRepository
            ->method('removeAllForUser');
        $this->refreshTokenRepository
            ->expects($this->once())
            ->method('save');

        $result = $this->authService->login('user@example.com', 'correct_password');

        // Vérifier la structure de la réponse
        $this->assertArrayHasKey('token', $result);
        $this->assertArrayHasKey('refresh_token', $result);
        $this->assertArrayHasKey('user', $result);
        $this->assertSame('jwt_token_here', $result['token']);
        $this->assertNotEmpty($result['refresh_token']);
    }

    public function testLoginThrowsExceptionForInvalidPassword(): void
    {
        $user = new User();
        $user->setEmail('user@example.com');

        $this->userRepository
            ->method('findByEmail')
            ->willReturn($user);

        // Mot de passe invalide
        $this->passwordHasher
            ->method('isPasswordValid')
            ->willReturn(false);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Email ou mot de passe incorrect.');

        $this->authService->login('user@example.com', 'wrong_password');
    }

    public function testLoginThrowsExceptionForNonExistentUser(): void
    {
        $this->userRepository
            ->method('findByEmail')
            ->willReturn(null);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Email ou mot de passe incorrect.');

        $this->authService->login('nonexistent@example.com', 'password');
    }

    public function testLoginThrowsExceptionForInactiveUser(): void
    {
        $user = new User();
        $user->setEmail('inactive@example.com');
        $user->setPassword('hashed');
        $user->setIsActive(false);

        $this->userRepository
            ->method('findByEmail')
            ->willReturn($user);

        $this->passwordHasher
            ->method('isPasswordValid')
            ->willReturn(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Ce compte a été désactivé.');

        $this->authService->login('inactive@example.com', 'password');
    }

    // TESTS DE DÉCONNEXION

    public function testLogoutRemovesAllRefreshTokens(): void
    {
        $userId = Uuid::v4();
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($userId);

        // On vérifie que removeAllForUser est appelé avec le bon userId
        $this->refreshTokenRepository
            ->expects($this->once())
            ->method('removeAllForUser')
            ->with($userId);

        $this->authService->logout($user);
    }

    // TESTS DE SÉRIALISATION

    public function testSerializeUserReturnsCorrectStructure(): void
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(Uuid::fromString('550e8400-e29b-41d4-a716-446655440000'));
        $user->method('getEmail')->willReturn('test@example.com');
        $user->method('getRoles')->willReturn(['ROLE_USER']);
        $user->method('isActive')->willReturn(true);
        $user->method('getCreatedAt')->willReturn(new \DateTimeImmutable('2026-01-01 00:00:00'));
        $user->method('getUpdatedAt')->willReturn(new \DateTimeImmutable('2026-01-01 00:00:00'));

        $result = $this->authService->serializeUser($user);

        $this->assertArrayHasKey('id', $result);
        $this->assertArrayHasKey('email', $result);
        $this->assertArrayHasKey('roles', $result);
        $this->assertArrayHasKey('is_active', $result);
        $this->assertArrayHasKey('created_at', $result);
        $this->assertArrayHasKey('updated_at', $result);

        // Vérifier que le mot de passe n'est JAMAIS dans la sérialisation
        $this->assertArrayNotHasKey('password', $result);

        $this->assertSame('550e8400-e29b-41d4-a716-446655440000', $result['id']);
        $this->assertSame('test@example.com', $result['email']);
        $this->assertTrue($result['is_active']);
    }
}
