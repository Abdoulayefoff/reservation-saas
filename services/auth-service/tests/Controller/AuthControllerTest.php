<?php

declare(strict_types=1);

namespace App\Tests\Controller;

use App\Controller\AuthController;
use App\Service\AuthService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Serializer\SerializerInterface;

/**
 * Tests unitaires pour AuthController.
 *
 * Teste la validation des inputs et la délégation au AuthService.
 * Le container Symfony est mocké pour que json() fonctionne.
 */
class AuthControllerTest extends TestCase
{
    private AuthController $controller;
    private MockObject&AuthService $authService;

    protected function setUp(): void
    {
        $this->authService = $this->createMock(AuthService::class);
        $this->controller = new AuthController($this->authService);

        // Mocker le container pour que AbstractController::json() fonctionne
        $container = $this->createMock(ContainerInterface::class);
        $container->method('has')->willReturnMap([
            ['serializer', true],
            ['twig', false],
        ]);
        $serializer = $this->createMock(SerializerInterface::class);
        $serializer->method('serialize')->willReturnCallback(
            fn($data, $format) => json_encode($data)
        );
        $container->method('get')->willReturnMap([
            ['serializer', $serializer],
        ]);
        $this->controller->setContainer($container);
    }

    // TESTS D'INSCRIPTION – VALIDATION DES INPUTS

    public function testRegisterReturns400ForMissingEmail(): void
    {
        $request = new Request(content: json_encode(['password' => 'test12345']));
        $response = $this->controller->register($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    public function testRegisterReturns400ForMissingPassword(): void
    {
        $request = new Request(content: json_encode(['email' => 'test@example.com']));
        $response = $this->controller->register($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testRegisterReturns400ForInvalidEmail(): void
    {
        $request = new Request(content: json_encode([
            'email' => 'not_an_email',
            'password' => 'test12345',
        ]));
        $response = $this->controller->register($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertStringContainsString('email', $data['error']);
    }

    public function testRegisterReturns400ForShortPassword(): void
    {
        $request = new Request(content: json_encode([
            'email' => 'test@example.com',
            'password' => '1234567', // 7 chars, minimum is 8
        ]));
        $response = $this->controller->register($request);

        $this->assertSame(400, $response->getStatusCode());
        $data = json_decode($response->getContent(), true);
        $this->assertStringContainsString('8 caractères', $data['error']);
    }

    public function testRegisterReturns409ForDuplicateEmail(): void
    {
        $this->authService
            ->method('register')
            ->willThrowException(new \InvalidArgumentException('Un compte avec cet email existe déjà.'));

        $request = new Request(content: json_encode([
            'email' => 'existing@example.com',
            'password' => 'SecureP@ss123',
        ]));
        $response = $this->controller->register($request);

        $this->assertSame(409, $response->getStatusCode());
    }

    // TESTS DE CONNEXION – VALIDATION DES INPUTS

    public function testLoginReturns400ForMissingFields(): void
    {
        $request = new Request(content: json_encode([]));
        $response = $this->controller->login($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testLoginReturns401ForInvalidCredentials(): void
    {
        $this->authService
            ->method('login')
            ->willThrowException(new \InvalidArgumentException('Email ou mot de passe incorrect.'));

        $request = new Request(content: json_encode([
            'email' => 'user@example.com',
            'password' => 'wrong_password',
        ]));
        $response = $this->controller->login($request);

        $this->assertSame(401, $response->getStatusCode());
    }

    // TESTS DE RENOUVELLEMENT – VALIDATION DES INPUTS

    public function testRefreshReturns400ForMissingToken(): void
    {
        $request = new Request(content: json_encode([]));
        $response = $this->controller->refresh($request);

        $this->assertSame(400, $response->getStatusCode());
    }

    public function testRefreshReturns401ForInvalidToken(): void
    {
        $this->authService
            ->method('refresh')
            ->willThrowException(new \InvalidArgumentException('Refresh token invalide.'));

        $request = new Request(content: json_encode([
            'refresh_token' => 'invalid_token',
        ]));
        $response = $this->controller->refresh($request);

        $this->assertSame(401, $response->getStatusCode());
    }
}
