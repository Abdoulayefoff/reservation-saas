<?php 

namespace App\Repository; 
use App\Entity\Event;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry; 

/**
 * Repository de l'entité Event.
 * Fournit les méthodes de recherche personnalisées, notamment pour la liste
 * publique filtrée d'évènements.
 * @extends ServiceEntityRepository<Event>
 */
class EventRepository extends ServiceEntityRepository 
{ 

    /**
     * Constructeur injectant la connexion Doctrine.
     */
    public function __construct(ManagerRegistry $registry)
    { 
        parent::__construct($registry, Event::class);
    }

    /**
     * Sauvegarde un évènement (Persist + Flush optionnel).
     */
    public function save(Event $entity, bool $flush = false): void 
    { 
        $this->getEntityManager()->persist($entity);
        if ($flush) {
            $this->getEntityManager()->flush(); 
        }
    }

    /**
     * Supprime un évènement (Remove + Flush optionnel).
     */
    public function remove(Event $entity, bool $flush = false): void
    {
        $this->getEntityManager()->remove($entity);
        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    /**
     * Retourne la liste des évènements créés par un utilisateur spécifique.
     * Trié par date d'évènement décroissante (Les plus récents en premier).
     * @return Event[] Tableau d'objets Évènements
     */
    public function findByCreator(string $creatorId): array
    {
        return $this->createQueryBuilder('e')
            ->andWhere('e.creatorId = :val')
            ->setParameter('val', $creatorId)
            ->orderBy('e.eventDate', 'DESC')
            ->getQuery()
            ->getResult()
        ;
    }

    /**
     * Recherche les évènements PUBLIÉS en appliquant un tableau de FILTRES.
     * Gère la Pagination (Page / Limit) et le tri par date chronologique d'évènement.
     * @return Event[] Tableau d'évènements filtrés
     */
    public function findPublishedWithFilters(array $filters = [], int $page = 1, int $limit = 10): array
    {
        // Initialise la requête de base : Uniquement les évènements PUBLIÉ
        $qb = $this->createQueryBuilder('e') 
            ->andWhere('e.status = :status')
            ->setParameter('status', Event::STATUS_PUBLISHED);

        // APPLICATION DYNAMIQUE DES FILTRES

        // Filtre : Date (Uniquement les évènements qui ont lieu À PARTIR de cette date)
        if (isset($filters['date'])) {
            $qb->andWhere('e.eventDate >= :date')
                ->setParameter('date', new \DateTime($filters['date'])); 
        } 

        // Filtre : Lieu / Salle (Recherche partielle LIKE)
        if (isset($filters['venue'])) { 
            $qb->andWhere('e.venue LIKE :venue') 
                ->setParameter('venue', '%' . $filters['venue'] . '%'); 
        } 

        // Rétrocompatibilité legacy : 'location' mappe vers le champ 'venue'
        if (isset($filters['location'])) { 
            $qb->andWhere('e.venue LIKE :venue') 
                ->setParameter('venue', '%' . $filters['location'] . '%');
        }

        // Filtre : Prix minimum (Supérieur ou Égal)
        if (isset($filters['minPrice'])) {
            $qb->andWhere('e.price >= :minPrice') 
                ->setParameter('minPrice', $filters['minPrice']); 
        }

        // Filtre : Prix maximum (Inférieur ou Égal)
        if (isset($filters['maxPrice'])) { 
            $qb->andWhere('e.price <= :maxPrice') 
            ->setParameter('maxPrice', $filters['maxPrice']); 
        } 

        // ORDONNANCEMENT ET PAGINATION 
        $qb->orderBy('e.eventDate', 'ASC')
           ->setFirstResult(($page - 1) * $limit)
            ->setMaxResults($limit);

        return $qb->getQuery()->getResult();
    } 

    /**
     * Compte le nombre total d'évènements publiés.
     * Utile pour la méta-donnée de pagination (Total d'pages).
     */
    public function countPublished(): int 
    {
        return (int) $this->createQueryBuilder('e') 
            ->select('COUNT(e.id)') 
            ->andWhere('e.status = :status') 
            ->setParameter('status', Event::STATUS_PUBLISHED) 
            ->getQuery() 
            ->getSingleScalarResult(); 
    }
}
