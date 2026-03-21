<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\ProfileRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Entité Profile – Représente le profil d'un utilisateur.
 *
 * Le profil est créé automatiquement par le Auth Service lors de l'inscription.
 * L'ID du profil est le MÊME que l'ID du User dans le Auth Service,
 * permettant la corrélation entre les deux services sans jointure.
 *
 * Le profil contient les informations personnelles de l'utilisateur
 * (nom, prénom, téléphone, avatar) qui ne sont PAS nécessaires
 * pour l'authentification (séparation des responsabilités).
 */
#[ORM\Entity(repositoryClass: ProfileRepository::class)]
#[ORM\Table(name: 'profile')]
#[ORM\HasLifecycleCallbacks]
class Profile
{
    // PROPRIÉTÉS

    /**
     * Identifiant UUID – MÊME que l'ID du User dans Auth Service.
     * N'est PAS auto-généré : il est passé par le Auth Service.
     */
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    private ?Uuid $id = null;

    /**
     * Prénom de l'utilisateur (optionnel).
     */
    #[ORM\Column(type: Types::STRING, length: 100, nullable: true)]
    #[Assert\Length(max: 100, maxMessage: 'Le prénom ne peut pas dépasser {{ limit }} caractères.')]
    private ?string $firstName = null;

    /**
     * Nom de famille de l'utilisateur (optionnel).
     */
    #[ORM\Column(type: Types::STRING, length: 100, nullable: true)]
    #[Assert\Length(max: 100, maxMessage: 'Le nom ne peut pas dépasser {{ limit }} caractères.')]
    private ?string $lastName = null;

    /**
     * Email de l'utilisateur – copié depuis le Auth Service.
     * Permet d'afficher l'email sans appeler le Auth Service.
     */
    #[ORM\Column(type: Types::STRING, length: 180)]
    #[Assert\NotBlank(message: "L'email est obligatoire.")]
    #[Assert\Email(message: "L'email '{{ value }}' n'est pas valide.")]
    private ?string $email = null;

    /**
     * Numéro de téléphone (optionnel).
     */
    #[ORM\Column(type: Types::STRING, length: 20, nullable: true)]
    #[Assert\Length(max: 20, maxMessage: 'Le téléphone ne peut pas dépasser {{ limit }} caractères.')]
    private ?string $phone = null;

    /**
     * URL de l'avatar (optionnel).
     */
    #[ORM\Column(type: Types::STRING, length: 255, nullable: true)]
    #[Assert\Url(message: "L'URL de l'avatar n'est pas valide.")]
    private ?string $avatarUrl = null;

    /**
     * Date de création du profil (immutable).
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    /**
     * Date de dernière modification du profil.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $updatedAt = null;

    // LIFECYCLE CALLBACKS

    /**
     * Initialise les dates de création et modification à l'insertion.
     */
    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $now = new \DateTimeImmutable();
        $this->createdAt = $now;
        $this->updatedAt = $now;
    }

    /**
     * Met à jour la date de modification à chaque update.
     */
    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    // GETTERS & SETTERS

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    /**
     * Définit l'ID – utilisé lors de la création depuis le Auth Service.
     * L'ID est le MÊME que celui du User dans le Auth Service.
     */
    public function setId(Uuid $id): static
    {
        $this->id = $id;
        return $this;
    }

    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function setFirstName(?string $firstName): static
    {
        $this->firstName = $firstName;
        return $this;
    }

    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setLastName(?string $lastName): static
    {
        $this->lastName = $lastName;
        return $this;
    }

    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;
        return $this;
    }

    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): static
    {
        $this->phone = $phone;
        return $this;
    }

    public function getAvatarUrl(): ?string
    {
        return $this->avatarUrl;
    }

    public function setAvatarUrl(?string $avatarUrl): static
    {
        $this->avatarUrl = $avatarUrl;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
