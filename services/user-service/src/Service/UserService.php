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
 * Responsabilités :
 * - CRUD des profils
 * - Validation des permissions (owner/admin)
 * - Communication avec le Ticket Service pour les billets
 *
 * Le User Service reçoit les informations d'authentification via
 * les headers X-User-Id et X-User-Roles injectés par l'API Gateway.
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
     * Crée un profil utilisateur.
     * Appelé par le Auth Service lors de l'inscription.
     *
     * @param string $id    UUID du User (même que dans Auth Service)
     * @param string $email Email de l'utilisateur
     * @return Profile Le profil créé
     * @throws \InvalidArgumentException Si le profil existe déjà
     */
    public function createProfile(string $id, string $email): Profile
    {
        // Vérifier qu'un profil avec cet ID n'existe pas déjà
        $existing = $this->profileRepository->find(Uuid::fromString($id));
        if ($existing) {
            throw new \InvalidArgumentException('Un profil avec cet ID existe déjà.');
        }

        $profile = new Profile();
        $profile->setId(Uuid::fromString($id));
        $profile->setEmail($email);

        $this->profileRepository->save($profile);

        return $profile;
    }

    // LECTURE

    /**
     * Récupère un profil par son UUID.
     */
    public function getProfile(string $id): ?Profile
    {
        return $this->profileRepository->find(Uuid::fromString($id));
    }

    /**
     * Liste tous les profils avec pagination.
     *
     * @return array{profiles: array, total: int, page: int, limit: int}
     */
    public function listProfiles(int $page = 1, int $limit = 20): array
    {
        $profiles = $this->profileRepository->findAllPaginated($page, $limit);
        $total = $this->profileRepository->countAll();

        return [
            'profiles' => array_map([$this, 'serializeProfile'], $profiles),
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
        ];
    }

    // MISE À JOUR

    /**
     * Met à jour les informations d'un profil.
     * Seuls les champs fournis sont modifiés.
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

        // Mettre à jour uniquement les champs fournis
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

    // SUPPRESSION

    /**
     * Supprime un profil utilisateur.
     *
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
     * Appel HTTP GET vers le Ticket Service.
     *
     * @param string $userId UUID de l'utilisateur
     * @return array Liste des billets
     */
    public function getUserTickets(string $userId): array
    {
        try {
            $response = $this->httpClient->request(
                'GET',
                $this->ticketServiceUrl . '/tickets/user/' . $userId,
                ['timeout' => 5]
            );

            return $response->toArray();
        } catch (\Throwable $e) {
            // En cas d'erreur, retourner un tableau vide
            // Le Ticket Service n'est peut-être pas encore implémenté
            return ['tickets' => [], 'error' => 'Service temporairement indisponible.'];
        }
    }

    // SÉRIALISATION

    /**
     * Sérialise un profil en tableau pour la réponse JSON.
     */
    public function serializeProfile(Profile $profile): array
    {
        return [
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

    // VÉRIFICATION DES PERMISSIONS

    /**
     * Vérifie si l'utilisateur courant a le droit d'accéder à un profil.
     * Un utilisateur peut voir/modifier son propre profil.
     * Un admin peut voir/modifier tous les profils.
     *
     * @param string $profileId  UUID du profil ciblé
     * @param string $userId     UUID de l'utilisateur connecté (depuis X-User-Id)
     * @param string $userRoles  Rôles de l'utilisateur (depuis X-User-Roles)
     * @return bool true si autorisé
     */
    public function isAuthorized(string $profileId, string $userId, string $userRoles): bool
    {
        // Admin peut tout faire
        if (str_contains($userRoles, 'ROLE_ADMIN')) {
            return true;
        }

        // L'utilisateur peut accéder à son propre profil
        return $profileId === $userId;
    }
}
