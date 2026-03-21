<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\RefreshTokenRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * Entité RefreshToken – Gère les tokens de renouvellement JWT.
 *
 * Le refresh token permet de renouveler un JWT expiré sans
 * que l'utilisateur ait à se reconnecter.
 *
 * Sécurité :
 * - Le token est HASHÉ en base (jamais en clair)
 * - Chaque token a une date d'expiration
 * - À la déconnexion, tous les refresh tokens de l'utilisateur sont supprimés
 * - Un seul refresh token actif par utilisateur (les anciens sont supprimés)
 */
#[ORM\Entity(repositoryClass: RefreshTokenRepository::class)]
#[ORM\Table(name: 'refresh_token')]
#[ORM\HasLifecycleCallbacks]
class RefreshToken
{
    // PROPRIÉTÉS

    /**
     * Identifiant unique UUID v4.
     */
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)]
    #[ORM\GeneratedValue(strategy: 'CUSTOM')]
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')]
    private ?Uuid $id = null;

    /**
     * UUID de l'utilisateur propriétaire du token.
     * Référence l'entité User par son ID.
     */
    #[ORM\Column(type: 'uuid')]
    private ?Uuid $userId = null;

    /**
     * Token hashé – JAMAIS stocké en clair.
     * Le hash est généré via password_hash() pour résister aux attaques.
     */
    #[ORM\Column(type: Types::STRING, length: 255, unique: true)]
    private ?string $token = null;

    /**
     * Date d'expiration du refresh token.
     * Passé cette date, le token ne peut plus être utilisé.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $expiresAt = null;

    /**
     * Date de création du token.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private ?\DateTimeImmutable $createdAt = null;

    // LIFECYCLE CALLBACKS

    /**
     * Initialise la date de création à l'insertion.
     */
    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    // GETTERS & SETTERS

    public function getId(): ?Uuid
    {
        return $this->id;
    }

    public function getUserId(): ?Uuid
    {
        return $this->userId;
    }

    public function setUserId(Uuid $userId): static
    {
        $this->userId = $userId;
        return $this;
    }

    public function getToken(): ?string
    {
        return $this->token;
    }

    public function setToken(string $token): static
    {
        $this->token = $token;
        return $this;
    }

    public function getExpiresAt(): ?\DateTimeImmutable
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(\DateTimeImmutable $expiresAt): static
    {
        $this->expiresAt = $expiresAt;
        return $this;
    }

    public function getCreatedAt(): ?\DateTimeImmutable
    {
        return $this->createdAt;
    }

    /**
     * Vérifie si le refresh token est expiré.
     */
    public function isExpired(): bool
    {
        return $this->expiresAt < new \DateTimeImmutable();
    }
}
