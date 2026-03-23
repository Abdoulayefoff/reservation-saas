<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260322000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create ticket_option table';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE "ticket_option" (id UUID NOT NULL, event_id UUID NOT NULL, type VARCHAR(255) NOT NULL, price NUMERIC(10, 2) NOT NULL, quantity INT NOT NULL, available INT NOT NULL, PRIMARY KEY(id))');
        $this->addSql('CREATE INDEX IDX_906F6F6771F7E88B ON "ticket_option" (event_id)');
        $this->addSql('COMMENT ON COLUMN "ticket_option".id IS \'(DC2Type:uuid)\'');
        $this->addSql('COMMENT ON COLUMN "ticket_option".event_id IS \'(DC2Type:uuid)\'');
        $this->addSql('ALTER TABLE "ticket_option" ADD CONSTRAINT FK_906F6F6771F7E88B FOREIGN KEY (event_id) REFERENCES "event" (id) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "ticket_option" DROP CONSTRAINT FK_906F6F6771F7E88B');
        $this->addSql('DROP TABLE "ticket_option"');
    }
}
