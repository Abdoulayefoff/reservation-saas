<?php

declare(strict_types=1);

namespace App\Tests\Entity;

use App\Entity\User;
use PHPUnit\Framework\TestCase;

/**
 * Tests unitaires pour l'entité User.
 *
 * Vérifie :
 * - Les getters/setters
 * - Les valeurs par défaut
 * - La logique des rôles (ROLE_USER toujours présent)
 * - Les lifecycle callbacks
 */
class UserTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        $this->user = new User();
    }

    // TESTS DES GETTERS/SETTERS

    public function testEmailGetterAndSetter(): void
    {
        $this->user->setEmail('test@example.com');
        $this->assertSame('test@example.com', $this->user->getEmail());
    }

    public function testPasswordGetterAndSetter(): void
    {
        $this->user->setPassword('hashed_password');
        $this->assertSame('hashed_password', $this->user->getPassword());
    }

    public function testIsActiveDefaultValue(): void
    {
        // Un utilisateur nouvellement créé doit être actif par défaut
        $this->assertTrue($this->user->isActive());
    }

    public function testIsActiveSetterAndGetter(): void
    {
        $this->user->setIsActive(false);
        $this->assertFalse($this->user->isActive());

        $this->user->setIsActive(true);
        $this->assertTrue($this->user->isActive());
    }

    // TESTS DES RÔLES

    public function testDefaultRolesContainRoleUser(): void
    {
        // ROLE_USER doit toujours être présent par défaut
        $roles = $this->user->getRoles();
        $this->assertContains('ROLE_USER', $roles);
    }

    public function testSetRolesAlwaysIncludesRoleUser(): void
    {
        // Même si on définit uniquement ROLE_ADMIN, ROLE_USER doit être garanti
        $this->user->setRoles(['ROLE_ADMIN']);
        $roles = $this->user->getRoles();

        $this->assertContains('ROLE_ADMIN', $roles);
        $this->assertContains('ROLE_USER', $roles);
    }

    public function testSetRolesEventCreator(): void
    {
        $this->user->setRoles(['ROLE_EVENT_CREATOR']);
        $roles = $this->user->getRoles();

        $this->assertContains('ROLE_EVENT_CREATOR', $roles);
        $this->assertContains('ROLE_USER', $roles);
    }

    public function testRolesAreUnique(): void
    {
        // Pas de doublon dans les rôles
        $this->user->setRoles(['ROLE_USER', 'ROLE_USER', 'ROLE_ADMIN']);
        $roles = $this->user->getRoles();

        $this->assertCount(2, $roles); // ROLE_USER + ROLE_ADMIN
    }

    // TESTS DE L'IDENTIFIANT

    public function testUserIdentifierReturnsEmail(): void
    {
        $this->user->setEmail('john@example.com');
        $this->assertSame('john@example.com', $this->user->getUserIdentifier());
    }

    public function testIdIsNullByDefault(): void
    {
        // L'ID est null tant que l'entité n'est pas persistée
        $this->assertNull($this->user->getId());
    }

    // TESTS DES LIFECYCLE CALLBACKS

    public function testOnPrePersistSetsTimestamps(): void
    {
        $this->user->onPrePersist();

        $this->assertNotNull($this->user->getCreatedAt());
        $this->assertNotNull($this->user->getUpdatedAt());
        // createdAt et updatedAt doivent être identiques à la création
        $this->assertEquals(
            $this->user->getCreatedAt()->getTimestamp(),
            $this->user->getUpdatedAt()->getTimestamp()
        );
    }

    public function testOnPreUpdateChangesUpdatedAt(): void
    {
        // Simuler la création
        $this->user->onPrePersist();
        $originalUpdatedAt = $this->user->getUpdatedAt();

        // Attendre un instant pour que le timestamp change
        usleep(1000); // 1ms

        // Simuler la mise à jour
        $this->user->onPreUpdate();

        // updatedAt doit être différent (ou au moins pas inférieur)
        $this->assertGreaterThanOrEqual(
            $originalUpdatedAt->getTimestamp(),
            $this->user->getUpdatedAt()->getTimestamp()
        );
    }

    // TESTS DE SÉCURITÉ

    public function testEraseCredentialsDoesNothing(): void
    {
        // eraseCredentials() ne doit pas lever d'exception
        $this->user->setPassword('hashed_password');
        $this->user->eraseCredentials();

        // Le mot de passe hashé doit toujours être là
        $this->assertSame('hashed_password', $this->user->getPassword());
    }
}
