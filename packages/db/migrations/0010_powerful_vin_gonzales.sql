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
ALTER TABLE "cash_movement" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD COLUMN "sale_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "cash_account_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "received_minor_units" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "credit_minor_units" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "receivable_id" uuid;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."catalog_product"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_sale_number_unique" ON "sale_line" USING btree ("business_id","sale_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_line_sale_product_unique" ON "sale_line" USING btree ("business_id","sale_id","product_id");--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_business_sale_fk" FOREIGN KEY ("business_id","sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customer"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_cash_account_fk" FOREIGN KEY ("business_id","cash_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_business_customer_receivable_fk" FOREIGN KEY ("business_id","customer_id","receivable_id") REFERENCES "public"."receivable"("business_id","customer_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_sale_unique" ON "cash_movement" USING btree ("business_id","sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_sale_product_unique" ON "inventory_movement" USING btree ("business_id","sale_id","product_id") WHERE "inventory_movement"."sale_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_business_receivable_unique" ON "sale" USING btree ("business_id","receivable_id") WHERE "sale"."receivable_id" is not null;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_sale_link_check" CHECK (("cash_movement"."action" = 'sale_payment') = ("cash_movement"."sale_id" is not null));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_action_check" CHECK ("cash_movement"."action" in ('opening', 'expense', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'receivable_payment', 'sale_payment', 'reverse'));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_reason_length_check" CHECK (("cash_movement"."reason" is not null and char_length("cash_movement"."reason") between 1 and 240) or (
        "cash_movement"."reason" is null
        and "cash_movement"."action" in ('transfer_in', 'transfer_out', 'receivable_payment', 'sale_payment', 'reverse')
      ));--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_action_direction_check" CHECK ((
        "cash_movement"."action" in ('expense', 'adjustment_out', 'transfer_out') and "cash_movement"."direction" = 'out'
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
        "cash_movement"."action" in ('opening', 'adjustment_in', 'adjustment_out')
        and "cash_movement"."expense_id" is null
        and "cash_movement"."transfer_id" is null
        and "cash_movement"."receivable_payment_id" is null
        and "cash_movement"."reversal_of_movement_id" is null
      ));--> statement-breakpoint
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