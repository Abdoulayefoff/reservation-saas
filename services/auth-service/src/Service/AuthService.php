<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\RefreshToken;
use App\Entity\User;
use App\Repository\RefreshTokenRepository;
use App\Repository\UserRepository;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Service principal d'authentification.
 *
 * Gère toutes les opérations d'authentification :
 * - Inscription (register) avec création automatique du profil dans le User Service
 * - Connexion (login) avec génération du JWT et du refresh token
 * - Déconnexion (logout) avec suppression des refresh tokens
 * - Renouvellement du JWT via refresh token
 *
 * Sécurité :
 * - Mots de passe hashés via bcrypt (coût ≥ 12)
 * - Refresh tokens hashés en base (hash_hmac SHA-256)
 * - Tokens générés avec openssl_random_pseudo_bytes (cryptographiquement sûr)
 */
class AuthService
{
    public function __construct(
        private readonly UserRepository $userRepository,
        private readonly RefreshTokenRepository $refreshTokenRepository,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly HttpClientInterface $httpClient,
        private readonly string $userServiceUrl,
        private readonly int $jwtRefreshTtl,
    ) {}

    // INSCRIPTION

    /**
     * Inscrit un nouvel utilisateur.
     *
     * 1. Vérifie que l'email n'est pas déjà pris
     * 2. Crée l'entité User avec le mot de passe hashé
     * 3. Appelle le User Service pour créer le profil associé
     * 4. Retourne l'utilisateur créé
     *
     * @throws \InvalidArgumentException Si l'email est déjà utilisé
     */
    public function register(string $email, string $password, array $roles = ['ROLE_USER']): User
    {
        // Vérifier l'unicité de l'email
        if ($this->userRepository->findByEmail($email)) {
            throw new \InvalidArgumentException('Un compte avec cet email existe déjà.');
        }

        // Créer l'utilisateur
        $user = new User();
        $user->setEmail($email);
        $user->setRoles($roles);

        // Hasher le mot de passe (bcrypt avec coût auto ≥ 12)
        $hashedPassword = $this->passwordHasher->hashPassword($user, $password);
        $user->setPassword($hashedPassword);

        // Persister en base
        $this->userRepository->save($user);

        // Créer le profil dans le User Service (appel HTTP asynchrone)
        $this->createUserProfile($user);

        return $user;
    }

    // CONNEXION

    /**
     * Authentifie un utilisateur et génère les tokens.
     *
     * 1. Recherche l'utilisateur par email
     * 2. Vérifie le mot de passe
     * 3. Vérifie que le compte est actif
     * 4. Génère un JWT et un refresh token
     *
     * @return array{token: string, refresh_token: string, user: array}
     * @throws \InvalidArgumentException Si les credentials sont invalides
     */
    public function login(string $email, string $password): array
    {
        // Rechercher l'utilisateur
        $user = $this->userRepository->findByEmail($email);

        // Vérifier que l'utilisateur existe et que le mot de passe est correct
        if (!$user || !$this->passwordHasher->isPasswordValid($user, $password)) {
            throw new \InvalidArgumentException('Email ou mot de passe incorrect.');
        }

        // Vérifier que le compte est actif
        if (!$user->isActive()) {
            throw new \InvalidArgumentException('Ce compte a été désactivé.');
        }

        // Générer le JWT via LexikBundle
        $jwt = $this->jwtManager->create($user);

        // Générer et sauvegarder le refresh token
        $refreshTokenString = $this->generateRefreshToken($user);

        return [
            'token' => $jwt,
            'refresh_token' => $refreshTokenString,
            'user' => $this->serializeUser($user),
        ];
    }

    // DÉCONNEXION

    /**
     * Déconnecte un utilisateur en supprimant tous ses refresh tokens.
     * Le JWT reste valide jusqu'à son expiration naturelle (stateless).
     */
    public function logout(User $user): void
    {
        $this->refreshTokenRepository->removeAllForUser($user->getId());
    }

    // RENOUVELLEMENT DU JWT

