/*
  Warnings:

  - You are about to drop the column `status` on the `Order` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "totalSpend" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "items" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "status",
ALTER COLUMN "priority" SET DEFAULT 'MED',
ALTER COLUMN "customer" DROP DEFAULT,
ALTER COLUMN "sku" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "rejectionNote" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "items" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "items" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" DROP DEFAULT;
