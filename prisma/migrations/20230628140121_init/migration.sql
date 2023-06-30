-- CreateTable
CREATE TABLE "Order" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL
);
