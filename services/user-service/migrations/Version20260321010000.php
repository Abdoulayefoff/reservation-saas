<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Migration initiale – User Service.
 *
 * Crée la table :
 * - "profile" : profils utilisateurs (nom, prénom, email, téléphone, avatar)
 *
 * L'ID du profil est le MÊME que l'ID du User dans le Auth Service.
 * Cela permet la corrélation entre les deux services sans jointure.
 */
final class Version20260321010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Création de la table profile pour le User Service';
    }

    public function up(Schema $schema): void
    {
        // Table "profile" – Profils utilisateurs
        // L'ID est le même que celui du User dans Auth Service
        $this->addSql('CREATE TABLE profile (
            id UUID NOT NULL,
            first_name VARCHAR(100) DEFAULT NULL,
            last_name VARCHAR(100) DEFAULT NULL,
            email VARCHAR(180) NOT NULL,
            phone VARCHAR(20) DEFAULT NULL,
            avatar_url VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )');

        // Index sur l'email pour les recherches
        $this->addSql('CREATE INDEX IDX_PROFILE_EMAIL ON profile (email)');

        // Commentaires Doctrine type mapping
        $this->addSql('COMMENT ON COLUMN profile.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN profile.created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN profile.updated_at IS \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE IF EXISTS profile');
    }
}
