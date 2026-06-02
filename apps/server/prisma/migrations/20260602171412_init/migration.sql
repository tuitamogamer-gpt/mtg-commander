-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commander" TEXT,
    "cards" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "colorIdentity" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreconDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "commanders" TEXT NOT NULL DEFAULT '',
    "colorIdentity" TEXT NOT NULL DEFAULT '[]',
    "cards" TEXT NOT NULL,
    "releaseDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Card" (
    "scryfallId" TEXT NOT NULL PRIMARY KEY,
    "oracleId" TEXT,
    "name" TEXT NOT NULL,
    "manaCost" TEXT,
    "cmc" REAL,
    "typeLine" TEXT,
    "oracleText" TEXT,
    "colors" TEXT,
    "colorIdentity" TEXT,
    "power" TEXT,
    "toughness" TEXT,
    "loyalty" TEXT,
    "layout" TEXT,
    "setCode" TEXT,
    "collectorNumber" TEXT,
    "rarity" TEXT,
    "imageUris" TEXT,
    "cardFaces" TEXT,
    "scryfallUri" TEXT,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "state" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- CreateIndex
CREATE INDEX "PreconDeck_setCode_idx" ON "PreconDeck"("setCode");

-- CreateIndex
CREATE UNIQUE INDEX "PreconDeck_setCode_name_key" ON "PreconDeck"("setCode", "name");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Game_roomId_idx" ON "Game"("roomId");