    /**
     * Renouvelle le JWT à partir d'un refresh token valide.
     *
     * 1. Hash le refresh token reçu
     * 2. Recherche le hash en base
     * 3. Vérifie l'expiration
     * 4. Supprime l'ancien refresh token (rotation)
     * 5. Génère un nouveau JWT et un nouveau refresh token
     *
     * @return array{token: string, refresh_token: string, user: array}
     * @throws \InvalidArgumentException Si le refresh token est invalide ou expiré
     */
    public function refresh(string $refreshTokenString): array
    {
        // Hasher le token reçu pour le comparer
        $hashedToken = $this->hashRefreshToken($refreshTokenString);
        $refreshToken = $this->refreshTokenRepository->findByToken($hashedToken);

        // Vérifier que le token existe
        if (!$refreshToken) {
            throw new \InvalidArgumentException('Refresh token invalide.');
        }

        // Vérifier l'expiration
        if ($refreshToken->isExpired()) {
            // Supprimer le token expiré
            $this->refreshTokenRepository->remove($refreshToken);
            throw new \InvalidArgumentException('Refresh token expiré.');
        }

        // Récupérer l'utilisateur
        $user = $this->userRepository->find($refreshToken->getUserId());
        if (!$user || !$user->isActive()) {
            throw new \InvalidArgumentException('Utilisateur introuvable ou désactivé.');
        }

        // Rotation du token : supprimer l'ancien et en créer un nouveau
        $this->refreshTokenRepository->remove($refreshToken);

        // Générer un nouveau JWT et un nouveau refresh token
        $jwt = $this->jwtManager->create($user);
        $newRefreshTokenString = $this->generateRefreshToken($user);

        return [
            'token' => $jwt,
            'refresh_token' => $newRefreshTokenString,
            'user' => $this->serializeUser($user),
        ];
    }

    // MÉTHODES PRIVÉES

    /**
     * Génère un refresh token sécurisé et le sauvegarde en base.
     * Le token brut est retourné au client, seul le hash est stocké.
     */
    private function generateRefreshToken(User $user): string
    {
        // Supprimer les anciens refresh tokens de l'utilisateur
        $this->refreshTokenRepository->removeAllForUser($user->getId());

        // Générer un token aléatoire cryptographiquement sûr
        $rawToken = bin2hex(random_bytes(64));

        // Créer l'entité RefreshToken avec le hash du token
        $refreshToken = new RefreshToken();
        $refreshToken->setUserId($user->getId());
        $refreshToken->setToken($this->hashRefreshToken($rawToken));
        $refreshToken->setExpiresAt(
            new \DateTimeImmutable(sprintf('+%d seconds', $this->jwtRefreshTtl))
        );

        $this->refreshTokenRepository->save($refreshToken);

        // Retourner le token brut (non hashé) au client
        return $rawToken;
    }

    /**
     * Hash un refresh token avec HMAC SHA-256.
     * Utilise l'algorithme SHA-256 pour un stockage sécurisé en base.
     */
    private function hashRefreshToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Crée le profil utilisateur dans le User Service.
     * Appel HTTP POST vers le User Service.
     * En cas d'échec, l'utilisateur est quand même créé (le profil pourra être créé plus tard).
     */
    private function createUserProfile(User $user): void
    {
        try {
            $this->httpClient->request('POST', $this->userServiceUrl . '/users/internal/create', [
                'json' => [
                    'id' => (string) $user->getId(),
                    'email' => $user->getEmail(),
                ],
                'timeout' => 5,
            ]);
        } catch (\Throwable $e) {
            // Log l'erreur mais ne pas bloquer l'inscription
            // Le profil pourra être créé ultérieurement
            error_log(sprintf(
                '[AuthService] Erreur création profil pour %s : %s',
                $user->getEmail(),
                $e->getMessage()
            ));
        }
    }

    /**
     * Sérialise un utilisateur en tableau pour la réponse JSON.
     * N'inclut JAMAIS le mot de passe.
     */
    public function serializeUser(User $user): array
    {
        return [
            'id' => (string) $user->getId(),
            'email' => $user->getEmail(),
            'roles' => $user->getRoles(),
            'is_active' => $user->isActive(),
            'created_at' => $user->getCreatedAt()?->format(\DateTimeInterface::ATOM),
            'updated_at' => $user->getUpdatedAt()?->format(\DateTimeInterface::ATOM),
        ];
    }
}
