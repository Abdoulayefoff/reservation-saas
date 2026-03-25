<?php

declare(strict_types=1); 
namespace App\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController; 
use Symfony\Component\HttpFoundation\JsonResponse; 
use Symfony\Component\Routing\Attribute\Route;
use OpenApi\Attributes as OA; // Alias pour les annotations Swagger/OpenAPI

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
        summary: 'Healthcheck du User Service', 
        description: 'Vérifie que le service est opérationnel.',
        tags: ['Health'],
    )]
    #[OA\Response(response: 200, description: 'Service opérationnel')] 
    public function index(): JsonResponse 
    { 
        return $this->json([
            'status' => 'ok', 
            'service' => 'user-service',
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM), 
        ]); 
    } 
}
