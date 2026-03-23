<?php

declare(strict_types=1);
namespace App\Service; 
use App\Entity\Profile; 
use App\Repository\ProfileRepository; 
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\HttpClient\HttpClientInterface; 

/**
 * Service de gestion des profils utilisateurs.
 *
 * Responsabilités principale :
 * - CRUD des profils (Créer, Lire, Modifier, Supprimer)
 * - Validation des permissions d'accès (propriétaire ou administrateur)
 * - Communication synchrone avec le Ticket Service pour lister les billets
 *
 * Le User Service reçoit les informations d'authentification de l'utilisateur
 * via les headers X-User-Id et X-User-Roles injectés par l'API Gateway.
 */
class UserService
{
    public function __construct(
        private readonly ProfileRepository $profileRepository,
        private readonly HttpClientInterface $httpClient, 
        private readonly string $ticketServiceUrl,
    ) {} 

    // CRÉATION DE PROFIL (endpoint interne)

    /**
     * Crée un profil utilisateur miroir en base.
     * Appelé par le Auth Service lors de l'inscription via Docker.
     *
     * @param string $id    UUID du User (le même que dans le Auth Service)
     * @param string $email Email de l'utilisateur
     * @return Profile Le profil créé
     * @throws \InvalidArgumentException Si le profil existe déjà
     */
    public function createProfile(string $id, string $email): Profile
    { 
        // Vérifier l'absence de doublon : Aucun profil ne doit avoir cet ID
        $existing = $this->profileRepository->find(Uuid::fromString($id)); 
        if ($existing) { // Si un profil est déjà trouvé
            throw new \InvalidArgumentException('Un profil avec cet ID existe déjà.'); 
        } 
        $profile = new Profile(); // Nouvel objet
        $profile->setId(Uuid::fromString($id)); // Force l'ID à être équivalent à celui du Auth Service
        $profile->setEmail($email);
        $this->profileRepository->save($profile); 
        return $profile; 
    } 

    // LECTURE (RETRIEVE)

    /**
     * Récupère un profil par son UUID.
     */
    public function getProfile(string $id): ?Profile
    { 
        return $this->profileRepository->find(Uuid::fromString($id)); 
    }

    /**
     * Liste tous les profils avec un système de pagination.
     * @return array{profiles: array, total: int, page: int, limit: int}
     */
    public function listProfiles(int $page = 1, int $limit = 20): array
    {
        // Appel au repo personnalisé pour extraire un sous-ensemble (Page)
        $profiles = $this->profileRepository->findAllPaginated($page, $limit);
        $total = $this->profileRepository->countAll();

        return [
            'profiles' => array_map([$this, 'serializeProfile'], $profiles),
            'total' => $total, 
            'page' => $page,
            'limit' => $limit,
        ]; 
    }

    // MISE À JOUR (UPDATE)

    /**
     * Met à jour les informations d'un profil.
     * Seuls les champs explicitement fournis sont modifiés (Mise à jour partielle).
     *
     * @param string $id   UUID du profil
     * @param array  $data Données à mettre à jour
     * @return Profile Le profil mis à jour
     * @throws \InvalidArgumentException Si le profil n'existe pas
     */
    public function updateProfile(string $id, array $data): Profile
    {
        $profile = $this->getProfile($id);
        if (!$profile) { 
            throw new \InvalidArgumentException('Profil introuvable.'); 
        } 

        // Mettre à jour uniquement les champs fournis dans le tableau $data
        if (isset($data['first_name'])) { 
            $profile->setFirstName($data['first_name']); 
        }
        if (isset($data['last_name'])) { 
            $profile->setLastName($data['last_name']);
        } 
        if (isset($data['phone'])) { 
            $profile->setPhone($data['phone']);
        } 
        if (isset($data['avatar_url'])) { 
            $profile->setAvatarUrl($data['avatar_url']); 
        }
        $this->profileRepository->save($profile); 
        return $profile; 
    }

    // SUPPRESSION (DELETE)

    /**
     * Supprime définitivement un profil utilisateur.
     * @throws \InvalidArgumentException Si le profil n'existe pas
     */
    public function deleteProfile(string $id): void
    { 
        $profile = $this->getProfile($id);
        if (!$profile) { 
            throw new \InvalidArgumentException('Profil introuvable.');
        }
        $this->profileRepository->remove($profile); 
    }

    // BILLETS UTILISATEUR

    /**
     * Récupère les billets d'un utilisateur depuis le Ticket Service.
     * Appel HTTP GET synchrone vers le Ticket Service.
     * @param string $userId UUID de l'utilisateur
     * @return array Liste des billets
     */
    public function getUserTickets(string $userId): array
    { 
        try {
            // Requête GET /tickets/user/{userId} via HttpClient Symfony
            $response = $this->httpClient->request(
                'GET', 
                $this->ticketServiceUrl . '/tickets/user/' . $userId,
                ['timeout' => 5] 
            ); 
            return $response->toArray(); 
        } catch (\Throwable $e) {
            return ['tickets' => [], 'error' => 'Service de billetterie temporairement indisponible.'];
        } 
    }

    // SÉRIALISATION

    /**
     * Sérialise un objet Profil en tableau plat pour la réponse JSON.
     */
    public function serializeProfile(Profile $profile): array
    { 
        return [ // Construit le dictionnaire de sortie
            'id' => (string) $profile->getId(), 
            'first_name' => $profile->getFirstName(), 
            'last_name' => $profile->getLastName(),
            'email' => $profile->getEmail(),
            'phone' => $profile->getPhone(),
            'avatar_url' => $profile->getAvatarUrl(),
            'created_at' => $profile->getCreatedAt()?->format(\DateTimeInterface::ATOM), 
            'updated_at' => $profile->getUpdatedAt()?->format(\DateTimeInterface::ATOM),
        ]; 
    }

    //  VÉRIFICATION DES PERMISSIONS (AUTHORIZATION)

    /**
     * Vérifie si l'utilisateur courant est habilité à accéder/modifier un profil.
     * Un utilisateur peut voir/modifier uniquement son PROPRE profil.
     * Un administrateur peut voir/modifier TOUS les profils.
     *
     * @param string $profileId  UUID du profil ciblé par l'action
     * @param string $userId     UUID de l'utilisateur connecté (fourni par X-User-Id)
     * @param string $userRoles  Liste des rôles de l'utilisateur (fourni par X-User-Roles)
     * @return bool true si l'accès est légitime
     */
    public function isAuthorized(string $profileId, string $userId, string $userRoles): bool
    { 
        // Un Administrateur a TOUS les droits par défaut
        if (str_contains($userRoles, 'ROLE_ADMIN')) { 
            return true;
        } 
        // Sinon, l'accès est légal uniquement si l'ID cible est identique à l'ID demandeur
        return $profileId === $userId; 
    } 
}
