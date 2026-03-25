<?php 

declare(strict_types=1); 

namespace App\Entity;

use App\Repository\UserRepository; 
use Doctrine\DBAL\Types\Types; 
use Doctrine\ORM\Mapping as ORM; 
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity; 
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface; 
use Symfony\Component\Security\Core\User\UserInterface; 
use Symfony\Component\Uid\Uuid; 
use Symfony\Component\Validator\Constraints as Assert; 

/**
 * Entité User – Représente un compte utilisateur dans le système d'authentification.
 *
 * Chaque utilisateur possède :
 * - Un UUID unique comme identifiant primaire
 * - Un email unique servant d'identifiant de connexion
 * - Un mot de passe hashé (bcrypt, jamais en clair)
 * - Un ou plusieurs rôles RBAC (ROLE_USER, ROLE_EVENT_CREATOR, ROLE_ADMIN)
 * - Un statut actif/inactif pour la désactivation de compte
 *
 * Cette entité implémente UserInterface et PasswordAuthenticatedUserInterface
 * pour s'intégrer nativement avec le système de sécurité Symfony.
 */
#[ORM\Entity(repositoryClass: UserRepository::class)] 
#[ORM\Table(name: '"user"')] 
#[ORM\HasLifecycleCallbacks] 
#[UniqueEntity(fields: ['email'], message: 'Un compte avec cet email existe déjà.')] 
class User implements UserInterface, PasswordAuthenticatedUserInterface 
{ 

    //  PROPRIÉTÉS (CHAMPS DE LA BASE DE DONNÉES) 

    /**
     * Identifiant unique UUID v4.
     * Généré automatiquement par Doctrine lors de l'insertion.
     */
    #[ORM\Id]
    #[ORM\Column(type: 'uuid', unique: true)] 
    #[ORM\GeneratedValue(strategy: 'CUSTOM')] 
    #[ORM\CustomIdGenerator(class: 'doctrine.uuid_generator')] 
    private ?Uuid $id = null;

    /**
     * Adresse email – sert d'identifiant de connexion.
     * Unique dans toute la table, validée par format.
     */
    #[ORM\Column(type: Types::STRING, length: 180, unique: true)] 
    #[Assert\NotBlank(message: "L'email est obligatoire.")] 
    #[Assert\Email(message: "L'email '{{ value }}' n'est pas valide.")] 
    private ?string $email = null; 

    /**
     * Mot de passe hashé (bcrypt).
     * JAMAIS stocké en clair – le hashage est effectué par AuthService.
     */
    #[ORM\Column(type: Types::STRING, length: 255)]
    private ?string $password = null; 

    /**
     * Rôles RBAC de l'utilisateur.
     * Stockés en JSON. ROLE_USER est toujours inclus par défaut.
     */
    #[ORM\Column(type: Types::JSON)] 
    private array $roles = ['ROLE_USER']; 

    /**
     * Statut du compte – permet la désactivation sans suppression.
     * Un compte inactif ne peut pas se connecter.
     */
    #[ORM\Column(type: Types::BOOLEAN)] 
    private bool $isActive = true;

    /**
     * Date de création du compte (immutable).
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)] 
    private ?\DateTimeImmutable $createdAt = null; 

    /**
     * Date de dernière modification du compte.
     */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)] 
    private ?\DateTimeImmutable $updatedAt = null; 

    //  LIFECYCLE CALLBACKS (DÉCLENCHEURS ET ACTIONS AUTOMATIQUES) 

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
     * Met à jour la date de modification à chaque mise à jour.
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

    public function getEmail(): ?string 
    { 
        return $this->email;
    }

    public function setEmail(string $email): static 
    { 
        $this->email = $email; 
        return $this; 
    } 

    /**
     * Identifiant utilisé par Symfony Security.
     * Retourne l'email car c'est notre champ de connexion unique.
     */
    public function getUserIdentifier(): string 
    { 
        return (string) $this->email; 
    } 

    /**
     * Retourne les rôles de l'utilisateur.
     * ROLE_USER est toujours garanti d'être présent.
     */
    public function getRoles(): array 
    {
        $roles = $this->roles; 
        $roles[] = 'ROLE_USER'; 
        return array_unique($roles); 
    }

    public function setRoles(array $roles): static 
    { 
        $this->roles = $roles;
        return $this; 
    } 

    public function getPassword(): ?string 
    {
        return $this->password; 
    }

    public function setPassword(string $password): static 
    { 
        $this->password = $password; 
        return $this; 
    } 

    /**
     * Méthode requise par UserInterface pour les algorithmes à ancien sel.
     * Utilisée pour nettoyer les données sensibles temporaires (ex: plainPassword).
     * Avec bcrypt, il n'y a rien à effacer.
     */
    public function eraseCredentials(): void 
    { 
        // Pas de données sensibles temporaires à effacer dans cette entité
    } 

    public function isActive(): bool 
    { 
        return $this->isActive;
    } 

    public function setIsActive(bool $isActive): static 
    { 
        $this->isActive = $isActive; 
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
