-- [AV-057] v5.3.9 — Failed webhook dead-letter queue
-- Stores webhook events that failed processing so ops can retry manually.

CREATE TABLE "failed_webhooks" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source"        VARCHAR(50) NOT NULL,
  "event_type"    VARCHAR(100) NOT NULL,
  "event_id"      VARCHAR(255) NOT NULL,
  "payload"       JSONB NOT NULL,
  "error_message" TEXT NOT NULL,
  "retry_count"   INTEGER NOT NULL DEFAULT 0,
  "resolved"      BOOLEAN NOT NULL DEFAULT FALSE,
  "resolved_by"   VARCHAR(255),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at"   TIMESTAMP(3)
);

CREATE INDEX "failed_webhooks_resolved_created_at_idx"
  ON "failed_webhooks" ("resolved", "created_at");

CREATE INDEX "failed_webhooks_source_event_type_idx"
  ON "failed_webhooks" ("source", "event_type");
