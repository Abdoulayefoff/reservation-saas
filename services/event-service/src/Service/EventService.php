<?php

namespace App\Service;
use App\Entity\Event; 
use App\Repository\EventRepository; 
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException; 
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Uid\Uuid;

/**
 * Service de gestion des évènements.
 * Responsabilités :
 * - Création, modification et suppression d'évènements.
 * - Gestion atomique des stocks de places (Réservations/Annulations).
 * - Centralisation des contrôles de droits d'accès (Créateur ou Admin).
 */
class EventService 
{ 
    public function __construct(
        private EventRepository $eventRepository, 
        private EntityManagerInterface $entityManager 
    ) {
    }

    /**
     * Crée un nouvel évènement en base de données.
     * @param array  $data      Données brutes issues du JSON décode
     * @param string $creatorId UUID du créateur de l'évènement (Orchestrateur/Admin)
     * @return Event L'objet évènement créé et sauvegardé
     */
    public function createEvent(array $data, string $creatorId): Event
    { 
        $event = new Event(); 
        
        // Affectation des valeurs depuis le payload
        $event->setTitle($data['title']); 
        $event->setDescription($data['description'] ?? null);
        
        // Conversion de la date texte en objet DateTime PHP
        $event->setEventDate(new \DateTime($data['date'] ?? $data['eventDate'])); 
        $event->setVenue($data['venue'] ?? $data['location']); 
        $event->setPrice($data['price']); 
        
        // Gestion de la capacité d'accueil
        $totalSeats = $data['totalSeats'] ?? $data['totalPlaces']; 
        $event->setTotalSeats($totalSeats);
        $event->setAvailableSeats($totalSeats);
        
        // Liaison avec l'identifiant du créateur en le castant en UUID Doctrine
        $event->setCreatorId(Uuid::fromString($creatorId)); 

        // Gestion du statut de publication
        if (isset($data['status'])) { 
            $event->setStatus($data['status']); 
        } elseif (isset($data['isPublished'])) { 
            // Associe true à STATUS_PUBLISHED et false à STATUS_DRAFT du modèle
            $event->setStatus($data['isPublished'] ? Event::STATUS_PUBLISHED : Event::STATUS_DRAFT); 
        } 

        // Sauvegarde immédiate (flush = true) en base via le repo
        $this->eventRepository->save($event, true); 
        return $event; 
    } 

    /**
     * Récupère un évènement par son UUID ou lève une 404.
     */
    public function getEvent(string $id): Event
    { 
        $event = $this->eventRepository->find($id);
        if (!$event) { 
            throw new NotFoundHttpException('Event not found.');
        } 
        return $event; 
    } 

    /**
     * Liste tous les évènements publiés en appliquant des filtres.
     */
    public function listEvents(array $filters, int $page = 1, int $limit = 10): array
    { 
        // Délègue la requête complexe de filtre au Repo personnalisé
        return $this->eventRepository->findPublishedWithFilters($filters, $page, $limit);
    } 

    /**
     * Met à jour les informations d'un évènement.
     * @throws BadRequestHttpException Si la réduction des places est impossible
     */
    public function updateEvent(string $id, array $data, string $userId, array $userRoles): Event
    { 
        $event = $this->getEvent($id); 
        $this->isAuthorized($event, $userId, $userRoles); 
        if (isset($data['title'])) { 
            $event->setTitle($data['title']); 
        } 
        if (isset($data['description'])) { 
            $event->setDescription($data['description']);
        } 
        if (isset($data['eventDate'])) { 
            $event->setEventDate(new \DateTime($data['eventDate']));
        } elseif (isset($data['date'])) { 
            $event->setEventDate(new \DateTime($data['date'])); 
        } 
        
        // Gestion Lieu (Autorise 'venue' ou 'location')
        if (isset($data['venue'])) { 
            $event->setVenue($data['venue']); 
        } elseif (isset($data['location'])) { 
            $event->setVenue($data['location']); 
        } 
        if (isset($data['price'])) {
            $event->setPrice($data['price']);
        }
        if (isset($data['status'])) {
            $event->setStatus($data['status']); 
        } elseif (isset($data['isPublished'])) { 
            $event->setStatus($data['isPublished'] ? Event::STATUS_PUBLISHED : Event::STATUS_DRAFT); 
        } 

        //  LOGIQUE DE MODIFICATION DE LA CAPACITÉ (PLACES)
        $newTotal = $data['totalSeats'] ?? $data['totalPlaces'] ?? null; // Récupère le nouveau total
        
        if ($newTotal !== null) { 
            // Calculer le nombre de places réservées (Total initial - Disponibles actuelles)
            $reservedSeats = $event->getTotalSeats() - $event->getAvailableSeats(); // Quantité vendue
            
            // Condition de blocage : On ne peut pas réduire la capacité en dessous des ventes déjà effectuées
            if ($newTotal < $reservedSeats) {
                throw new BadRequestHttpException('Total seats cannot be less than already reserved seats.'); 
            } 
            
            // Ajustement : Calcule la différence pour l'appliquer au solde restant
            $diff = $newTotal - $event->getTotalSeats(); 
            $event->setAvailableSeats($event->getAvailableSeats() + $diff); 
            $event->setTotalSeats($newTotal); 
        } 
        $this->entityManager->flush();
        return $event; 
    } 

