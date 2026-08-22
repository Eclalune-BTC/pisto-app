ALTER TABLE "business_settings" ADD COLUMN "currency_minor_unit_digits" smallint;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "currency_minor_unit_digits" smallint;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "occurred_local_date" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "occurred_local_time" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "time_zone" text;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM "business_settings" WHERE "currency" <> 'USD') THEN
		RAISE EXCEPTION 'Pre-release currency exponent backfill requires manual review for non-USD businesses';
	END IF;
END $$;--> statement-breakpoint
UPDATE "business_settings"
SET "currency_minor_unit_digits" = 2
WHERE "currency_minor_unit_digits" IS NULL;--> statement-breakpoint
UPDATE "sale" AS s
SET
	"currency_minor_unit_digits" = bs."currency_minor_unit_digits",
	"occurred_local_date" = to_char(s."occurred_at" AT TIME ZONE bs."time_zone", 'YYYY-MM-DD'),
	"occurred_local_time" = to_char(s."occurred_at" AT TIME ZONE bs."time_zone", 'HH24:MI'),
	"time_zone" = bs."time_zone"
FROM "business_settings" AS bs
WHERE s."business_id" = bs."business_id";--> statement-breakpoint
ALTER TABLE "business_settings" ALTER COLUMN "currency_minor_unit_digits" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "currency_minor_unit_digits" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "occurred_local_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "occurred_local_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ALTER COLUMN "time_zone" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "business_settings_id_currency_digits_unique" ON "business_settings" USING btree ("business_id","currency","currency_minor_unit_digits");--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT "sale_business_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_operation" DROP CONSTRAINT "sale_operation_business_id_organization_id_fk";--> statement-breakpoint
ALTER TABLE "sale_operation" ADD CONSTRAINT "sale_operation_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_currency_digits_check" CHECK ("business_settings"."currency_minor_unit_digits" between 0 and 4);--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_currency_digits_check" CHECK ("sale"."currency_minor_unit_digits" between 0 and 4);--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_local_date_check" CHECK ("sale"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$');--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_local_time_check" CHECK ("sale"."occurred_local_time" ~ '^\d{2}:\d{2}$');--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_time_zone_length_check" CHECK (char_length("sale"."time_zone") between 1 and 64);
