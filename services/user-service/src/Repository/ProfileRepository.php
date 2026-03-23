<?php

declare(strict_types=1);
namespace App\Repository;
use App\Entity\Profile;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Repository pour l'entité Profile.
 * Fournit les requêtes personnalisées pour la gestion des profils (Pagination, Comptage).
 * Hérite de ServiceEntityRepository pour bénéficier des méthodes standards.
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
     * flush = true par défaut pour exécuter immédiatement la requête INSERT/UPDATE SQL.
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
     * Recherche un profil par son adresse email, pratique pour des recherches rapides ou des liaisons sans ID.
     */
    public function findByEmail(string $email): ?Profile
    {
        return $this->findOneBy(['email' => $email]);
    }

    /**
     * Liste tous les profils avec un système de pagination, ordonne les résultats par date de création décroissante (Du plus récent au plus ancien).
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
     * Compte le nombre total de profils présents dans la table.
     */
    public function countAll(): int 
    { 
        return (int) $this->createQueryBuilder('p')
            ->select('COUNT(p.id)') 
            ->getQuery()
            ->getSingleScalarResult();
    }
}
