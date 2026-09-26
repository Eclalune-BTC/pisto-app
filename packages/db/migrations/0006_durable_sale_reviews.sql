CREATE TABLE "sale_review" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"command" jsonb,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"time_zone" text NOT NULL,
	"sale_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "sale_review_payload_lifecycle_check" CHECK (
      ("sale_review"."closed_at" is null and "sale_review"."command" is not null)
      or ("sale_review"."closed_at" is not null and "sale_review"."command" is null)),
	CONSTRAINT "sale_review_command_check" CHECK ("sale_review"."command" is null or (
      jsonb_typeof("sale_review"."command") = 'object'
      and octet_length("sale_review"."command"::text) <= 8192
      and ("sale_review"."command"->>'idempotencyKey') is not null
      and "sale_review"."command"->>'idempotencyKey' = "sale_review"."id"::text)),
	CONSTRAINT "sale_review_currency_check" CHECK ("sale_review"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "sale_review_currency_digits_check" CHECK ("sale_review"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "sale_review_time_zone_check" CHECK (char_length("sale_review"."time_zone") between 1 and 64)
);
--> statement-breakpoint
ALTER TABLE "sale_review" ADD CONSTRAINT "sale_review_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_review" ADD CONSTRAINT "sale_review_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_review" ADD CONSTRAINT "sale_review_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_review_open_actor_unique" ON "sale_review" USING btree ("business_id","actor_user_id") WHERE "sale_review"."closed_at" is null;