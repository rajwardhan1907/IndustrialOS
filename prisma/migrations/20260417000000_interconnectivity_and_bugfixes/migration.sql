-- AlterTable: make Shipment.orderId nullable
ALTER TABLE "Shipment" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "orderId" DROP DEFAULT;

-- AlterTable: make Return.orderId nullable
ALTER TABLE "Return" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "Return" ALTER COLUMN "orderId" DROP DEFAULT;
