<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\UserService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use OpenApi\Attributes as OA;

/**
 * Contrôleur des profils utilisateurs.
 *
 * L'authentification est gérée par l'API Gateway qui injecte
 * les headers X-User-Id et X-User-Roles dans chaque requête.
 *
 * Routes :
 * - GET    /users           – Liste tous les profils (Admin)
 * - GET    /users/{id}      – Détail d'un profil (Owner/Admin)
 * - PUT    /users/{id}      – Mise à jour (Owner/Admin)
 * - DELETE /users/{id}      – Suppression (Admin)
 * - GET    /users/{id}/tickets – Billets de l'utilisateur (Owner/Admin)
 */
class UserController extends AbstractController
{
    public function __construct(
        private readonly UserService $userService,
    ) {}

    // GET /users – Liste de tous les profils (Admin uniquement)

    #[Route('/users', name: 'users_list', methods: ['GET'])]
    #[OA\Get(
        summary: 'Lister les profils (Admin)',
        description: 'Retourne la liste paginée de tous les profils utilisateurs.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'page', in: 'query', description: 'Numéro de page', required: false)]
    #[OA\Parameter(name: 'limit', in: 'query', description: 'Nombre de résultats par page', required: false)]
    #[OA\Response(response: 200, description: 'Liste des profils')]
    #[OA\Response(response: 403, description: 'Accès refusé')]
    public function list(Request $request): JsonResponse
    {
        // Vérifier que l'utilisateur est admin
        $userRoles = $request->headers->get('X-User-Roles', '');
        if (!str_contains($userRoles, 'ROLE_ADMIN')) {
            return $this->json([
                'error' => 'Accès refusé. Rôle ADMIN requis.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Paramètres de pagination
        $page = max(1, (int) $request->query->get('page', 1));
        $limit = min(100, max(1, (int) $request->query->get('limit', 20)));

        $result = $this->userService->listProfiles($page, $limit);

        return $this->json($result);
    }

    // GET /users/{id} – Détail d'un profil

    #[Route('/users/{id}', name: 'users_show', methods: ['GET'])]
    #[OA\Get(
        summary: 'Détail d\'un profil',
        description: 'Retourne le profil d\'un utilisateur par son ID.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID du profil', required: true)]
    #[OA\Response(response: 200, description: 'Profil trouvé')]
    #[OA\Response(response: 403, description: 'Accès refusé')]
    #[OA\Response(response: 404, description: 'Profil introuvable')]
    public function show(string $id, Request $request): JsonResponse
    {
        // Vérifier les permissions (owner ou admin)
        $userId = $request->headers->get('X-User-Id', '');
        $userRoles = $request->headers->get('X-User-Roles', '');

        if (!$this->userService->isAuthorized($id, $userId, $userRoles)) {
            return $this->json([
                'error' => 'Accès refusé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $profile = $this->userService->getProfile($id);

        if (!$profile) {
            return $this->json([
                'error' => 'Profil introuvable.',
            ], Response::HTTP_NOT_FOUND);
        }

        return $this->json([
            'profile' => $this->userService->serializeProfile($profile),
        ]);
    }

    // PUT /users/{id} – Mise à jour d'un profil

    #[Route('/users/{id}', name: 'users_update', methods: ['PUT'])]
    #[OA\Put(
        summary: 'Mettre à jour un profil',
        description: 'Modifie les informations d\'un profil utilisateur.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID du profil', required: true)]
    #[OA\RequestBody(
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'first_name', type: 'string', example: 'Jean'),
                new OA\Property(property: 'last_name', type: 'string', example: 'Dupont'),
                new OA\Property(property: 'phone', type: 'string', example: '+33612345678'),
                new OA\Property(property: 'avatar_url', type: 'string', example: 'https://example.com/avatar.jpg'),
            ]
        )
    )]
    #[OA\Response(response: 200, description: 'Profil mis à jour')]
    #[OA\Response(response: 403, description: 'Accès refusé')]
    #[OA\Response(response: 404, description: 'Profil introuvable')]
    public function update(string $id, Request $request): JsonResponse
    {
        // Vérifier les permissions
        $userId = $request->headers->get('X-User-Id', '');
        $userRoles = $request->headers->get('X-User-Roles', '');

        if (!$this->userService->isAuthorized($id, $userId, $userRoles)) {
            return $this->json([
                'error' => 'Accès refusé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        try {
            $profile = $this->userService->updateProfile($id, $data);

            return $this->json([
                'message' => 'Profil mis à jour.',
                'profile' => $this->userService->serializeProfile($profile),
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_NOT_FOUND);
        } catch (\Throwable $e) {
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // DELETE /users/{id} – Suppression d'un profil (Admin)

    #[Route('/users/{id}', name: 'users_delete', methods: ['DELETE'])]
    #[OA\Delete(
        summary: 'Supprimer un profil (Admin)',
        description: 'Supprime un profil utilisateur. Réservé aux administrateurs.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID du profil', required: true)]
    #[OA\Response(response: 200, description: 'Profil supprimé')]
    #[OA\Response(response: 403, description: 'Accès refusé')]
    #[OA\Response(response: 404, description: 'Profil introuvable')]
    public function delete(string $id, Request $request): JsonResponse
    {
        // Seul un admin peut supprimer un profil
        $userRoles = $request->headers->get('X-User-Roles', '');
        if (!str_contains($userRoles, 'ROLE_ADMIN')) {
            return $this->json([
                'error' => 'Accès refusé. Rôle ADMIN requis.',
            ], Response::HTTP_FORBIDDEN);
        }

        try {
            $this->userService->deleteProfile($id);

            return $this->json([
                'message' => 'Profil supprimé.',
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_NOT_FOUND);
        } catch (\Throwable $e) {
            return $this->json([
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // GET /users/{id}/tickets – Billets d'un utilisateur

    #[Route('/users/{id}/tickets', name: 'users_tickets', methods: ['GET'])]
    #[OA\Get(
        summary: 'Billets d\'un utilisateur',
        description: 'Récupère les billets achetés par un utilisateur via le Ticket Service.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID de l\'utilisateur', required: true)]
    #[OA\Response(response: 200, description: 'Liste des billets')]
    #[OA\Response(response: 403, description: 'Accès refusé')]
    public function tickets(string $id, Request $request): JsonResponse
    {
        // Vérifier les permissions
        $userId = $request->headers->get('X-User-Id', '');
        $userRoles = $request->headers->get('X-User-Roles', '');

        if (!$this->userService->isAuthorized($id, $userId, $userRoles)) {
            return $this->json([
                'error' => 'Accès refusé.',
            ], Response::HTTP_FORBIDDEN);
        }

        $tickets = $this->userService->getUserTickets($id);

        return $this->json($tickets);
    }
}
