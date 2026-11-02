CREATE TABLE "business_member_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"member_id" text NOT NULL,
	"result_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_member_operation_action_check" CHECK ("business_member_operation"."action" in ('member.added', 'member.role_changed', 'member.removed')),
	CONSTRAINT "business_member_operation_fingerprint_check" CHECK ("business_member_operation"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "business_member_operation" ADD CONSTRAINT "business_member_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_member_operation" ADD CONSTRAINT "business_member_operation_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_member_operation_actor_key_unique" ON "business_member_operation" USING btree ("business_id","actor_user_id","idempotency_key");