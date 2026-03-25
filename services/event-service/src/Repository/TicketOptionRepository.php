<?php

namespace App\Repository;
use App\Entity\TicketOption;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository; 
use Doctrine\Persistence\ManagerRegistry; 

/**
 * Repository pour l'entité TicketOption.
 * Fournit les méthodes de persistance et de suppression pour les choix de billets.
 * @extends ServiceEntityRepository<TicketOption>
 */
class TicketOptionRepository extends ServiceEntityRepository 
{ 
    public function __construct(ManagerRegistry $registry) 
    {
        parent::__construct($registry, TicketOption::class);
    } 

    /**
     * Sauvegarde une option de billet en base de données.
     * @param TicketOption $entity L'objet à sauvegarder
     * @param bool $flush Exécute l'écriture SQL immédiatement si vrai
     */
    public function save(TicketOption $entity, bool $flush = false): void
    {
        $this->getEntityManager()->persist($entity); 
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Supprime une option de billet de la base de données.
     */
    public function remove(TicketOption $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);
        if ($flush) {
            $this->getEntityManager()->flush();
        } 
    } 
}
