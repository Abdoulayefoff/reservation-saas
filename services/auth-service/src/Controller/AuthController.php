<?php

declare(strict_types=1); // Force le typage strict pour éviter les coercitions implicites

namespace App\Controller;

use App\Service\AuthService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route; 
use OpenApi\Attributes as OA; // Alias pour les annotations Swagger/OpenAPI

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
    // Constructeur avec injection de dépendances automatique
    public function __construct(
        private readonly AuthService $authService,
    ) {}

    // ─── POST /auth/register – Inscription d'un nouvel utilisateur

    #[Route('/auth/register', name: 'auth_register', methods: ['POST'])] // Route POST /auth/register
    #[OA\Post( // Début documentation Swagger
        summary: "Inscription d'un nouvel utilisateur", // Titre court
        description: "Crée un compte utilisateur avec email et mot de passe. Un profil est automatiquement créé dans le User Service.", // Détail
        tags: ['Auth'], // Catégorie Swagger
    )] // Fin Post
    #[OA\RequestBody( // Description du corps attendu
        required: true, 
        content: new OA\JsonContent( // Format JSON
            required: ['email', 'password'], // Champs requis
            properties: [ // Définition des propriétés
                new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'), // Champ Email
                new OA\Property(property: 'password', type: 'string', format: 'password', example: 'SecureP@ss123', minLength: 8), // Mot de passe
                new OA\Property(property: 'role', type: 'string', enum: ['ROLE_USER', 'ROLE_EVENT_CREATOR'], example: 'ROLE_USER'), // Rôle
            ]
        )
    )]
    #[OA\Response(response: 201, description: 'Utilisateur créé avec succès')] // Réponse Succès
    #[OA\Response(response: 400, description: 'Données invalides')] // Réponse Erreur syntaxe
    #[OA\Response(response: 409, description: 'Email déjà utilisé')] // Réponse Conflit
    public function register(Request $request): JsonResponse
    { 
        // Décoder le corps de la requête JSON en tableau associatif
        $data = json_decode($request->getContent(), true); // Récupère le JSON brut et le parse

        // Validation des champs obligatoires
        if (empty($data['email']) || empty($data['password'])) { // Si l'un des deux est vide
            return $this->json([ // Retourne une réponse JSON
                'error' => 'Les champs email et password sont obligatoires.', // Message d'erreur
            ], Response::HTTP_BAD_REQUEST); // Code HTTP 400
        } 

        // Validation du format de l'adresse email
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->json([ 
                'error' => "L'email n'est pas valide.",
            ], Response::HTTP_BAD_REQUEST); // Code 400
        } 
        // Validation de la longueur du mot de passe (sécurité minimale)
        if (strlen($data['password']) < 8) { 
            return $this->json([ 
                'error' => 'Le mot de passe doit contenir au moins 8 caractères.',
            ], Response::HTTP_BAD_REQUEST); // Code 400
        } 

        // Déterminer le rôle (ROLE_USER par défaut si non spécifié)
        $roles = ['ROLE_USER'];
        if (!empty($data['roles']) && is_array($data['roles'])) {
            $roles = $data['roles'];
        } elseif (!empty($data['role'])) { 
            $roles = [$data['role']];
        }

        try { // Bloc de sécurité pour capturer les erreurs d'exécution
            // Appel au service pour créer l'utilisateur dans la base de données
            $user = $this->authService->register($data['email'], $data['password'], $roles); 

            return $this->json([ 
                'message' => 'Inscription réussie.',
                'user' => $this->authService->serializeUser($user),
            ], Response::HTTP_CREATED); // Code HTTP 201 (Créé)
        } catch (\InvalidArgumentException $e) { // Capture les erreurs de logique (ex: email doublon)
            return $this->json([ 
                'error' => $e->getMessage(),
            ], Response::HTTP_CONFLICT); 
        } catch (\Throwable $e) { // Capture toutes les autres erreurs (BDD, Crash...)
            return $this->json([ 
                'error' => 'Une erreur interne est survenue.', 
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        } 
    } 

    // ─── POST /auth/login – Connexion et génération de tokens

    #[Route('/auth/login', name: 'auth_login', methods: ['POST'])] // Route POST /auth/login
    #[OA\Post( // Swagger Post
        summary: 'Connexion utilisateur', // Titre
        description: 'Authentifie un utilisateur et retourne un JWT + refresh token.', // Description
        tags: ['Auth'],
    )] 
    #[OA\RequestBody( // Corps requis
        required: true,
        content: new OA\JsonContent(
            required: ['email', 'password'],
            properties: [
                new OA\Property(property: 'email', type: 'string', format: 'email', example: 'user@example.com'),
                new OA\Property(property: 'password', type: 'string', format: 'password', example: 'SecureP@ss123'),
            ]
        )
    )] // Fin RequestBody
    #[OA\Response(response: 200, description: 'Connexion réussie – retourne JWT et refresh token')] 
    #[OA\Response(response: 401, description: 'Identifiants incorrects')] 
    public function login(Request $request): JsonResponse
    { 
        $data = json_decode($request->getContent(), true);

        // Validation des champs obligatoires
        if (empty($data['email']) || empty($data['password'])) { // Teste la présence
            return $this->json([ 
                'error' => 'Les champs email et password sont obligatoires.', 
            ], Response::HTTP_BAD_REQUEST); // 400
        }

        try { 
            // Appel au service pour valider les credentials et générer les tokens
            $result = $this->authService->login($data['email'], $data['password']);

            return $this->json([
                'message' => 'Connexion réussie.', 
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'], 
                'user' => $result['user'],
            ]);
        } catch (\InvalidArgumentException $e) { // Si mauvais mot de passe ou email inconnu
            return $this->json([
                'error' => $e->getMessage(), 
            ], Response::HTTP_UNAUTHORIZED); 
        } catch (\Throwable $e) { // Autre erreur
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR); // 500
        } 
    }

    // ─── POST /auth/logout – Déconnexion 

    #[Route('/auth/logout', name: 'auth_logout', methods: ['POST'])] // Route POST /auth/logout
    #[OA\Post( // Swagger Post
        summary: 'Déconnexion utilisateur', // Titre
        description: 'Invalide tous les refresh tokens de l\'utilisateur. Le JWT reste valide jusqu\'à son expiration.', // Détail
        tags: ['Auth'],
        security: [['Bearer' => []]], // Indique que l'authentification est requise
    )]
    #[OA\Response(response: 200, description: 'Déconnexion réussie')] 
    #[OA\Response(response: 401, description: 'Non authentifié')]
    public function logout(): JsonResponse 
    {
        // Récupérer l'utilisateur connecté via le contexte Symfony (JWT)
        $user = $this->getUser(); // Méthode parente héritée d'AbstractController

        if (!$user) { 
            return $this->json([ 
                'error' => 'Non authentifié.',
            ], Response::HTTP_UNAUTHORIZED); // 401
        } 
        // Appel au service pour invalider les tokens en base
        $this->authService->logout($user); // Nettoie les sessions actives de l'utilisateur

        return $this->json([ 
            'message' => 'Déconnexion réussie.', 
        ]); 
    } 

    // ─── POST /auth/refresh – Renouvellement du JWT 

    #[Route('/auth/refresh', name: 'auth_refresh', methods: ['POST'])] // Route POST /auth/refresh
    #[OA\Post( // Swagger Post
        summary: 'Renouveler le JWT', // Titre
        description: 'Échange un refresh token valide contre un nouveau JWT et un nouveau refresh token.',
        tags: ['Auth'],
    )]
    #[OA\RequestBody( // Corps
        required: true,
        content: new OA\JsonContent(
            required: ['refresh_token'],
            properties: [
                new OA\Property(property: 'refresh_token', type: 'string', description: 'Le refresh token obtenu lors du login'),
            ]
        )
    )]
    #[OA\Response(response: 200, description: 'Token renouvelé')] // Succès
    #[OA\Response(response: 401, description: 'Refresh token invalide ou expiré')] // Erreur
    public function refresh(Request $request): JsonResponse // Méthode de rafraîchissement
    { 
        $data = json_decode($request->getContent(), true);

        if (empty($data['refresh_token'])) { 
            return $this->json([ 
                'error' => 'Le refresh_token est obligatoire.',
            ], Response::HTTP_BAD_REQUEST); // 400
        } 

        try {
            // Demande au service de valider et recréer un couple de tokens
            $result = $this->authService->refresh($data['refresh_token']); 

            return $this->json([ 
                'message' => 'Token renouvelé.', 
                'token' => $result['token'], 
                'refresh_token' => $result['refresh_token'], 
                'user' => $result['user'], 
            ]); // 200
        } catch (\InvalidArgumentException $e) { // Si le jeton est inconnu ou périmé
            return $this->json([ // Erreur
                'error' => $e->getMessage(), // Message d'erreur PHP
            ], Response::HTTP_UNAUTHORIZED); // 401
        } catch (\Throwable $e) { // Autre pépin
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR); // 500
        } 
    }

    // ─── GET /auth/me – Informations de l'utilisateur connecté 

    #[Route('/auth/me', name: 'auth_me', methods: ['GET'])] // Route GET /auth/me
    #[OA\Get( // Swagger Get
        summary: 'Profil de l\'utilisateur connecté', // Titre
        description: 'Retourne les informations de l\'utilisateur authentifié par le JWT.',
        tags: ['Auth'], 
        security: [['Bearer' => []]], // Sécurité requise
    )]
    #[OA\Response(response: 200, description: 'Informations utilisateur')] 
    #[OA\Response(response: 401, description: 'Non authentifié')]
    public function me(): JsonResponse // Méthode d'identité
    { 
        $user = $this->getUser(); // Récupère l'user connecté courant

        if (!$user) { 
            return $this->json([ 
                'error' => 'Non authentifié.',
            ], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json([
            'user' => $this->authService->serializeUser($user), // Retourne l'user formaté
        ]); 
    }

    // ─── GET /auth/validate – Validation interne du JWT 

    #[Route('/auth/validate', name: 'auth_validate', methods: ['GET'])] 
    #[OA\Get( // Swagger Get
        summary: 'Valider un JWT (endpoint interne)', // Titre
        description: 'Endpoint utilisé par l\'API Gateway pour valider un token JWT et obtenir les infos utilisateur.',
        tags: ['Auth'], 
        security: [['Bearer' => []]], 
    )] 
    #[OA\Response(response: 200, description: 'Token valide')] 
    #[OA\Response(response: 401, description: 'Token invalide')]
    public function validate(): JsonResponse // Méthode de validation
    { 
        $user = $this->getUser();

        if (!$user) { 
            return $this->json([ 
                'valid' => false, 
                'error' => 'Token invalide.',
            ], Response::HTTP_UNAUTHORIZED); 
        } 

        // Retourner les données utilisateur pour l'API Gateway
        // La Gateway injectera X-User-Id et X-User-Roles dans les headers amonts
        return $this->json([ 
            'valid' => true, 
            'user' => $this->authService->serializeUser($user), // Transmet les rôles et ID pour proxy
        ]); // 200
    } 
} 
