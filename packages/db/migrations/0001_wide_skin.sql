CREATE TABLE "business_settings" (
	"business_id" text PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_settings_currency_check" CHECK ("business_settings"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "business_settings_time_zone_length_check" CHECK (char_length("business_settings"."time_zone") between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"entry_mode" text DEFAULT 'total_only' NOT NULL,
	"gross_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_status_check" CHECK ("sale"."status" in ('posted', 'voided')),
	CONSTRAINT "sale_entry_mode_check" CHECK ("sale"."entry_mode" = 'total_only'),
	CONSTRAINT "sale_gross_minor_units_positive_check" CHECK ("sale"."gross_minor_units" > 0),
	CONSTRAINT "sale_currency_check" CHECK ("sale"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sale_description_length_check" CHECK ("sale"."description" is null or char_length("sale"."description") between 1 and 240)
);
--> statement-breakpoint
CREATE TABLE "sale_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_operation_action_check" CHECK ("sale_operation"."action" = 'sale.posted'),
	CONSTRAINT "sale_operation_fingerprint_check" CHECK ("sale_operation"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "business_settings" ADD CONSTRAINT "business_settings_business_id_organization_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_id_organization_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_operation" ADD CONSTRAINT "sale_operation_business_id_organization_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_operation" ADD CONSTRAINT "sale_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_business_id_id_unique" ON "sale" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "sale_operation" ADD CONSTRAINT "sale_operation_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sale_business_status_occurred_at_idx" ON "sale" USING btree ("business_id","status","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_operation_actor_key_unique" ON "sale_operation" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sale_operation_sale_id_idx" ON "sale_operation" USING btree ("sale_id");
