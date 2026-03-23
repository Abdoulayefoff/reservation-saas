<?php

namespace App\Entity;
use App\Repository\EventRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Serializer\Attribute\Groups;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;

/**
 * Entité Event – Représente un évènement dans le système.
 * Contient les informations de base (titre, date, lieu, prix) ainsi que
 * la gestion des capacités de places.
 * Indexé sur creator_id, event_date et status pour optimiser les requêtes de filtrage.
 */
#[ORM\Entity(repositoryClass: EventRepository::class)]
#[ORM\Table(name: '`event`')]
#[ORM\Index(name: 'idx_creator_id', columns: ['creator_id'])]
#[ORM\Index(name: 'idx_event_date', columns: ['event_date'])]
#[ORM\Index(name: 'idx_status', columns: ['status'])]
class Event
{
    //  CONSTANTES DE STATUT
    const STATUS_DRAFT     = 'DRAFT'; // Brouillon : Non visible du public
    const STATUS_PUBLISHED = 'PUBLISHED'; // Publié : Réservations ouvertes
    const STATUS_CANCELLED = 'CANCELLED'; // Annulé : Remboursements/Blocages

    // PROPRIÉTÉS (CHAMPS BDD)

    /**
     * Identifiant Unique (UUID).
     * Généré automatiquement via le générateur UUID Doctrine.
     */
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')] 
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    #[Groups(['event:read'])]
    private ?Uuid $id = null;

    /**
     * Titre de l'évènement.
     */
    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['event:read', 'event:write'])] 
    private ?string $title = null;

    /**
     * Description détaillée de l'évènement.
     */
    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['event:read', 'event:write'])]
    private ?string $description = null; 

    /**
     * Date et heure de l'évènement.
     * Doit être supérieure à la date du jour (Pas de passé).
     */
    #[ORM\Column(name: 'event_date', type: Types::DATETIME_MUTABLE)]
    #[Assert\NotBlank]
    #[Assert\GreaterThan('today')]
    #[Groups(['event:read', 'event:write'])]
    private ?\DateTimeInterface $eventDate = null;

    /**
     * Lieu / Salle de l'évènement.
     */
    #[ORM\Column(name: 'venue', length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['event:read', 'event:write'])]
    private ?string $venue = null;

    /**
     * Prix de base de l'évènement (Généralement Ticket Standard).
     * Stocké en DECIMAL pour éviter les erreurs d'arrondis des flottants.
     */
    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2)]
    #[Assert\NotBlank] 
    #[Assert\GreaterThanOrEqual(0)]
    #[Groups(['event:read', 'event:write'])]
    private ?string $price = null;
    /**
     * Capacité d'accueil totale de l'évènement.
     */
    #[ORM\Column(name: 'total_seats')]
    #[Assert\NotBlank]
    #[Assert\GreaterThanOrEqual(1)]
    #[Groups(['event:read', 'event:write'])]
    private ?int $totalSeats = null;

    /**
     * Nombre de places encore disponibles à la vente.
     */
    #[ORM\Column(name: 'available_seats')]
    #[Assert\NotBlank] 
    #[Assert\GreaterThanOrEqual(0)]
    #[Groups(['event:read'])]
    private ?int $availableSeats = null;

    /**
     * UUID du créateur de l'évènement (Organisateur).
     */
    #[ORM\Column(type: UuidType::NAME)]
    #[Assert\NotBlank]
    #[Groups(['event:read'])]
    private ?Uuid $creatorId = null;

    /**
     * Statut actuel de l'évènement (DRAFT par défaut).
     */
    #[ORM\Column(name: 'status', length: 50)]
    #[Groups(['event:read'])]
    private string $status = self::STATUS_DRAFT;

    /**
     * Date de création de l'enregistrement.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    #[Groups(['event:read'])]
    private ?\DateTimeImmutable $createdAt = null;

    /**
     * Date de dernière modification de l'enregistrement.
     */
    #[ORM\Column(type: Types::DATETIME_MUTABLE)] 
    #[Groups(['event:read'])]
    private ?\DateTimeInterface $updatedAt = null;

    /**
     * Liste des options de billets rattachées à cet évènement.
     * Relation bidirectionnelle OneToMany vers TicketOption.
     * Cascade persist et remove : Si l'évènement meurt, les options meurent avec lui.
     */
    #[ORM\OneToMany(mappedBy: 'event', targetEntity: TicketOption::class, cascade: ['persist', 'remove'])]
    #[Groups(['event:read'])]
    private Collection $ticketOptions;

    // CONSTRUCTEUR
    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTime(); 
        $this->ticketOptions = new ArrayCollection();
    } 

    /**
     * Déclencheur automatique avant chaque UPDATE SQL.
     */
    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTime();
    }

    // GETTERS & SETTERS

    public function getId(): ?Uuid 
    {
        return $this->id;
    }

    public function getTitle(): ?string
    {
        return $this->title;
    }

    public function setTitle(string $title): static 
    {
        $this->title = $title;
        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): static
    {
        $this->description = $description;
        return $this;
    }

    public function getEventDate(): ?\DateTimeInterface
    {
        return $this->eventDate;
    }

    public function setEventDate(\DateTimeInterface $eventDate): static
    {
        $this->eventDate = $eventDate;
        return $this;
    }

    public function getVenue(): ?string
    {
        return $this->venue;
    }

    public function setVenue(string $venue): static
    {
        $this->venue = $venue;
        return $this;
    }

    public function getPrice(): ?string
    {
        return $this->price;
    }

    public function setPrice(string $price): static 
    {
        $this->price = $price;
        return $this;
    }

    public function getTotalSeats(): ?int
    {
        return $this->totalSeats;
    }

    public function setTotalSeats(int $totalSeats): static
    {
        $this->totalSeats = $totalSeats;
        return $this;
    }

    public function getAvailableSeats(): ?int
    {
        return $this->availableSeats;
    }

    public function setAvailableSeats(int $availableSeats): static
    {
        $this->availableSeats = $availableSeats;
        return $this;
    }

    public function getCreatorId(): ?Uuid
    {
        return $this->creatorId;
    }

    public function setCreatorId(Uuid $creatorId): static
    {
        $this->creatorId = $creatorId;
        return $this;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): static
    {
        $this->status = $status;
        return $this;
    }

    /**
     * Vérificateur rapide de l'état de publication.
     */
    public function isPublished(): bool // Booléen
    { 
        return $this->status === self::STATUS_PUBLISHED; 
    } 

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static 
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): ?\DateTimeInterface
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(\DateTimeInterface $updatedAt): static 
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    // GESTION DE LA COLLECTION TICKET OPTIONS

    /**
     * @return Collection<int, TicketOption> Retrouve la collection typée
     */
    public function getTicketOptions(): Collection
    { 
        return $this->ticketOptions;
    } 

    /**
     * Ajoute une option de billet si elle n'est pas déjà présente.
     * Configure le côté inverse de la relation (setEvent).
     */
    public function addTicketOption(TicketOption $ticketOption): static 
    {
        if (!$this->ticketOptions->contains($ticketOption)) { // Évite les doublons
            $this->ticketOptions->add($ticketOption); // Ajout local
            $ticketOption->setEvent($this); // Force la clé étrangère sur l'enfant
        } 
        return $this;
    } 

    /**
     * Supprime une option de billet de la collection.
     */
    public function removeTicketOption(TicketOption $ticketOption): static 
    { 
        if ($this->ticketOptions->removeElement($ticketOption)) { 
            if ($ticketOption->getEvent() === $this) { 
                $ticketOption->setEvent(null); 
            } 
        } 
        return $this; 
    } 
}
