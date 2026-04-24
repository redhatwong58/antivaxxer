-- [AV-049] v5.3.5 — Add password reset token fields to users
-- Both fields are NULL by default. Set on POST /api/auth/forgot-password
-- and cleared on POST /api/auth/reset-password.

ALTER TABLE "users"
  ADD COLUMN "reset_token_hash" VARCHAR(64),
  ADD COLUMN "reset_token_expires_at" TIMESTAMP(3);

CREATE INDEX "users_reset_token_hash_idx" ON "users"("reset_token_hash");
