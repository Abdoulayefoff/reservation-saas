<?php 

declare(strict_types=1); 
namespace App\Repository; 
use App\Entity\RefreshToken; 
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository; 
use Doctrine\Persistence\ManagerRegistry; 
use Symfony\Component\Uid\Uuid; 

/**
 * Repository pour l'entité RefreshToken.
 * 
 * Gère les requêtes DQL (Doctrine Query Language) sur les tokens de renouvellement.
 * Hérite de ServiceEntityRepository pour bénéficier des méthodes standards (find, findBy).
 *
 * @extends ServiceEntityRepository<RefreshToken>
 */
class RefreshTokenRepository extends ServiceEntityRepository 
{ 

    /**
     * Constructeur injectant le ManagerRegistry (Connexion BDD).
     */
    public function __construct(ManagerRegistry $registry) 
    { 
        parent::__construct($registry, RefreshToken::class);
    }

    /**
     * Sauvegarde un refresh token en base de données.
     * 
     * flush = true par défaut pour exécuter immédiatement la requête INSERT/UPDATE SQL.
     */
    public function save(RefreshToken $refreshToken, bool $flush = true): void 
    { 
        $this->getEntityManager()->persist($refreshToken); 
        
        if ($flush) { 
            $this->getEntityManager()->flush(); 
        } 
    } 

    /**
     * Supprime un refresh token de la base de données.
     */
    public function remove(RefreshToken $refreshToken, bool $flush = true): void 
    { 
        $this->getEntityManager()->remove($refreshToken); 
        
        if ($flush) { 
            $this->getEntityManager()->flush(); 
        } 
    } 

    /**
     * Supprime TOUS les refresh tokens d'un utilisateur donné.
     * 
     * Appelé lors de la déconnexion pour invalider toutes les sessions actives.
     */
    public function removeAllForUser(Uuid $userId): void
    { 
        $this->createQueryBuilder('rt') 
            ->delete()
            ->where('rt.userId = :userId') 
            ->setParameter('userId', $userId, 'uuid') 
            ->getQuery() 
            ->execute(); 
    }

    /**
     * Recherche un refresh token par son hash de sécurité.
     * 
     * Utilisé principalement lors de l'appel /auth/refresh pour valider la session.
     */
    public function findByToken(string $hashedToken): ?RefreshToken 
    { 
        return $this->findOneBy(['token' => $hashedToken]); 
    } 

    /**
     * Supprime les refresh tokens ayant dépassé leur date d'expiration.
     * 
     * À appeler périodiquement (Cron/Command) pour nettoyer la base.
     */
    public function removeExpired(): int 
    {
        return $this->createQueryBuilder('rt') 
            ->delete() 
            ->where('rt.expiresAt < :now') 
            ->setParameter('now', new \DateTimeImmutable()) 
            ->getQuery() 
            ->execute();
    } 
} 
