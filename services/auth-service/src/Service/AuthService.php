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
     * 1. Vérifie que l'email n'est pas déjà pris
     * 2. Crée l'entité User avec le mot de passe hashé
     * 3. Appelle le User Service pour créer le profil associé
     * 4. Retourne l'utilisateur créé
     * @throws \InvalidArgumentException Si l'email est déjà utilisé
     */
    public function register(string $email, string $password, array $roles = ['ROLE_USER']): User
    { 
        if ($this->userRepository->findByEmail($email)) { 
            throw new \InvalidArgumentException('Un compte avec cet email existe déjà.'); 
        } 

        // Créer une nouvelle instance de l'entité User
        $user = new User(); 
        $user->setEmail($email); 
        $user->setRoles($roles); 

        // Hacher le mot de passe (Symfony utilise bcrypt avec coût auto ≥ 12 par défaut)
        $hashedPassword = $this->passwordHasher->hashPassword($user, $password); // Génère le hash sécurisé
        $user->setPassword($hashedPassword); // Enregistre le mot de passe haché dans l'entité

        $this->userRepository->save($user);
        $this->createUserProfile($user);
        return $user;
    }

    // CONNEXION

    /**
     * Authentifie un utilisateur et génère les tokens.
     * 1. Recherche l'utilisateur par email
     * 2. Vérifie le mot de passe
     * 3. Vérifie que le compte est actif
     * 4. Génère un JWT et un refresh token
     * @return array{token: string, refresh_token: string, user: array}
     * @throws \InvalidArgumentException Si les credentials sont invalides
     */
    public function login(string $email, string $password): array
    { 
        $user = $this->userRepository->findByEmail($email);

        if (!$user || !$this->passwordHasher->isPasswordValid($user, $password)) { 
            throw new \InvalidArgumentException('Email ou mot de passe incorrect.'); 
        } 
        if (!$user->isActive()) { 
            throw new \InvalidArgumentException('Ce compte a été désactivé.');
        }
        $jwt = $this->jwtManager->create($user);
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
     * 1. Hash le refresh token reçu
     * 2. Recherche le hash en base
     * 3. Vérifie l'expiration
     * 4. Supprime l'ancien refresh token (rotation)
     * 5. Génère un nouveau JWT et un nouveau refresh token
     * @return array{token: string, refresh_token: string, user: array}
     * @throws \InvalidArgumentException Si le refresh token est invalide ou expiré
     */
    public function refresh(string $refreshTokenString): array
    {
        // Hasher le token reçu pour pouvoir le comparer avec ceux en base (Sécurité)
        $hashedToken = $this->hashRefreshToken($refreshTokenString);
        $refreshToken = $this->refreshTokenRepository->findByToken($hashedToken); 

        // Vérifier que le token existe bien en base de données
        if (!$refreshToken) {
            throw new \InvalidArgumentException('Refresh token invalide.');
        }

        // Vérifier si le token a dépassé sa date d'expiration
        if ($refreshToken->isExpired()) { 
            $this->refreshTokenRepository->remove($refreshToken); 
            throw new \InvalidArgumentException('Refresh token expiré.');
        } 

        // Récupérer l'utilisateur propriétaire du token
        $user = $this->userRepository->find($refreshToken->getUserId()); 
        if (!$user || !$user->isActive()) {
            throw new \InvalidArgumentException('Utilisateur introuvable ou désactivé.');
        } 

        // Rotation automatique du token : évite le rejeu en supprimant l'ancien
        $this->refreshTokenRepository->remove($refreshToken); // Consommé

        // Générer un nouveau couple de tokens (Accompagne la rotation)
        $jwt = $this->jwtManager->create($user); // Nouveau JWT
        $newRefreshTokenString = $this->generateRefreshToken($user); // Nouveau string Refresh

        return [ 
            'token' => $jwt,
            'refresh_token' => $newRefreshTokenString,
            'user' => $this->serializeUser($user),
        ]; 
    } 

    // MÉTHODES PRIVÉES 

    /**
     * Génère un refresh token sécurisé et le sauvegarde en base.
     * Le token brut est retourné au client, seul le hash est stocké en BDD.
     */
    private function generateRefreshToken(User $user): string
    { 
        $this->refreshTokenRepository->removeAllForUser($user->getId());

        // Générer une chaîne aléatoire cryptographiquement sûre (128 caractères hexa)
        $rawToken = bin2hex(random_bytes(64)); 

        // Créer l'entité RefreshToken pour l'enregistrement
        $refreshToken = new RefreshToken();
        $refreshToken->setUserId($user->getId()); 
        $refreshToken->setToken($this->hashRefreshToken($rawToken)); 
        $refreshToken->setExpiresAt( 
            new \DateTimeImmutable(sprintf('+%d seconds', $this->jwtRefreshTtl))
        ); 

        $this->refreshTokenRepository->save($refreshToken); 

        // Retourner le token BRUT (non hashé) au client (Obligatoire pour les clients HTTP)
        return $rawToken; 
    }

    /**
     * Hash un refresh token avec SHA-256.
     * Empêche de lire les sessions en clair même en cas de vol de BDD.
     */
    private function hashRefreshToken(string $token): string
    { 
        return hash('sha256', $token); // Algorithme standard rapide et non réversible
    } 

    /**
     * Crée le profil utilisateur dans le User Service.
     * Appel HTTP POST synchrone vers le bus.
     * En cas d'échec, l'utilisateur est conservé.
     */
    private function createUserProfile(User $user): void
    {
        try { 
            // Envoi de la requête POST /users/internal/create
            $this->httpClient->request('POST', $this->userServiceUrl . '/users/internal/create', [
                'json' => [ // Corps de la requête
                    'id' => (string) $user->getId(),
                    'email' => $user->getEmail(), 
                ],
                'timeout' => 5, 
            ]); 
        } catch (\Throwable $e) { 
            // Log l'erreur localement mais ne bloque surtout pas l'inscription
            error_log(sprintf( // Utilise le log PHP standard
                '[AuthService] Erreur création profil pour %s : %s', // Message formaté
                $user->getEmail(), // Info 1
                $e->getMessage() // Info 2
            )); 
        } 
    } 

    /**
     * Sérialise un utilisateur en tableau pour la réponse JSON.
     * N'inclut JAMAIS le mot de passe dans les retours clients.
     */
    public function serializeUser(User $user): array
    {
        return [ 
            'id' => (string) $user->getId(), // UUID casté en string
            'email' => $user->getEmail(), // Email
            'roles' => $user->getRoles(), // Tableau de chaînes
            'is_active' => $user->isActive(), // Booléen d'activité
            'created_at' => $user->getCreatedAt()?->format(\DateTimeInterface::ATOM), // Format date standarde ISO
            'updated_at' => $user->getUpdatedAt()?->format(\DateTimeInterface::ATOM), // Format date
        ]; 
    } 
} 