    /**
     * Supprime définitivement un évènement de la base de données.
     */
    public function deleteEvent(string $id, string $userId, array $userRoles): void
    { 
        $event = $this->getEvent($id); 
        $this->isAuthorized($event, $userId, $userRoles); 
        $this->eventRepository->remove($event, true); 
    } 

    /**
     * Réserve des places de manière ATOMIQUE.
     * Utilise des transactions et un verrouillage pessimiste SQL (SELECT FOR UPDATE).
     */
    public function reservePlaces(string $eventId, int $quantity): bool
    {
        $this->entityManager->beginTransaction(); 
        try { 
            // Charge l'évènement en posant un verrou d'ÉCRITURE BLOQUANT (LockMode::PESSIMISTIC_WRITE)
            // Empêche tout autre thread Docker de lire/modifier cette ligne tant que commit/rollback n'a pas eu lieu
            $event = $this->eventRepository->find($eventId, \Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE); // SELECT ... FOR UPDATE

            if (!$event) { 
                throw new NotFoundHttpException('Event not found.'); 
            } 

            // Vérification de la disponibilité sous verrou
            if ($event->getAvailableSeats() < $quantity) {
                $this->entityManager->rollback();
                return false;
            }

            // Décrémentation sécurisée du stock sous le verrou
            $event->setAvailableSeats($event->getAvailableSeats() - $quantity); 
            $this->entityManager->flush(); 
            $this->entityManager->commit();
            return true; 
        } catch (\Exception $e) { 
            $this->entityManager->rollback();
            throw $e;
        } 
    } 

    /**
     * Libère / Annule des places vendues Atomiquement.
     */
    public function releasePlaces(string $eventId, int $quantity): bool
    {
        $this->entityManager->beginTransaction(); 
        try {
            // Utilisation d'un SELECT classique forcé en verrou Pessimistic_Write via DQL query
            $event = $this->entityManager->createQuery('SELECT e FROM App\Entity\Event e WHERE e.id = :id') 
                ->setParameter('id', $eventId)
                ->setLockMode(\Doctrine\DBAL\LockMode::PESSIMISTIC_WRITE) // Verrouillage forcé SQL SELECT FOR UPDATE
                ->getSingleResult();

            if (!$event) {
                throw new NotFoundHttpException('Event not found.'); 
            } 

            // Réincrémente le stock disponible
            $event->setAvailableSeats($event->getAvailableSeats() + $quantity); // Ajoute places

            // Sécurité anti-débordement : Ne peut pas dépasser la capacité totale initiale fixée
            if ($event->getAvailableSeats() > $event->getTotalSeats()) { 
                $event->setAvailableSeats($event->getTotalSeats());
            } 
            $this->entityManager->flush(); 
            $this->entityManager->commit(); 
            return true; 
        } catch (\Exception $e) { 
            $this->entityManager->rollback(); 
            throw $e; 
        } 
    } 

    /**
     * Construit le dictionnaire de disponibilité (Status des stocks).
     */
    public function getAvailability(string $eventId): array
    { 
        $event = $this->getEvent($eventId); 
        return [ 
            'eventId'        => $event->getId()->toRfc4122(), 
            'totalSeats'     => $event->getTotalSeats(), 
            'availableSeats' => $event->getAvailableSeats(),
            'soldOut'        => $event->getAvailableSeats() === 0,
            'status'         => $event->getStatus(), 
        ];
    } 

    /**
     * Valide si l'utilisateur à les droits d'écriture sur l'évènement ciblé.
     * @throws AccessDeniedHttpException Si l'accès est interdit
     */
    public function isAuthorized(Event $event, string $userId, array $userRoles): void
    { 
        // L'utilisateur doit être administrateur ou être le createur désigné de l'évènement
        if (!in_array('ROLE_ADMIN', $userRoles) && $event->getCreatorId()->toRfc4122() !== $userId) { 
            throw new AccessDeniedHttpException('You do not have permission to modify this event.'); 
        } 
    }
}
