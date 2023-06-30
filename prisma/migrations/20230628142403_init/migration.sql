/*
  Warnings:

  - You are about to drop the column `timestamp` on the `Order` table. All the data in the column will be lost.
  - Added the required column `block` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "block" INTEGER NOT NULL
);
INSERT INTO "new_Order" ("address", "hash", "type") SELECT "address", "hash", "type" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
