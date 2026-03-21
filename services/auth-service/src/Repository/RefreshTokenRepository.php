<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\RefreshToken;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/**
 * Repository pour l'entité RefreshToken.
 * Gère les opérations sur les tokens de renouvellement.
 *
 * @extends ServiceEntityRepository<RefreshToken>
 */
class RefreshTokenRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, RefreshToken::class);
    }

    /**
     * Sauvegarde un refresh token en base.
     */
    public function save(RefreshToken $refreshToken, bool $flush = true): void
    {
        $this->getEntityManager()->persist($refreshToken);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Supprime un refresh token.
     */
    public function remove(RefreshToken $refreshToken, bool $flush = true): void
    {
        $this->getEntityManager()->remove($refreshToken);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Supprime TOUS les refresh tokens d'un utilisateur.
     * Appelé lors de la déconnexion pour invalider toutes les sessions.
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
     * Recherche un refresh token par son hash.
     * Utilisé lors du renouvellement du JWT.
     */
    public function findByToken(string $hashedToken): ?RefreshToken
    {
        return $this->findOneBy(['token' => $hashedToken]);
    }

    /**
     * Supprime les refresh tokens expirés.
     * À appeler périodiquement pour nettoyer la base.
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
