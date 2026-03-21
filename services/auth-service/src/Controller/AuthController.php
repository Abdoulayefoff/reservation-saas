<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\AuthService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use OpenApi\Attributes as OA;

/**
 * Contrôleur d'authentification – Gère toutes les opérations d'auth.
 *
 * Routes :
 * - POST /auth/register  – Inscription
 * - POST /auth/login     – Connexion (retourne JWT + refresh token)
 * - POST /auth/logout    – Déconnexion (invalide refresh tokens)
 * - POST /auth/refresh   – Renouvelle le JWT via refresh token
 * - GET  /auth/me        – Retourne l'utilisateur connecté
 * - GET  /auth/validate  – Valide le JWT (endpoint interne pour Gateway)
 */
class AuthController extends AbstractController
{
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    // POST /auth/register – Inscription d'un nouvel utilisateur

    #[Route('/auth/register', name: 'auth_register', methods: ['POST'])]
    #[OA\Post(
        summary: "Inscription d'un nouvel utilisateur",
        description: "Crée un compte utilisateur avec email et mot de passe. Un profil est automatiquement créé dans le User Service.",
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['email', 'password'],
            properties: [
                new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                new OA\Property(property: 'password', type: 'string', format: 'password', example: 'SecureP@ss123', minLength: 8),
                new OA\Property(property: 'role', type: 'string', enum: ['ROLE_USER', 'ROLE_EVENT_CREATOR'], example: 'ROLE_USER'),
            ]
        )
    )]
    #[OA\Response(response: 201, description: 'Utilisateur créé avec succès')]
    #[OA\Response(response: 400, description: 'Données invalides')]
    #[OA\Response(response: 409, description: 'Email déjà utilisé')]
    public function register(Request $request): JsonResponse
    {
        // Décoder le corps de la requête JSON
        $data = json_decode($request->getContent(), true);

        // Validation des champs obligatoires
        if (empty($data['email']) || empty($data['password'])) {
            return $this->json([
                'error' => 'Les champs email et password sont obligatoires.',
            ], Response::HTTP_BAD_REQUEST);
        }

        // Validation du format email
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->json([
                'error' => "L'email n'est pas valide.",
            ], Response::HTTP_BAD_REQUEST);
        }

        // Validation de la longueur du mot de passe (minimum 8 caractères)
        if (strlen($data['password']) < 8) {
            return $this->json([
                'error' => 'Le mot de passe doit contenir au moins 8 caractères.',
            ], Response::HTTP_BAD_REQUEST);
        }

        // Déterminer le rôle (ROLE_USER par défaut)
        $roles = ['ROLE_USER'];
        if (!empty($data['role']) && in_array($data['role'], ['ROLE_USER', 'ROLE_EVENT_CREATOR'])) {
            $roles = [$data['role']];
        }

        try {
            $user = $this->authService->register($data['email'], $data['password'], $roles);

            return $this->json([
                'message' => 'Inscription réussie.',
                'user' => $this->authService->serializeUser($user),
            ], Response::HTTP_CREATED);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_CONFLICT);
        } catch (\Throwable $e) {
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // POST /auth/login – Connexion

    #[Route('/auth/login', name: 'auth_login', methods: ['POST'])]
    #[OA\Post(
        summary: 'Connexion utilisateur',
        description: 'Authentifie un utilisateur et retourne un JWT + refresh token.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['email', 'password'],
            properties: [
                new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                new OA\Property(property: 'password', type: 'string', format: 'password', example: 'SecureP@ss123'),
            ]
        )
    )]
    #[OA\Response(response: 200, description: 'Connexion réussie – retourne JWT et refresh token')]
    #[OA\Response(response: 401, description: 'Identifiants incorrects')]
    public function login(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        // Validation des champs obligatoires
        if (empty($data['email']) || empty($data['password'])) {
            return $this->json([
                'error' => 'Les champs email et password sont obligatoires.',
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            $result = $this->authService->login($data['email'], $data['password']);

            return $this->json([
                'message' => 'Connexion réussie.',
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'user' => $result['user'],
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_UNAUTHORIZED);
        } catch (\Throwable $e) {
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // POST /auth/logout – Déconnexion

    #[Route('/auth/logout', name: 'auth_logout', methods: ['POST'])]
    #[OA\Post(
        summary: 'Déconnexion utilisateur',
        description: 'Invalide tous les refresh tokens de l\'utilisateur. Le JWT reste valide jusqu\'à son expiration.',
        tags: ['Auth'],
        security: [['Bearer' => []]],
    )]
    #[OA\Response(response: 200, description: 'Déconnexion réussie')]
    #[OA\Response(response: 401, description: 'Non authentifié')]
    public function logout(): JsonResponse
    {
        // Récupérer l'utilisateur connecté via le JWT
        $user = $this->getUser();

        if (!$user) {
            return $this->json([
                'error' => 'Non authentifié.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        $this->authService->logout($user);

        return $this->json([
            'message' => 'Déconnexion réussie.',
        ]);
    }

    // POST /auth/refresh – Renouvellement du JWT

    #[Route('/auth/refresh', name: 'auth_refresh', methods: ['POST'])]
    #[OA\Post(
        summary: 'Renouveler le JWT',
        description: 'Échange un refresh token valide contre un nouveau JWT et un nouveau refresh token.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            required: ['refresh_token'],
            properties: [
                new OA\Property(property: 'refresh_token', type: 'string', description: 'Le refresh token obtenu lors du login'),
            ]
        )
    )]
    #[OA\Response(response: 200, description: 'Token renouvelé')]
    #[OA\Response(response: 401, description: 'Refresh token invalide ou expiré')]
    public function refresh(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (empty($data['refresh_token'])) {
            return $this->json([
                'error' => 'Le refresh_token est obligatoire.',
            ], Response::HTTP_BAD_REQUEST);
        }

        try {
            $result = $this->authService->refresh($data['refresh_token']);

            return $this->json([
                'message' => 'Token renouvelé.',
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'user' => $result['user'],
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_UNAUTHORIZED);
        } catch (\Throwable $e) {
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // GET /auth/me – Informations de l'utilisateur connecté

    #[Route('/auth/me', name: 'auth_me', methods: ['GET'])]
    #[OA\Get(
        summary: 'Profil de l\'utilisateur connecté',
        description: 'Retourne les informations de l\'utilisateur authentifié par le JWT.',
        tags: ['Auth'],
        security: [['Bearer' => []]],
    )]
    #[OA\Response(response: 200, description: 'Informations utilisateur')]
    #[OA\Response(response: 401, description: 'Non authentifié')]
    public function me(): JsonResponse
    {
        $user = $this->getUser();

        if (!$user) {
            return $this->json([
                'error' => 'Non authentifié.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json([
            'user' => $this->authService->serializeUser($user),
        ]);
    }

    // GET /auth/validate – Validation interne du JWT

    #[Route('/auth/validate', name: 'auth_validate', methods: ['GET'])]
    #[OA\Get(
        summary: 'Valider un JWT (endpoint interne)',
        description: 'Endpoint utilisé par l\'API Gateway pour valider un token JWT et obtenir les infos utilisateur.',
        tags: ['Auth'],
        security: [['Bearer' => []]],
    )]
    #[OA\Response(response: 200, description: 'Token valide')]
    #[OA\Response(response: 401, description: 'Token invalide')]
    public function validate(): JsonResponse
    {
        $user = $this->getUser();

        if (!$user) {
            return $this->json([
                'valid' => false,
                'error' => 'Token invalide.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        // Retourner les données utilisateur pour l'API Gateway
        // La Gateway injectera X-User-Id et X-User-Roles dans les headers
        return $this->json([
            'valid' => true,
            'user' => $this->authService->serializeUser($user),
        ]);
    }
}
