-- Room table: DB-backed lobby rooms for the stateless/polling architecture.
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Room_status_idx" ON "Room"("status");

-- Game: version (optimistic concurrency) + undo history snapshots.
ALTER TABLE "Game" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Game" ADD COLUMN "history" TEXT NOT NULL DEFAULT '[]';
