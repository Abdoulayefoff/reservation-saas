<?php 

declare(strict_types=1); // Force le typage strict pour éviter les erreurs de type silencieuses

namespace App\Controller; 

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController; 
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route; 
use OpenApi\Attributes as OA; 

/**
 * Contrôleur de healthcheck – Endpoint /health.
 *
 * Utilisé par :
 * - Docker pour vérifier que le service est opérationnel
 * - Nginx pour le load balancing
 * - L'API Gateway pour le routing
 */
class HealthController extends AbstractController 
{ 

    /**
     * Endpoint de healthcheck.
     * Retourne un statut 200 avec les informations du service.
     */
    #[Route('/health', name: 'health', methods: ['GET'])] 
    #[OA\Get( // Début documentation Swagger
        summary: 'Healthcheck du Auth Service', 
        description: 'Vérifie que le service est opérationnel.',
        tags: ['Health'], 
    )] 
    #[OA\Response(response: 200, description: 'Service opérationnel')] // Réponse attendue (OK)
    public function index(): JsonResponse // Méthode de traitement
    { 
        return $this->json([ 
            'status' => 'ok', 
            'service' => 'auth-service',
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM), 
        ]); 
    } 
}
