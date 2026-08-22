CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rateLimit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_customer_id" text NOT NULL,
	"user_id" text,
	"email" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_subscription_id" text NOT NULL,
	"provider_customer_id" text,
	"user_id" text,
	"organization_id" text,
	"product_id" text NOT NULL,
	"status" text NOT NULL,
	"source_event_at" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"user_id" text,
	"organization_id" text,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"product_id" text,
	"status" text NOT NULL,
	"source_event_at" timestamp with time zone NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entitlement_exactly_one_subject_check" CHECK (num_nonnulls("entitlement"."user_id", "entitlement"."organization_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_customer" ADD CONSTRAINT "billing_customer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscription" ADD CONSTRAINT "billing_subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_unique" ON "account" USING btree ("issuer","account_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_status_expires_at_idx" ON "invitation" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "member_organization_user_unique" ON "member" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_unique" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_key_unique" ON "rateLimit" USING btree ("key");--> statement-breakpoint
CREATE INDEX "rate_limit_last_request_idx" ON "rateLimit" USING btree ("last_request");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_expires_at_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "session_active_organization_id_idx" ON "session" USING btree ("active_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_value_unique" ON "verification" USING btree ("identifier","value");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customer_provider_customer_unique" ON "billing_customer" USING btree ("provider","provider_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_customer_provider_user_unique" ON "billing_customer" USING btree ("provider","user_id") WHERE "billing_customer"."user_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscription_provider_id_unique" ON "billing_subscription" USING btree ("provider","provider_subscription_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_user_id_idx" ON "billing_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_organization_id_idx" ON "billing_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscription_status_idx" ON "billing_subscription" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_webhook_event_provider_key_unique" ON "billing_webhook_event" USING btree ("provider","event_key");--> statement-breakpoint
CREATE INDEX "billing_webhook_event_type_idx" ON "billing_webhook_event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "billing_webhook_event_created_at_idx" ON "billing_webhook_event" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_source_id_key_unique" ON "entitlement" USING btree ("source","source_id","key");--> statement-breakpoint
CREATE INDEX "entitlement_user_status_idx" ON "entitlement" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "entitlement_organization_status_idx" ON "entitlement" USING btree ("organization_id","status");