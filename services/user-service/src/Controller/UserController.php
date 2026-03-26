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
 * L'authentification est gérée en amont par l'API Gateway qui injecte
 * les headers X-User-Id et X-User-Roles dans chaque requête transmise.
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

    // PATCH /users/me – Mise à jour du profil de l'utilisateur connecté
    // Doit être déclaré AVANT /users/{id} pour éviter que "me" soit capturé comme ID

    #[Route('/users/me', name: 'users_me_update', methods: ['PATCH'])]
    #[OA\Patch(
        summary: 'Mettre à jour son propre profil',
        description: 'Modifie le prénom et/ou le nom de l\'utilisateur connecté. L\'ID est déduit du token via X-User-Id.',
        tags: ['Users'],
    )]
    #[OA\RequestBody(
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'firstName', type: 'string', example: 'Abdoulaye'),
                new OA\Property(property: 'lastName', type: 'string', example: 'Fofana'),
            ]
        )
    )]
    #[OA\Response(response: 200, description: 'Profil mis à jour')]
    #[OA\Response(response: 401, description: 'Non authentifié')]
    #[OA\Response(response: 404, description: 'Profil introuvable')]
    public function updateMe(Request $request): JsonResponse
    {
        $userId = $request->headers->get('X-User-Id', '');
        if (!$userId) {
            return $this->json(['error' => 'Non authentifié.'], Response::HTTP_UNAUTHORIZED);
        }

        $data = json_decode($request->getContent(), true) ?? [];

        // Accepte camelCase (frontend) et snake_case (API directe)
        $normalized = [];
        if (isset($data['firstName']))  $normalized['first_name'] = $data['firstName'];
        if (isset($data['first_name'])) $normalized['first_name'] = $data['first_name'];
        if (isset($data['lastName']))   $normalized['last_name'] = $data['lastName'];
        if (isset($data['last_name']))  $normalized['last_name'] = $data['last_name'];
        if (isset($data['phone']))      $normalized['phone'] = $data['phone'];
        if (isset($data['avatar_url'])) $normalized['avatar_url'] = $data['avatar_url'];

        try {
            $profile = $this->userService->updateProfile($userId, $normalized);
            $serialized = $this->userService->serializeProfile($profile);

            // Retourne les champs en camelCase au niveau racine pour faciliter le spread côté frontend
            return $this->json([
                'message'    => 'Profil mis à jour.',
                'id'         => $serialized['id'],
                'firstName'  => $serialized['first_name'],
                'lastName'   => $serialized['last_name'],
                'email'      => $serialized['email'],
                'phone'      => $serialized['phone'],
                'avatar_url' => $serialized['avatar_url'],
                'profile'    => $serialized,
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->json(['error' => $e->getMessage()], Response::HTTP_NOT_FOUND);
        } catch (\Throwable) {
            return $this->json(['error' => 'Une erreur interne est survenue.'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    // GET /users – Liste de tous les profils (Admin uniquement)

    #[Route('/users', name: 'users_list', methods: ['GET'])] 
    #[OA\Get( // Début documentation Swagger
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
        // Récupérer le rôle injecté par la Gateway (Header HTTP)
        $userRoles = $request->headers->get('X-User-Roles', ''); // Récupère la chaîne des rôles

        // Vérification de sécurité : Seul un administrateur peut lister TOUS les profils d'un coup
        if (!str_contains($userRoles, 'ROLE_ADMIN')) {
            return $this->json([
                'error' => 'Accès refusé. Rôle ADMIN requis.', 
            ], Response::HTTP_FORBIDDEN); // Code HTTP 403 (Interdit)
        } 
        // Gestion de la Pagination : force des valeurs numériques saines
        $page = max(1, (int) $request->query->get('page', 1)); // Page 1 minimum par défaut
        $limit = min(100, max(1, (int) $request->query->get('limit', 20))); // Entre 1 et 100 max (20 par défaut)

        // Appel au service pour récupérer l'index de données
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
        // Vérifier les permissions (Doit être le propriétaire [Owner] OU un Administrateur)
        $userId = $request->headers->get('X-User-Id', ''); // Identifiant de l'interrogeant
        $userRoles = $request->headers->get('X-User-Roles', ''); // Rôles de l'interrogeant

        // Délègue la vérification des droits (Authorization) au UserService métier
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
    #[OA\Put( // Swagger Put
        summary: 'Mettre à jour un profil',
        description: 'Modifie les informations d\'un profil utilisateur.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID du profil', required: true)]
    #[OA\RequestBody(
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'first_name', type: 'string', example: 'Abdoulaye'),
                new OA\Property(property: 'last_name', type: 'string', example: 'Fofana'),
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
        // Vérification des droits (Owner ou Admin requis pour modifier)
        $userId = $request->headers->get('X-User-Id', ''); // ID demandeur
        $userRoles = $request->headers->get('X-User-Roles', ''); // Rôles demandeur

        if (!$this->userService->isAuthorized($id, $userId, $userRoles)) { 
            return $this->json([
                'error' => 'Accès refusé.', 
            ], Response::HTTP_FORBIDDEN);
        }
        $data = json_decode($request->getContent(), true) ?? []; // Assure un tableau même si vide
        try { 
            // Appelle le service métier pour appliquer la mise à jour des valeurs du profil
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

    // DELETE /users/{id} – Suppression d'un profil (Admin uniquement)

    #[Route('/users/{id}', name: 'users_delete', methods: ['DELETE'])]
    #[OA\Delete( // Swagger Delete
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
        // Contrôle de rôle strict : Seul l'administrateur peut détruire un profil
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
        } catch (\InvalidArgumentException $e) { // Si le profil n'existait pas à la base
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
    #[OA\Get( // Swagger Get
        summary: 'Billets d\'un utilisateur',
        description: 'Récupère les billets achetés par un utilisateur via le Ticket Service.',
        tags: ['Users'],
    )]
    #[OA\Parameter(name: 'id', in: 'path', description: 'UUID de l\'utilisateur', required: true)]
    #[OA\Response(response: 200, description: 'Liste des billets')] 
    #[OA\Response(response: 403, description: 'Accès refusé')]
    public function tickets(string $id, Request $request): JsonResponse 
    { 
        // Vérification des droits (Owner ou Admin requis pour voir ses propres billets)
        $userId = $request->headers->get('X-User-Id', ''); 
        $userRoles = $request->headers->get('X-User-Roles', '');
        if (!$this->userService->isAuthorized($id, $userId, $userRoles)) { 
            return $this->json([
                'error' => 'Accès refusé.',
            ], Response::HTTP_FORBIDDEN);
        } 

        // Délégue la récupération des billets (appel Ticket Service distant) au UserService
        $tickets = $this->userService->getUserTickets($id); 
        return $this->json($tickets); 
    }
}
