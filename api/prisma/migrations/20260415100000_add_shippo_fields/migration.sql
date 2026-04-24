-- [AV-058] v5.4.0 — Shippo integration fields on orders
ALTER TABLE "orders"
  ADD COLUMN "shippo_shipment_id"    VARCHAR(100),
  ADD COLUMN "shippo_transaction_id" VARCHAR(100),
  ADD COLUMN "carrier"               VARCHAR(50),
  ADD COLUMN "carrier_service"       VARCHAR(100),
  ADD COLUMN "label_url"             VARCHAR(500);
