<?php 

namespace App\Entity;
use App\Repository\TicketOptionRepository; 
use Doctrine\DBAL\Types\Types; 
use Doctrine\ORM\Mapping as ORM; 
use Symfony\Bridge\Doctrine\Types\UuidType; 
use Symfony\Component\Uid\Uuid; 
use Symfony\Component\Validator\Constraints as Assert; 
use Symfony\Component\Serializer\Attribute\Groups;

/**
 * Entité TicketOption – Représente une catégorie de billets pour un évènement.
 * Exemples : Standard, VIP.
 * Gère le prix spécifique, la quantité totale allouée et le solde disponible.
 */
#[ORM\Entity(repositoryClass: TicketOptionRepository::class)]
#[ORM\Table(name: '`ticket_option`')] 
class TicketOption
{ 

    // PROPRIÉTÉS (CHAMPS BDD)

    /**
     * Identifiant Unique (UUID).
     * Généré automatiquement via le générateur UUID Doctrine.
     */
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')] 
    #[Groups(['event:read', 'ticket_option:read'])]
    private ?Uuid $id = null; 

    /**
     * Évènement associé à cette option de billet.
     * Relation ManyToOne : Plusieurs options peuvent appartenir à un seul évènement.
     * onDelete: 'CASCADE' : Si l'évènement disparait, l'option disparait automatiquement.
     */
    #[ORM\ManyToOne(targetEntity: Event::class, inversedBy: 'ticketOptions')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['ticket_option:read'])]
    private ?Event $event = null;

    /**
     * Type ou nom de l'option (ex: "VIP", "Standard", "Étudiant").
     */
    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Groups(['event:read', 'ticket_option:read', 'ticket_option:write'])] 
    private ?string $type = null;

    /**
     * Prix unitaire du billet pour cette option.
     * Format DECIMAL pour la précision financière.
     */
    #[ORM\Column(type: Types::DECIMAL, precision: 10, scale: 2)]
    #[Assert\NotBlank]
    #[Assert\GreaterThanOrEqual(0)] 
    #[Groups(['event:read', 'ticket_option:read', 'ticket_option:write'])] 
    private ?string $price = null; 

    /**
     * Capacité maximale de billets à vendre pour cette option.
     */
    #[ORM\Column] 
    #[Assert\NotBlank]
    #[Assert\GreaterThanOrEqual(1)]
    #[Groups(['event:read', 'ticket_option:read', 'ticket_option:write'])]
    private ?int $quantity = null;

    /**
     * Nombre de billets encore disponibles à la vente dans cette catégorie.
     */
    #[ORM\Column] 
    #[Assert\NotBlank] 
    #[Assert\GreaterThanOrEqual(0)]
    #[Groups(['event:read', 'ticket_option:read'])] 
    private ?int $available = null; 

    // GETTERS & SETTERS
    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getEvent(): ?Event
    {
        return $this->event;
    }

    public function setEvent(?Event $event): static 
    {
        $this->event = $event;
        return $this;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;
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

    public function getQuantity(): ?int 
    {
        return $this->quantity;
    }

    public function setQuantity(int $quantity): static 
    {
        $this->quantity = $quantity;
        return $this;
    }

    public function getAvailable(): ?int
    {
        return $this->available;
    }

    public function setAvailable(int $available): static 
    {
        $this->available = $available;
        return $this;
    }
}
