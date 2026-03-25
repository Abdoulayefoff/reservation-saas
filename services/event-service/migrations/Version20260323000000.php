<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260323000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Rename event columns to match spec: venue, event_date, total_seats, available_seats, status ENUM';
    }

    public function up(Schema $schema): void
    {
        // Rename columns
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "date" TO "event_date"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "location" TO "venue"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "total_places" TO "total_seats"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "available_places" TO "available_seats"');

        // Add status column and populate from is_published
        $this->addSql('ALTER TABLE "event" ADD COLUMN "status" VARCHAR(50) NOT NULL DEFAULT \'DRAFT\'');
        $this->addSql('UPDATE "event" SET "status" = CASE WHEN "is_published" = true THEN \'PUBLISHED\' ELSE \'DRAFT\' END');
        $this->addSql('ALTER TABLE "event" DROP COLUMN "is_published"');

        // Update indexes
        $this->addSql('DROP INDEX IF EXISTS idx_date');
        $this->addSql('DROP INDEX IF EXISTS idx_is_published');
        $this->addSql('CREATE INDEX idx_event_date ON "event" (event_date)');
        $this->addSql('CREATE INDEX idx_status ON "event" (status)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "event_date" TO "date"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "venue" TO "location"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "total_seats" TO "total_places"');
        $this->addSql('ALTER TABLE "event" RENAME COLUMN "available_seats" TO "available_places"');

        $this->addSql('ALTER TABLE "event" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT false');
        $this->addSql('UPDATE "event" SET "is_published" = CASE WHEN "status" = \'PUBLISHED\' THEN true ELSE false END');
        $this->addSql('ALTER TABLE "event" DROP COLUMN "status"');

        $this->addSql('DROP INDEX IF EXISTS idx_event_date');
        $this->addSql('DROP INDEX IF EXISTS idx_status');
        $this->addSql('CREATE INDEX idx_date ON "event" (date)');
        $this->addSql('CREATE INDEX idx_is_published ON "event" (is_published)');
    }
}
