<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260321020000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Creates the `event` table.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE "event" (
            id UUID NOT NULL, 
            title VARCHAR(255) NOT NULL, 
            description TEXT DEFAULT NULL, 
            date TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, 
            location VARCHAR(255) NOT NULL, 
            price NUMERIC(10, 2) NOT NULL, 
            total_places INT NOT NULL, 
            available_places INT NOT NULL, 
            creator_id UUID NOT NULL, 
            is_published BOOLEAN NOT NULL, 
            created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, 
            updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, 
            PRIMARY KEY(id)
        )');
        $this->addSql('CREATE INDEX idx_creator_id ON "event" (creator_id)');
        $this->addSql('CREATE INDEX idx_date ON "event" (date)');
        $this->addSql('CREATE INDEX idx_is_published ON "event" (is_published)');
        $this->addSql('COMMENT ON COLUMN "event".id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN "event".creator_id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN "event".created_at IS \'(DC2Type:datetime_immutable)\'');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE "event"');
    }
}
