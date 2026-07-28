ALTER TABLE "User"
ADD COLUMN "email" VARCHAR(254),
ADD COLUMN "passwordHash" VARCHAR(255);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
