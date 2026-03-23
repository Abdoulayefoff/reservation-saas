<?php

namespace App\Controller;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use OpenApi\Attributes as OA; // Alias pour les annotations Swagger/OpenAPI

#[Route('/health')]
#[OA\Tag(name: 'Health')]
class HealthController extends AbstractController
{ 
    /**
     * Endpoint de vérification de l'état de santé du service (Health Check).
     */
    #[Route('', name: 'health_check', methods: ['GET'])]
    #[OA\Response(
        response: 200,
        description: 'Returns the health status of the service',
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'status', type: 'string', example: 'ok')
            ]
        )
    )]
    public function check(): JsonResponse
    {
        return new JsonResponse(['status' => 'ok']);
    }
}
