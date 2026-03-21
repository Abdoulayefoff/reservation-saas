<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Migration initiale – Auth Service.
 *
 * Crée les tables :
 * - "user" : comptes utilisateurs (email, password hashé, rôles, statut)
 * - "refresh_token" : tokens de renouvellement JWT (hashés en base)
 */
final class Version20260321010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Création des tables user et refresh_token pour le Auth Service';
    }

    public function up(Schema $schema): void
    {
        // Table "user" – Comptes utilisateurs
        // Le nom est échappé car "user" est un mot réservé PostgreSQL
        $this->addSql('CREATE TABLE "user" (
            id UUID NOT NULL,
            email VARCHAR(180) NOT NULL,
            password VARCHAR(255) NOT NULL,
            roles JSON NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )');

        // Index unique sur l'email pour les recherches rapides et l'unicité
        $this->addSql('CREATE UNIQUE INDEX UNIQ_USER_EMAIL ON "user" (email)');

        // Commentaire sur l'UUID pour Doctrine (type mapping)
        $this->addSql('COMMENT ON COLUMN "user".id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN "user".created_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN "user".updated_at IS \'(DC2Type:datetime_immutable)\'');

        // Table "refresh_token" – Tokens de renouvellement JWT
        // Les tokens sont hashés, jamais stockés en clair
        $this->addSql('CREATE TABLE refresh_token (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            token VARCHAR(255) NOT NULL,
            expires_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            PRIMARY KEY (id)
        )');

        // Index unique sur le token hashé
        $this->addSql('CREATE UNIQUE INDEX UNIQ_REFRESH_TOKEN ON refresh_token (token)');

        // Index sur user_id pour la suppression rapide lors du logout
        $this->addSql('CREATE INDEX IDX_REFRESH_TOKEN_USER ON refresh_token (user_id)');

        // Commentaires Doctrine type mapping
        $this->addSql('COMMENT ON COLUMN refresh_token.id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN refresh_token.user_id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN refresh_token.expires_at IS \'(DC2Type:datetime_immutable)\'');
        $this->addSql('COMMENT ON COLUMN refresh_token.created_at IS \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        // Suppression dans l'ordre inverse des dépendances
        $this->addSql('DROP TABLE IF EXISTS refresh_token');
        $this->addSql('DROP TABLE IF EXISTS "user"');
    }
}
