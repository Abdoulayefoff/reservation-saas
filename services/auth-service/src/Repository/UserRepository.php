<?php 

declare(strict_types=1);
namespace App\Repository;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository; 
use Doctrine\Persistence\ManagerRegistry; 

/**
 * Repository pour l'entité User.
 * Fournit les requêtes personnalisées pour la gestion des utilisateurs en base de données.
 * Hérite de ServiceEntityRepository pour bénéficier des méthodes standards (find, findAll, findBy).
 * @extends ServiceEntityRepository<User>
 */
class UserRepository extends ServiceEntityRepository
{ 

    /**
     * Constructeur injectant le ManagerRegistry (Connexion BDD).
     */
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class); 
    }

    /**
     * Sauvegarde un utilisateur en base de données.
     * flush = true par défaut pour exécuter immédiatement la requête INSERT/UPDATE SQL.
     */
    public function save(User $user, bool $flush = true): void 
    { 
        $this->getEntityManager()->persist($user);
        if ($flush) { 
            $this->getEntityManager()->flush(); 
        } 
    } 

    /**
     * Supprime un utilisateur de la base de données.
     */
    public function remove(User $user, bool $flush = true): void 
    { 
        $this->getEntityManager()->remove($user);
        if ($flush) {
            $this->getEntityManager()->flush(); 
        }
    }

    /**
     * Recherche un utilisateur par son adresse email.
     * Utilisé principalement pour le login et les vérifications d'unicité de compte.
     */
    public function findByEmail(string $email): ?User 
    {
        return $this->findOneBy(['email' => $email]);
    }
} 
