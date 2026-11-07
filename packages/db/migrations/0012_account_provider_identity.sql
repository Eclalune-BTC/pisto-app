DROP INDEX "account_issuer_account_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";