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
 * Contrôleur pour la création interne de profils.
 *
 * Cet endpoint est appelé par le Auth Service lors de l'inscription
 * d'un nouvel utilisateur. Il n'est PAS exposé publiquement via
 * l'API Gateway – il est uniquement accessible sur le réseau Docker interne.
 */
class ProfileCreationController extends AbstractController
{ 
    public function __construct(
        private readonly UserService $userService, 
    ) {}

    /**
     * Endpoint interne : créer un profil utilisateur.
     * Appelé par le Auth Service après une inscription réussie.
     *
     * Le payload contient l'ID et l'email du User créé dans le Auth Service.
     * L'ID du profil est le MÊME que celui du User (Liaison inter-services).
     */
    #[Route('/users/internal/create', name: 'users_internal_create', methods: ['POST'])]
    #[OA\Post( // Début documentation Swagger
        summary: 'Créer un profil (endpoint interne)',
        description: 'Crée un profil utilisateur. Endpoint interne appelé par le Auth Service.', 
        tags: ['Internal'],
    )] 
    #[OA\RequestBody( // Modèle du corps JSON attendu
        required: true, 
        content: new OA\JsonContent(
            required: ['id', 'email'], 
            properties: [
                new OA\Property(property: 'id', type: 'string', format: 'uuid', description: 'UUID du User dans Auth Service'),
                new OA\Property(property: 'email', type: 'string', format: 'email', description: 'Email de l\'utilisateur'),
            ]
        )
    )] 
    #[OA\Response(response: 201, description: 'Profil créé')] 
    #[OA\Response(response: 400, description: 'Données invalides')] 
    #[OA\Response(response: 409, description: 'Profil déjà existant')] 
    public function create(Request $request): JsonResponse 
    { 
        $data = json_decode($request->getContent(), true); 

        // Validation des champs obligatoires
        if (empty($data['id']) || empty($data['email'])) { 
            return $this->json([ // Erreur 400
                'error' => 'Les champs id et email sont obligatoires.', 
            ], Response::HTTP_BAD_REQUEST); 
        }

        try { // Protège la création SQL contre les doublons ou pannes
            // Appel au UserService pour instancier et persister le profil miroir
            $profile = $this->userService->createProfile($data['id'], $data['email']);

            return $this->json([
                'message' => 'Profil créé.', 
                'profile' => $this->userService->serializeProfile($profile), 
            ], Response::HTTP_CREATED); 
        } catch (\InvalidArgumentException $e) {
            return $this->json([ 
                'error' => $e->getMessage(), 
            ], Response::HTTP_CONFLICT); // Code HTTP 409 (Conflict)
        } catch (\Throwable $e) { // Toutes autres pannes (Crash BDD...)
            return $this->json([ 
                'error' => 'Une erreur interne est survenue.',
            ], Response::HTTP_INTERNAL_SERVER_ERROR); // Code 500
        } 
    } 
} 
