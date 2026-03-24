<?php

namespace App\Controller;
use App\Entity\Event;
use App\Entity\TicketOption;
use App\Service\EventService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController; 
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Nelmio\ApiDocBundle\Attribute\Model;
use OpenApi\Attributes as OA; // Alias pour les annotations Swagger/OpenAPI

#[Route('/events')] 
#[OA\Tag(name: 'Events')] // Catégorise ces routes sous le tag "Events" dans Swagger
class EventController extends AbstractController
{ 
    public function __construct(
        private EventService $eventService,
        private SerializerInterface $serializer,
        private string $ticketServiceUrl = ''
    ) { 
    }

    // GET /events – Liste des évènements (Paginée et Filtrée)
    #[Route('', name: 'events_list', methods: ['GET'])]
    #[OA\Response( // Documentation de la réponse en cas de succès
        response: 200,
        description: 'Returns the list of published events',
        content: new OA\JsonContent(
            type: 'array',
            items: new OA\Items(ref: new Model(type: \App\Entity\Event::class, groups: ['event:read'])) // Éléments du groupe 'event:read'
        ) 
    )]
    #[OA\Parameter(name: 'date', in: 'query', description: 'Filter by date (YYYY-MM-DD)', required: false, schema: new OA\Schema(type: 'string'))] // Filtre Date
    #[OA\Parameter(name: 'venue', in: 'query', description: 'Filter by venue', required: false, schema: new OA\Schema(type: 'string'))]
    #[OA\Parameter(name: 'minPrice', in: 'query', description: 'Minimum price', required: false, schema: new OA\Schema(type: 'number'))]
    #[OA\Parameter(name: 'maxPrice', in: 'query', description: 'Maximum price', required: false, schema: new OA\Schema(type: 'number'))]
    #[OA\Parameter(name: 'page', in: 'query', description: 'Page number', required: false, schema: new OA\Schema(type: 'integer', default: 1))] 
    #[OA\Parameter(name: 'limit', in: 'query', description: 'Items per page', required: false, schema: new OA\Schema(type: 'integer', default: 10))]
    public function list(Request $request): JsonResponse
    {
        // Constitution du tableau de filtres à partir des paramètres d'URL (Query)
        $filters = [
            'date'     => $request->query->get('date'),
            'venue'    => $request->query->get('venue') ?? $request->query->get('location'),
            'minPrice' => $request->query->get('minPrice'),
            'maxPrice' => $request->query->get('maxPrice'),
        ];

        // Nettoyage : Supprime les entrées du tableau qui sont NULL pour ne pas polluer la requête
        $filters = array_filter($filters, fn($val) => $val !== null);

        // Récupération des paramètres de pagination avec conversion en entier
        $page  = $request->query->getInt('page', 1); // Page courante (Défaut 1)
        $limit = $request->query->getInt('limit', 10); // Limite (Défaut 10)

        // Appel au service métier pour récupérer la liste filtrée d'évènements
        $events = $this->eventService->listEvents($filters, $page, $limit);

        // Retourne la réponse en sérialisant les objets (Groupe 'event:read' pour éviter les boucles)
        return new JsonResponse( 
            $this->serializer->serialize($events, 'json', ['groups' => 'event:read']), 
            200,
            [],
            true
        );
    } 

    // GET /events/mine – Évènements du créateur authentifié (tous statuts : PUBLISHED, DRAFT, CANCELLED)
    #[Route('/mine', name: 'events_mine', methods: ['GET'])]
    #[OA\Get(
        summary: 'Mes événements (tous statuts)',
        description: 'Retourne tous les événements créés par l\'utilisateur authentifié, quel que soit leur statut.',
        tags: ['Events'],
    )]
    #[OA\Response(response: 200, description: 'Liste des événements du créateur')]
    #[OA\Response(response: 401, description: 'Unauthorized')]
    public function mine(Request $request): JsonResponse
    {
        $userId = $request->headers->get('X-User-Id');
        if (!$userId) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $userRoles = explode(',', $request->headers->get('X-User-Roles', ''));
        $events = $this->eventService->getCreatorEvents($userId, $userRoles);

        return new JsonResponse(
            $this->serializer->serialize($events, 'json', ['groups' => 'event:read']),
            200, [], true
        );
    }

    //  GET /events/{id} – Détail d'un évènement
    #[Route('/{id}', name: 'events_get', methods: ['GET'])]
    #[OA\Response( // Réponse Succès
        response: 200,
        description: 'Returns event details',
        content: new OA\JsonContent(ref: new Model(type: \App\Entity\Event::class, groups: ['event:read']))
    )]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function getEvent(string $id): JsonResponse 
    {
        // Récupère l'évènement ciblé via le service
        $event = $this->eventService->getEvent($id); 

        // Retourne la structure sérialisée
        return new JsonResponse(
            $this->serializer->serialize($event, 'json', ['groups' => 'event:read']),
            200,
            [], // En-têtes
            true // Déjà encodé
        );
    } 

    // GET /events/{id}/availability – Disponibilité des places
    #[Route('/{id}/availability', name: 'events_availability', methods: ['GET'])]
    #[OA\Response( 
        response: 200,
        description: 'Returns seat availability for an event',
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'eventId', type: 'string'),
                new OA\Property(property: 'totalSeats', type: 'integer'),
                new OA\Property(property: 'availableSeats', type: 'integer'),
                new OA\Property(property: 'soldOut', type: 'boolean'),
                new OA\Property(property: 'status', type: 'string'),
            ]
        )
    )]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function availability(string $id): JsonResponse
    {
        try {
            // Demande l'état des stocks au service métier
            $data = $this->eventService->getAvailability($id); // Récupère le dictionnaire
            return new JsonResponse($data, 200);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        }
    }

    // POST /events – Création d'un évènement
    #[Route('', name: 'events_create', methods: ['POST'])]
    #[OA\RequestBody(
        description: 'Event data to create',
        required: true,
        content: new OA\JsonContent(ref: new Model(type: \App\Entity\Event::class, groups: ['event:write']))
    )]
    #[OA\Response(response: 201, description: 'Event created successfully')]
    #[OA\Response(response: 400, description: 'Invalid input')]
    #[OA\Response(response: 401, description: 'Unauthorized')]
    public function create(Request $request): JsonResponse
    { 
        // Récupération de l'identifiant de l'utilisateur (Injecté par Gateway)
        $userId = $request->headers->get('X-User-Id'); // Cherche le header
        if (!$userId) { // Si absent (Non authentifié)
            return new JsonResponse(['error' => 'Unauthorized'], 401); // Erreur 401
        }

        // Décodage du JSON entrant
        $data = json_decode($request->getContent(), true);

        // Rétrocompatibilité / Normalisation des champs optionnels/legacy
        $venueField = $data['venue'] ?? $data['location'] ?? null; // Gère location
        $dateField = $data['date'] ?? $data['eventDate'] ?? null; // Gère eventDate
        $seatsField = $data['totalSeats'] ?? $data['totalPlaces'] ?? null; // Gère totalPlaces

        // Validation primaire des champs DÉCISIONNELS requis
        if (!isset($data['title']) || !$dateField || !$venueField || !isset($data['price']) || !$seatsField) { // Si manquement
            return new JsonResponse(['error' => 'Missing required fields'], 400); // Erreur 400
        }

        // Écrase / Fixe les valeurs normalisées dans le payload de travail
        $data['venue']      = $venueField; // Affecte lieu
        $data['date']       = $dateField; // Affecte date
        $data['totalSeats'] = $seatsField; // Affecte places

        try {
            // Demande la création de l'objet au service métier
            $event = $this->eventService->createEvent($data, $userId);

            return new JsonResponse(
                $this->serializer->serialize($event, 'json', ['groups' => 'event:read']),
                201,
                [],
                true
            );
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    // PUT /events/{id} – Mise à jour d'un évènement
    #[Route('/{id}', name: 'events_update', methods: ['PUT'])]
    #[OA\RequestBody(
        description: 'Event data to update',
        required: true,
        content: new OA\JsonContent(ref: new Model(type: \App\Entity\Event::class, groups: ['event:write']))
    )]
    #[OA\Response(response: 200, description: 'Event updated successfully')]
    #[OA\Response(response: 403, description: 'Access denied')]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function update(string $id, Request $request): JsonResponse
    {
        // Récupération des informations d'identité injectées
        $userId    = $request->headers->get('X-User-Id'); // ID
        $userRoles = explode(',', $request->headers->get('X-User-Roles') ?? ''); // Découpe les rôles en tableau

        if (!$userId) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }
        $data = json_decode($request->getContent(), true); 
        try { 

            // Délègue la mise à jour et la vérification des droits au service métier
            $event = $this->eventService->updateEvent($id, $data, $userId, $userRoles);
            return new JsonResponse(
                $this->serializer->serialize($event, 'json', ['groups' => 'event:read']),
                200, 
                [],
                true 
            );
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    // DELETE /events/{id} – Suppression d'un évènement
    #[Route('/{id}', name: 'events_delete', methods: ['DELETE'])]
    #[OA\Response(response: 204, description: 'Event deleted successfully')]
    #[OA\Response(response: 403, description: 'Access denied')]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function delete(string $id, Request $request): JsonResponse
    {
        // Captures d'identité Gateway
        $userId    = $request->headers->get('X-User-Id'); // ID
        $userRoles = explode(',', $request->headers->get('X-User-Roles') ?? ''); // Rôles

        if (!$userId) { // Test d'accès
            return new JsonResponse(['error' => 'Unauthorized'], 401); 
        } 

        try { 
            // Demande la suppression au service (gère aussi isAuthorized dedans)
            $this->eventService->deleteEvent($id, $userId, $userRoles);
            return new JsonResponse(null, 204);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    // PATCH /events/{id}/reserve – Réservation de places
    #[Route('/{id}/reserve', name: 'events_reserve', methods: ['PATCH'])]
    #[OA\Response(response: 200, description: 'Seats reserved successfully')]
    #[OA\Response(response: 400, description: 'Not enough available seats')]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function reservePlaces(string $id, Request $request): JsonResponse
    {
        $data     = json_decode($request->getContent(), true);
        $quantity = $data['quantity'] ?? 1; // Quantité de places (Défaut 1)

        if ($quantity < 1) {
            return new JsonResponse(['error' => 'Invalid quantity'], 400);
        }

        try { 
            // Décrémente les places disponibles via le service
            $success = $this->eventService->reservePlaces($id, $quantity); 
            if ($success) {
                return new JsonResponse(['message' => 'Seats reserved successfully']); 
            }
            return new JsonResponse(['error' => 'Not enough available seats'], 400);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400);
        }
    }

    // PATCH /events/{id}/release – Annulation / Libération de places
    #[Route('/{id}/release', name: 'release_places', methods: ['PATCH'])]
    #[OA\Response(response: 200, description: 'Seats released successfully')]
    #[OA\Response(response: 400, description: 'Failed to release seats')]
    public function releasePlaces(string $id, Request $request): JsonResponse
    {
        $data  = json_decode($request->getContent(), true);
        $count = $data['quantity'] ?? 1; // Récupère la quantité à libérer (Recréer)

        if ($count < 1) {
            return new JsonResponse(['error' => 'Invalid quantity'], 400);
        }

        try {
            // Réincrémente les places via le service
            $this->eventService->releasePlaces($id, $count);
            return new JsonResponse(['message' => 'Seats released successfully'], 200);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 400); 
        }
    }

    // POST /events/{id}/ticket-options – Créer une option de billets
    #[Route('/{id}/ticket-options', name: 'add_ticket_option', methods: ['POST'])]
    #[OA\Response(
        response: 201,
        description: 'Returns the created TicketOption',
        content: new OA\JsonContent(ref: new Model(type: TicketOption::class, groups: ['ticket_option:read']))
    )]
    #[OA\Response(response: 400, description: 'Invalid input')]
    #[OA\Response(response: 401, description: 'Unauthorized')]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function addTicketOption(string $id, Request $request): JsonResponse
    { 
        // Identifiants Gateway
        $roles  = explode(',', $request->headers->get('X-User-Roles', '')); // Tableau
        $userId = $request->headers->get('X-User-Id'); // ID

        if (!$userId) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        try {
            // Récupère l'évènement pour s'assurer de son existence
            $event = $this->eventService->getEvent($id);

            // Vérifie si l'utilisateur à le droit d'ajouter des options (Owner/Admin)
            $this->eventService->isAuthorized($event, $userId, $roles);

            $data = json_decode($request->getContent(), true);
            if (!isset($data['type'], $data['price'], $data['quantity'])) {
                return new JsonResponse(['error' => 'Missing required fields'], 400);
            }

            // Création de l'entité Option de Billet
            $ticketOption = new TicketOption(); 
            $ticketOption->setType($data['type']);
            $ticketOption->setPrice((string)$data['price']);
            $ticketOption->setQuantity((int)$data['quantity']);
            $ticketOption->setAvailable((int)$data['quantity']);

            // Ajoute l'option à la collection de l'évènement orchestré
            $event->addTicketOption($ticketOption);

            // Forcer l'update/save via le service (pour persister la cascade)
            $this->eventService->updateEvent($id, [], $userId, $roles);

            return new JsonResponse(
                $this->serializer->serialize($ticketOption, 'json', ['groups' => 'ticket_option:read']),
                201, [], true
            );
        } catch (\Exception $e) {

            // Adapte le code HTTP de retour selon l'erreur levée (404 vs 400)
            $status = $e instanceof \Symfony\Component\HttpKernel\Exception\NotFoundHttpException ? 404 : 400;
            return new JsonResponse(['error' => $e->getMessage()], $status);
        }
    }

    // GET /events/{id}/ticket-options – Lister les options de billets
    #[Route('/{id}/ticket-options', name: 'list_ticket_options', methods: ['GET'])]
    #[OA\Response(
        response: 200,
        description: 'Returns the list of TicketOptions for the event',
        content: new OA\JsonContent(type: 'array', items: new OA\Items(ref: new Model(type: TicketOption::class, groups: ['ticket_option:read'])))
    )]
    #[OA\Response(response: 404, description: 'Event not found')]
    public function listTicketOptions(string $id): JsonResponse
    {
        try {
            // Recherche l'évènement
            $event = $this->eventService->getEvent($id);

            return new JsonResponse(
                $this->serializer->serialize($event->getTicketOptions(), 'json', ['groups' => 'ticket_option:read']),
                200, [], true 
            );
        } catch (\Exception $e) {
            return new JsonResponse(['error' => $e->getMessage()], 404);
        } 
    }
}
