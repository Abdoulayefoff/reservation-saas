<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Repository pour l'entité Profile.
 * Fournit les requêtes personnalisées pour la gestion des profils.
 *
 * @extends ServiceEntityRepository<Profile>
 */
class ProfileRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Profile::class);
    }

    /**
     * Sauvegarde un profil en base de données.
     */
    public function save(Profile $profile, bool $flush = true): void
    {
        $this->getEntityManager()->persist($profile);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Supprime un profil de la base de données.
     */
    public function remove(Profile $profile, bool $flush = true): void
    {
        $this->getEntityManager()->remove($profile);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Recherche un profil par email.
     */
    public function findByEmail(string $email): ?Profile
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * Liste tous les profils avec pagination.
     *
     * @return Profile[]
     */
    public function findAllPaginated(int $page = 1, int $limit = 20): array
    {
        return $this->createQueryBuilder('p')
            ->orderBy('p.createdAt', 'DESC')
            ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Compte le nombre total de profils.
     */
    public function countAll(): int
    {
        return (int) $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->getQuery()
            ->getSingleScalarResult();
    }
}
