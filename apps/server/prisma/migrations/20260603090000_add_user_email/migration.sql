-- AlterTable: add nullable email (required at registration, nullable for legacy rows)
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- CreateIndex: unique email (SQLite allows multiple NULLs)
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
