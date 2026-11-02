CREATE TABLE "purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"invoice_number" text,
	"entry_source" text NOT NULL,
	"payment_terms" text NOT NULL,
	"cash_account_id" uuid,
	"total_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"due_date" text,
	"note" text,
	"received_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "purchase_business_supplier_id_unique" UNIQUE("business_id","supplier_id","id"),
	CONSTRAINT "purchase_status_check" CHECK ("purchase"."status" in ('posted', 'voided')),
	CONSTRAINT "purchase_invoice_number_length_check" CHECK ("purchase"."invoice_number" is null or char_length("purchase"."invoice_number") between 1 and 40),
	CONSTRAINT "purchase_entry_source_check" CHECK ("purchase"."entry_source" in ('manual', 'voice', 'text')),
	CONSTRAINT "purchase_terms_check" CHECK ((
        "purchase"."payment_terms" = 'cash'
        and "purchase"."cash_account_id" is not null
        and "purchase"."due_date" is null
      ) or (
        "purchase"."payment_terms" = 'credit'
        and "purchase"."cash_account_id" is null
        and "purchase"."due_date" ~ '^\d{4}-\d{2}-\d{2}$'
        and "purchase"."due_date" >= "purchase"."occurred_local_date"
      )),
	CONSTRAINT "purchase_total_positive_check" CHECK ("purchase"."total_minor_units" > 0),
	CONSTRAINT "purchase_currency_check" CHECK ("purchase"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "purchase_currency_digits_check" CHECK ("purchase"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "purchase_local_date_check" CHECK ("purchase"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "purchase_local_time_check" CHECK ("purchase"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "purchase_time_zone_length_check" CHECK (char_length("purchase"."time_zone") between 1 and 64),
	CONSTRAINT "purchase_note_length_check" CHECK ("purchase"."note" is null or char_length("purchase"."note") between 1 and 240),
	CONSTRAINT "purchase_void_shape_check" CHECK ((
        "purchase"."status" = 'posted'
        and "purchase"."voided_at" is null
        and "purchase"."voided_by_user_id" is null
        and "purchase"."void_reason" is null
      ) or (
        "purchase"."status" = 'voided'
        and "purchase"."voided_at" is not null
        and "purchase"."voided_by_user_id" is not null
        and "purchase"."void_reason" is not null
        and char_length("purchase"."void_reason") between 1 and 240
      ))
);
--> statement-breakpoint
CREATE TABLE "purchase_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity_minor_units" bigint NOT NULL,
	"quantity_precision" smallint NOT NULL,
	"unit_cost_minor_units" bigint NOT NULL,
	"subtotal_minor_units" bigint NOT NULL,
	"inventory_movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_line_business_purchase_position_unique" UNIQUE("business_id","purchase_id","position"),
	CONSTRAINT "purchase_line_position_check" CHECK ("purchase_line"."position" between 0 and 49),
	CONSTRAINT "purchase_line_product_name_length_check" CHECK (char_length("purchase_line"."product_name") between 1 and 120),
	CONSTRAINT "purchase_line_quantity_positive_check" CHECK ("purchase_line"."quantity_minor_units" > 0),
	CONSTRAINT "purchase_line_precision_check" CHECK ("purchase_line"."quantity_precision" between 0 and 3),
	CONSTRAINT "purchase_line_unit_cost_check" CHECK ("purchase_line"."unit_cost_minor_units" >= 0),
	CONSTRAINT "purchase_line_subtotal_check" CHECK ("purchase_line"."subtotal_minor_units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"purchase_id" uuid,
	"payment_id" uuid,
	"result_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_operation_action_check" CHECK ("purchase_operation"."action" in (
        'supplier.created',
        'supplier.updated',
        'supplier.archived',
        'purchase.posted',
        'purchase.received',
        'purchase.voided',
        'purchase.payment_applied'
      )),
	CONSTRAINT "purchase_operation_target_shape_check" CHECK ((
        "purchase_operation"."action" like 'supplier.%'
        and "purchase_operation"."purchase_id" is null
        and "purchase_operation"."payment_id" is null
      ) or (
        "purchase_operation"."action" in ('purchase.posted', 'purchase.received', 'purchase.voided')
        and "purchase_operation"."purchase_id" is not null
        and "purchase_operation"."payment_id" is null
      ) or (
        "purchase_operation"."action" = 'purchase.payment_applied'
        and "purchase_operation"."purchase_id" is not null
        and "purchase_operation"."payment_id" is not null
      )),
	CONSTRAINT "purchase_operation_fingerprint_check" CHECK ("purchase_operation"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"tax_id" text,
	"credit_days" smallint,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "supplier_name_length_check" CHECK (char_length("supplier"."name") between 1 and 120),
	CONSTRAINT "supplier_contact_name_length_check" CHECK ("supplier"."contact_name" is null or char_length("supplier"."contact_name") between 1 and 120),
	CONSTRAINT "supplier_phone_length_check" CHECK ("supplier"."phone" is null or char_length("supplier"."phone") between 1 and 40),
	CONSTRAINT "supplier_email_length_check" CHECK ("supplier"."email" is null or char_length("supplier"."email") between 3 and 254),
	CONSTRAINT "supplier_tax_id_length_check" CHECK ("supplier"."tax_id" is null or char_length("supplier"."tax_id") between 1 and 40),
	CONSTRAINT "supplier_credit_days_check" CHECK ("supplier"."credit_days" is null or "supplier"."credit_days" between 0 and 365),
	CONSTRAINT "supplier_notes_length_check" CHECK ("supplier"."notes" is null or char_length("supplier"."notes") between 1 and 1000),
	CONSTRAINT "supplier_status_check" CHECK ("supplier"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "supplier_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"purchase_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"cash_account_id" uuid NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"reference" text,
	"entry_source" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payment_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "supplier_payment_business_purchase_id_unique" UNIQUE("business_id","purchase_id","id"),
	CONSTRAINT "supplier_payment_amount_positive_check" CHECK ("supplier_payment"."amount_minor_units" > 0),
	CONSTRAINT "supplier_payment_currency_check" CHECK ("supplier_payment"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "supplier_payment_currency_digits_check" CHECK ("supplier_payment"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "supplier_payment_local_date_check" CHECK ("supplier_payment"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "supplier_payment_local_time_check" CHECK ("supplier_payment"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "supplier_payment_time_zone_length_check" CHECK (char_length("supplier_payment"."time_zone") between 1 and 64),
	CONSTRAINT "supplier_payment_reference_length_check" CHECK ("supplier_payment"."reference" is null or char_length("supplier_payment"."reference") between 1 and 120),
	CONSTRAINT "supplier_payment_entry_source_check" CHECK ("supplier_payment"."entry_source" in ('manual', 'voice', 'text'))
);
--> statement-breakpoint
CREATE TABLE "sale_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"sale_id" uuid NOT NULL,
	"line_number" smallint NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity_minor_units" bigint NOT NULL,
	"quantity_precision" smallint NOT NULL,
	"unit_price_minor_units" bigint NOT NULL,
	"subtotal_minor_units" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_line_number_check" CHECK ("sale_line"."line_number" between 1 and 50),
	CONSTRAINT "sale_line_product_name_check" CHECK (char_length("sale_line"."product_name") between 1 and 120),
	CONSTRAINT "sale_line_quantity_positive_check" CHECK ("sale_line"."quantity_minor_units" > 0),
	CONSTRAINT "sale_line_precision_check" CHECK ("sale_line"."quantity_precision" between 0 and 3),
	CONSTRAINT "sale_line_unit_price_check" CHECK ("sale_line"."unit_price_minor_units" >= 0),
	CONSTRAINT "sale_line_subtotal_check" CHECK ("sale_line"."subtotal_minor_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "cash_movement" DROP CONSTRAINT "cash_movement_action_check";--> statement-breakpoint
ALTER TABLE "cash_movement" DROP CONSTRAINT "cash_movement_reason_length_check";--> statement-breakpoint
ALTER TABLE "cash_movement" DROP CONSTRAINT "cash_movement_action_direction_check";--> statement-breakpoint
ALTER TABLE "cash_movement" DROP CONSTRAINT "cash_movement_source_shape_check";--> statement-breakpoint
ALTER TABLE "inventory_movement" DROP CONSTRAINT "inventory_movement_action_check";--> statement-breakpoint
ALTER TABLE "inventory_movement" DROP CONSTRAINT "inventory_movement_delta_check";--> statement-breakpoint
ALTER TABLE "inventory_movement" DROP CONSTRAINT "inventory_movement_reason_check";--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT "sale_entry_mode_check";--> statement-breakpoint
ALTER TABLE "inventory_movement" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD COLUMN "purchase_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD COLUMN "supplier_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "cash_account_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "received_minor_units" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "credit_minor_units" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "receivable_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_business_supplier_fk" FOREIGN KEY ("business_id","supplier_id") REFERENCES "public"."supplier"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_business_cash_account_fk" FOREIGN KEY ("business_id","cash_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_business_purchase_fk" FOREIGN KEY ("business_id","purchase_id") REFERENCES "public"."purchase"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."catalog_product"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_inventory_movement_fk" FOREIGN KEY ("business_id","product_id","inventory_movement_id") REFERENCES "public"."inventory_movement"("business_id","product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_operation" ADD CONSTRAINT "purchase_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_operation" ADD CONSTRAINT "purchase_operation_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_operation" ADD CONSTRAINT "purchase_operation_business_supplier_fk" FOREIGN KEY ("business_id","supplier_id") REFERENCES "public"."supplier"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_operation" ADD CONSTRAINT "purchase_operation_business_purchase_fk" FOREIGN KEY ("business_id","supplier_id","purchase_id") REFERENCES "public"."purchase"("business_id","supplier_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_operation" ADD CONSTRAINT "purchase_operation_business_payment_fk" FOREIGN KEY ("business_id","purchase_id","payment_id") REFERENCES "public"."supplier_payment"("business_id","purchase_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_business_purchase_fk" FOREIGN KEY ("business_id","supplier_id","purchase_id") REFERENCES "public"."purchase"("business_id","supplier_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_business_cash_account_fk" FOREIGN KEY ("business_id","cash_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."catalog_product"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_business_occurred_created_idx" ON "purchase" USING btree ("business_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "purchase_business_supplier_occurred_created_idx" ON "purchase" USING btree ("business_id","supplier_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "purchase_business_status_due_idx" ON "purchase" USING btree ("business_id","status","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_line_inventory_movement_unique" ON "purchase_line" USING btree ("inventory_movement_id") WHERE "purchase_line"."inventory_movement_id" is not null;--> statement-breakpoint
CREATE INDEX "purchase_line_business_product_idx" ON "purchase_line" USING btree ("business_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_operation_actor_key_unique" ON "purchase_operation" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "purchase_operation_supplier_idx" ON "purchase_operation" USING btree ("business_id","supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_operation_purchase_idx" ON "purchase_operation" USING btree ("business_id","purchase_id");--> statement-breakpoint
CREATE INDEX "supplier_business_status_created_idx" ON "supplier" USING btree ("business_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "supplier_business_name_idx" ON "supplier" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "supplier_payment_business_purchase_occurred_created_idx" ON "supplier_payment" USING btree ("business_id","purchase_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "supplier_payment_cash_account_idx" ON "supplier_payment" USING btree ("business_id","cash_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_sale_number_unique" ON "sale_line" USING btree ("business_id","sale_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_sale_product_unique" ON "sale_line" USING btree ("business_id","sale_id","product_id");--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_purchase_fk" FOREIGN KEY ("business_id","purchase_id") REFERENCES "public"."purchase"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_supplier_payment_fk" FOREIGN KEY ("business_id","supplier_payment_id") REFERENCES "public"."supplier_payment"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customer"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_cash_account_fk" FOREIGN KEY ("business_id","cash_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_customer_receivable_fk" FOREIGN KEY ("business_id","customer_id","receivable_id") REFERENCES "public"."receivable"("business_id","customer_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_purchase_unique" ON "cash_movement" USING btree ("business_id","purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_supplier_payment_unique" ON "cash_movement" USING btree ("business_id","supplier_payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_sale_unique" ON "cash_movement" USING btree ("business_id","sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_sale_product_unique" ON "inventory_movement" USING btree ("business_id","sale_id","product_id") WHERE "inventory_movement"."sale_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_business_receivable_unique" ON "sale" USING btree ("business_id","receivable_id") WHERE "sale"."receivable_id" is not null;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_sale_link_check" CHECK (("cash_movement"."action" = 'sale_payment') = ("cash_movement"."sale_id" is not null));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_purchase_source_check" CHECK (("cash_movement"."action" = 'purchase_payment') = ("cash_movement"."purchase_id" is not null)
        and ("cash_movement"."action" = 'supplier_payment') = ("cash_movement"."supplier_payment_id" is not null));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_action_check" CHECK ("cash_movement"."action" in ('opening', 'expense', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'receivable_payment', 'sale_payment', 'purchase_payment', 'supplier_payment', 'reverse'));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_reason_length_check" CHECK (("cash_movement"."reason" is not null and char_length("cash_movement"."reason") between 1 and 240) or (
        "cash_movement"."reason" is null
        and "cash_movement"."action" in ('transfer_in', 'transfer_out', 'receivable_payment', 'sale_payment', 'purchase_payment', 'supplier_payment', 'reverse')
      ));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_action_direction_check" CHECK ((
        "cash_movement"."action" in ('expense', 'adjustment_out', 'transfer_out', 'purchase_payment', 'supplier_payment') and "cash_movement"."direction" = 'out'
      ) or (
        "cash_movement"."action" in ('adjustment_in', 'transfer_in', 'receivable_payment', 'sale_payment')
        and "cash_movement"."direction" = 'in'
      ) or "cash_movement"."action" in ('opening', 'reverse'));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_source_shape_check" CHECK ((
        "cash_movement"."action" = 'expense'
        and "cash_movement"."expense_id" is not null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ) or (
        "cash_movement"."action" in ('transfer_in', 'transfer_out')
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is not null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ) or (
        "cash_movement"."action" = 'receivable_payment'
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is not null
        and "cash_movement"."reversal_of_movement_id" is null
      ) or (
        "cash_movement"."action" = 'sale_payment'
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ) or (
        "cash_movement"."action" = 'reverse'
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is not null
      ) or (
        "cash_movement"."action" in ('purchase_payment', 'supplier_payment')
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ) or (
        "cash_movement"."action" in ('opening', 'adjustment_in', 'adjustment_out')
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ));--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_entry_source_check" CHECK ("expense"."entry_source" in ('manual', 'voice', 'text'));--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_sale_link_check" CHECK (("inventory_movement"."action" = 'sale') = ("inventory_movement"."sale_id" is not null));--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_action_check" CHECK ("inventory_movement"."action" in ('receive', 'adjust_in', 'adjust_out', 'sale', 'reverse'));--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_delta_check" CHECK ((
        "inventory_movement"."action" in ('receive', 'adjust_in') and "inventory_movement"."delta_minor_units" > 0
      ) or (
        "inventory_movement"."action" in ('adjust_out', 'sale') and "inventory_movement"."delta_minor_units" < 0
      ) or (
        "inventory_movement"."action" = 'reverse' and "inventory_movement"."delta_minor_units" <> 0
      ));--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_reason_check" CHECK ((
        "inventory_movement"."reason" is not null
        and char_length("inventory_movement"."reason") between 1 and 240
        and btrim("inventory_movement"."reason") = "inventory_movement"."reason"
      ) or ("inventory_movement"."reason" is null and "inventory_movement"."action" = 'sale'));--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_entry_source_check" CHECK ("receivable_payment"."entry_source" in ('manual', 'voice', 'text'));--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_entry_source_check" CHECK ("sale"."entry_source" in ('manual', 'voice', 'text'));--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_payment_method_check" CHECK ("sale"."payment_method" is null or "sale"."payment_method" in ('cash', 'transfer', 'card'));--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_due_date_check" CHECK ("sale"."due_date" is null or (
        "sale"."due_date" ~ '^\d{4}-\d{2}-\d{2}$' and "sale"."due_date" >= "sale"."occurred_local_date"
      ));--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_settlement_shape_check" CHECK ((
        "sale"."entry_mode" = 'total_only'
        and "sale"."customer_id" is null
        and "sale"."payment_method" is null
        and "sale"."cash_account_id" is null
        and "sale"."received_minor_units" = 0
        and "sale"."credit_minor_units" = 0
        and "sale"."receivable_id" is null
        and "sale"."due_date" is null
      ) or (
        "sale"."entry_mode" = 'itemized'
        and "sale"."received_minor_units" >= 0
        and "sale"."credit_minor_units" >= 0
        and "sale"."received_minor_units" + "sale"."credit_minor_units" = "sale"."gross_minor_units"
        and (
          (
            "sale"."received_minor_units" > 0
            and "sale"."payment_method" is not null
            and "sale"."cash_account_id" is not null
          ) or (
            "sale"."received_minor_units" = 0
            and "sale"."payment_method" is null
            and "sale"."cash_account_id" is null
          )
        )
        and (
          (
            "sale"."credit_minor_units" > 0
            and "sale"."customer_id" is not null
            and "sale"."receivable_id" is not null
            and "sale"."due_date" is not null
          ) or (
            "sale"."credit_minor_units" = 0
            and "sale"."receivable_id" is null
            and "sale"."due_date" is null
          )
        )
      ));--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_entry_mode_check" CHECK ("sale"."entry_mode" in ('total_only', 'itemized'));