CREATE TABLE "cash_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"allow_negative_balance" boolean DEFAULT false NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_account_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "cash_account_name_length_check" CHECK (char_length("cash_account"."name") between 1 and 80),
	CONSTRAINT "cash_account_kind_check" CHECK ("cash_account"."kind" in ('cash', 'bank', 'mobile_money', 'other')),
	CONSTRAINT "cash_account_status_check" CHECK ("cash_account"."status" in ('active', 'archived')),
	CONSTRAINT "cash_account_currency_check" CHECK ("cash_account"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cash_account_currency_digits_check" CHECK ("cash_account"."currency_minor_unit_digits" between 0 and 4)
);
--> statement-breakpoint
CREATE TABLE "cash_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"action" text NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"delta_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"reason" text NOT NULL,
	"expense_id" uuid,
	"transfer_id" uuid,
	"receivable_payment_id" uuid,
	"reversal_of_movement_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_movement_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "cash_movement_direction_check" CHECK ("cash_movement"."direction" in ('in', 'out')),
	CONSTRAINT "cash_movement_action_check" CHECK ("cash_movement"."action" in ('opening', 'expense', 'adjustment_in', 'adjustment_out', 'transfer_in', 'transfer_out', 'receivable_payment', 'reverse')),
	CONSTRAINT "cash_movement_amount_positive_check" CHECK ("cash_movement"."amount_minor_units" > 0),
	CONSTRAINT "cash_movement_delta_direction_check" CHECK ((
        "cash_movement"."direction" = 'in' and "cash_movement"."delta_minor_units" = "cash_movement"."amount_minor_units"
      ) or (
        "cash_movement"."direction" = 'out' and "cash_movement"."delta_minor_units" = -"cash_movement"."amount_minor_units"
      )),
	CONSTRAINT "cash_movement_currency_check" CHECK ("cash_movement"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cash_movement_currency_digits_check" CHECK ("cash_movement"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "cash_movement_local_date_check" CHECK ("cash_movement"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "cash_movement_local_time_check" CHECK ("cash_movement"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "cash_movement_time_zone_length_check" CHECK (char_length("cash_movement"."time_zone") between 1 and 64),
	CONSTRAINT "cash_movement_reason_length_check" CHECK (char_length("cash_movement"."reason") between 1 and 240),
	CONSTRAINT "cash_movement_action_direction_check" CHECK ((
        "cash_movement"."action" in ('expense', 'adjustment_out', 'transfer_out') and "cash_movement"."direction" = 'out'
      ) or (
        "cash_movement"."action" in ('adjustment_in', 'transfer_in', 'receivable_payment') and "cash_movement"."direction" = 'in'
      ) or "cash_movement"."action" in ('opening', 'reverse')),
	CONSTRAINT "cash_movement_source_shape_check" CHECK ((
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
      ))
);
--> statement-breakpoint
CREATE TABLE "cash_operation_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_operation_receipt_action_check" CHECK ("cash_operation_receipt"."action" in ('cash_account.create', 'cash_account.update', 'cash_account.archive', 'expense.post', 'expense.void', 'cash.adjust', 'cash.reverse', 'cash.transfer')),
	CONSTRAINT "cash_operation_receipt_fingerprint_check" CHECK ("cash_operation_receipt"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "cash_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"from_account_id" uuid NOT NULL,
	"to_account_id" uuid NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"note" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cash_transfer_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "cash_transfer_accounts_different_check" CHECK ("cash_transfer"."from_account_id" <> "cash_transfer"."to_account_id"),
	CONSTRAINT "cash_transfer_amount_positive_check" CHECK ("cash_transfer"."amount_minor_units" > 0),
	CONSTRAINT "cash_transfer_currency_check" CHECK ("cash_transfer"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "cash_transfer_currency_digits_check" CHECK ("cash_transfer"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "cash_transfer_local_date_check" CHECK ("cash_transfer"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "cash_transfer_local_time_check" CHECK ("cash_transfer"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "cash_transfer_time_zone_length_check" CHECK (char_length("cash_transfer"."time_zone") between 1 and 64),
	CONSTRAINT "cash_transfer_note_length_check" CHECK ("cash_transfer"."note" is null or char_length("cash_transfer"."note") between 1 and 240)
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"category" text NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"description" text NOT NULL,
	"payee" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by_user_id" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "expense_status_check" CHECK ("expense"."status" in ('posted', 'voided')),
	CONSTRAINT "expense_category_check" CHECK ("expense"."category" in ('inventory', 'rent', 'utilities', 'payroll', 'transport', 'marketing', 'tax', 'other')),
	CONSTRAINT "expense_amount_positive_check" CHECK ("expense"."amount_minor_units" > 0),
	CONSTRAINT "expense_currency_check" CHECK ("expense"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "expense_currency_digits_check" CHECK ("expense"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "expense_description_length_check" CHECK (char_length("expense"."description") between 1 and 240),
	CONSTRAINT "expense_payee_length_check" CHECK ("expense"."payee" is null or char_length("expense"."payee") between 1 and 120),
	CONSTRAINT "expense_local_date_check" CHECK ("expense"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "expense_local_time_check" CHECK ("expense"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "expense_time_zone_length_check" CHECK (char_length("expense"."time_zone") between 1 and 64),
	CONSTRAINT "expense_void_shape_check" CHECK ((
        "expense"."status" = 'posted'
        and "expense"."voided_at" is null
        and "expense"."voided_by_user_id" is null
        and "expense"."void_reason" is null
      ) or (
        "expense"."status" = 'voided'
        and "expense"."voided_at" is not null
        and "expense"."voided_by_user_id" is not null
        and char_length("expense"."void_reason") between 1 and 240
      ))
);
--> statement-breakpoint
CREATE TABLE "catalog_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_category_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "catalog_category_name_check" CHECK (char_length("catalog_category"."name") between 1 and 80 and btrim("catalog_category"."name") = "catalog_category"."name"),
	CONSTRAINT "catalog_category_status_check" CHECK ("catalog_category"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "catalog_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"category_id" uuid,
	"product_id" uuid,
	"movement_id" uuid,
	"result_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_operation_action_check" CHECK ("catalog_operation"."action" in (
        'category.created', 'category.updated', 'category.archived',
        'product.created', 'product.updated', 'product.archived',
        'inventory.receive', 'inventory.adjust_in', 'inventory.adjust_out', 'inventory.reverse'
      )),
	CONSTRAINT "catalog_operation_target_check" CHECK ((
        "catalog_operation"."action" like 'category.%'
        and "catalog_operation"."category_id" is not null
        and "catalog_operation"."product_id" is null
        and "catalog_operation"."movement_id" is null
      ) or (
        "catalog_operation"."action" like 'product.%'
        and "catalog_operation"."category_id" is null
        and "catalog_operation"."product_id" is not null
        and "catalog_operation"."movement_id" is null
      ) or (
        "catalog_operation"."action" like 'inventory.%'
        and "catalog_operation"."category_id" is null
        and "catalog_operation"."product_id" is not null
        and "catalog_operation"."movement_id" is not null
      )),
	CONSTRAINT "catalog_operation_fingerprint_check" CHECK ("catalog_operation"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "catalog_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"sku" text,
	"selling_price_minor_units" bigint,
	"selling_price_currency" text,
	"selling_price_currency_minor_unit_digits" smallint,
	"unit_kind" text NOT NULL,
	"quantity_precision" smallint NOT NULL,
	"tracked" boolean DEFAULT true NOT NULL,
	"low_stock_threshold_minor_units" bigint,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_product_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "catalog_product_name_check" CHECK (char_length("catalog_product"."name") between 1 and 120 and btrim("catalog_product"."name") = "catalog_product"."name"),
	CONSTRAINT "catalog_product_sku_check" CHECK ("catalog_product"."sku" is null or (char_length("catalog_product"."sku") between 1 and 64 and btrim("catalog_product"."sku") = "catalog_product"."sku")),
	CONSTRAINT "catalog_product_price_snapshot_check" CHECK ((
        "catalog_product"."selling_price_minor_units" is null
        and "catalog_product"."selling_price_currency" is null
        and "catalog_product"."selling_price_currency_minor_unit_digits" is null
      ) or (
        "catalog_product"."selling_price_minor_units" >= 0
        and "catalog_product"."selling_price_currency" ~ '^[A-Z]{3}$'
        and "catalog_product"."selling_price_currency_minor_unit_digits" between 0 and 4
      )),
	CONSTRAINT "catalog_product_unit_kind_check" CHECK ("catalog_product"."unit_kind" in ('unit', 'kilogram', 'gram', 'liter', 'milliliter', 'meter')),
	CONSTRAINT "catalog_product_quantity_precision_check" CHECK ("catalog_product"."quantity_precision" between 0 and 3),
	CONSTRAINT "catalog_product_low_stock_check" CHECK ("catalog_product"."low_stock_threshold_minor_units" is null or ("catalog_product"."tracked" and "catalog_product"."low_stock_threshold_minor_units" >= 0)),
	CONSTRAINT "catalog_product_status_check" CHECK ("catalog_product"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"action" text NOT NULL,
	"quantity_minor_units" bigint NOT NULL,
	"delta_minor_units" bigint NOT NULL,
	"quantity_precision" smallint NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"reverses_movement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_movement_business_product_id_unique" UNIQUE("business_id","product_id","id"),
	CONSTRAINT "inventory_movement_action_check" CHECK ("inventory_movement"."action" in ('receive', 'adjust_in', 'adjust_out', 'reverse')),
	CONSTRAINT "inventory_movement_quantity_positive_check" CHECK ("inventory_movement"."quantity_minor_units" > 0),
	CONSTRAINT "inventory_movement_delta_check" CHECK ((
        "inventory_movement"."action" in ('receive', 'adjust_in') and "inventory_movement"."delta_minor_units" > 0
      ) or (
        "inventory_movement"."action" = 'adjust_out' and "inventory_movement"."delta_minor_units" < 0
      ) or (
        "inventory_movement"."action" = 'reverse' and "inventory_movement"."delta_minor_units" <> 0
      )),
	CONSTRAINT "inventory_movement_precision_check" CHECK ("inventory_movement"."quantity_precision" between 0 and 3),
	CONSTRAINT "inventory_movement_reason_check" CHECK (char_length("inventory_movement"."reason") between 1 and 240 and btrim("inventory_movement"."reason") = "inventory_movement"."reason"),
	CONSTRAINT "inventory_movement_reversal_link_check" CHECK (("inventory_movement"."action" = 'reverse') = ("inventory_movement"."reverses_movement_id" is not null)),
	CONSTRAINT "inventory_movement_local_date_check" CHECK ("inventory_movement"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "inventory_movement_local_time_check" CHECK ("inventory_movement"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "inventory_movement_time_zone_check" CHECK (char_length("inventory_movement"."time_zone") between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"notes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "customer_name_length_check" CHECK (char_length("customer"."name") between 1 and 120),
	CONSTRAINT "customer_phone_length_check" CHECK ("customer"."phone" is null or char_length("customer"."phone") between 1 and 40),
	CONSTRAINT "customer_email_length_check" CHECK ("customer"."email" is null or char_length("customer"."email") between 3 and 254),
	CONSTRAINT "customer_notes_length_check" CHECK ("customer"."notes" is null or char_length("customer"."notes") between 1 and 1000),
	CONSTRAINT "customer_status_check" CHECK ("customer"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "receivable" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"original_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"description" text NOT NULL,
	"posted_date" text NOT NULL,
	"due_date" text,
	"created_by_user_id" text NOT NULL,
	"voided_by_user_id" text,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "receivable_business_customer_id_id_unique" UNIQUE("business_id","customer_id","id"),
	CONSTRAINT "receivable_status_check" CHECK ("receivable"."status" in ('posted', 'voided')),
	CONSTRAINT "receivable_original_minor_units_positive_check" CHECK ("receivable"."original_minor_units" > 0),
	CONSTRAINT "receivable_currency_check" CHECK ("receivable"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "receivable_currency_digits_check" CHECK ("receivable"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "receivable_description_length_check" CHECK (char_length("receivable"."description") between 1 and 240),
	CONSTRAINT "receivable_posted_date_check" CHECK ("receivable"."posted_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "receivable_due_date_check" CHECK ("receivable"."due_date" is null or ("receivable"."due_date" ~ '^\d{4}-\d{2}-\d{2}$' and "receivable"."due_date" >= "receivable"."posted_date")),
	CONSTRAINT "receivable_void_state_check" CHECK ((
        "receivable"."status" = 'posted'
        and "receivable"."voided_by_user_id" is null
        and "receivable"."voided_at" is null
        and "receivable"."void_reason" is null
      ) or (
        "receivable"."status" = 'voided'
        and "receivable"."voided_by_user_id" is not null
        and "receivable"."voided_at" is not null
        and char_length("receivable"."void_reason") between 1 and 240
      ))
);
--> statement-breakpoint
CREATE TABLE "receivable_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"action" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"receivable_id" uuid,
	"payment_id" uuid,
	"result_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_operation_action_check" CHECK ("receivable_operation"."action" in (
        'customer.created',
        'customer.updated',
        'customer.archived',
        'receivable.posted',
        'receivable.voided',
        'receivable.payment_applied',
        'receivable.payment_reversed'
      )),
	CONSTRAINT "receivable_operation_target_shape_check" CHECK ((
        "receivable_operation"."action" like 'customer.%'
        and "receivable_operation"."receivable_id" is null
        and "receivable_operation"."payment_id" is null
      ) or (
        "receivable_operation"."action" in ('receivable.posted', 'receivable.voided')
        and "receivable_operation"."receivable_id" is not null
        and "receivable_operation"."payment_id" is null
      ) or (
        "receivable_operation"."action" in ('receivable.payment_applied', 'receivable.payment_reversed')
        and "receivable_operation"."receivable_id" is not null
        and "receivable_operation"."payment_id" is not null
      )),
	CONSTRAINT "receivable_operation_fingerprint_check" CHECK ("receivable_operation"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
CREATE TABLE "receivable_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"receivable_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_minor_units" bigint NOT NULL,
	"currency" text NOT NULL,
	"currency_minor_unit_digits" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_local_date" text NOT NULL,
	"occurred_local_time" text NOT NULL,
	"time_zone" text NOT NULL,
	"cash_account_id" uuid NOT NULL,
	"reference" text,
	"reverses_payment_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receivable_payment_business_id_id_unique" UNIQUE("business_id","id"),
	CONSTRAINT "receivable_payment_business_receivable_customer_id_unique" UNIQUE("business_id","receivable_id","customer_id","id"),
	CONSTRAINT "receivable_payment_kind_check" CHECK ("receivable_payment"."kind" in ('payment', 'reversal')),
	CONSTRAINT "receivable_payment_amount_positive_check" CHECK ("receivable_payment"."amount_minor_units" > 0),
	CONSTRAINT "receivable_payment_currency_check" CHECK ("receivable_payment"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "receivable_payment_currency_digits_check" CHECK ("receivable_payment"."currency_minor_unit_digits" between 0 and 4),
	CONSTRAINT "receivable_payment_local_date_check" CHECK ("receivable_payment"."occurred_local_date" ~ '^\d{4}-\d{2}-\d{2}$'),
	CONSTRAINT "receivable_payment_local_time_check" CHECK ("receivable_payment"."occurred_local_time" ~ '^\d{2}:\d{2}$'),
	CONSTRAINT "receivable_payment_time_zone_length_check" CHECK (char_length("receivable_payment"."time_zone") between 1 and 64),
	CONSTRAINT "receivable_payment_reference_length_check" CHECK ("receivable_payment"."reference" is null or char_length("receivable_payment"."reference") between 1 and 120),
	CONSTRAINT "receivable_payment_reversal_shape_check" CHECK (("receivable_payment"."kind" = 'payment' and "receivable_payment"."reverses_payment_id" is null)
          or ("receivable_payment"."kind" = 'reversal' and "receivable_payment"."reverses_payment_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "sale_correction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" text NOT NULL,
	"original_sale_id" uuid NOT NULL,
	"replacement_sale_id" uuid,
	"actor_user_id" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"command_fingerprint" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_correction_kind_check" CHECK ("sale_correction"."kind" in ('void', 'replacement')),
	CONSTRAINT "sale_correction_replacement_check" CHECK (("sale_correction"."kind" = 'void' and "sale_correction"."replacement_sale_id" is null)
        or ("sale_correction"."kind" = 'replacement' and "sale_correction"."replacement_sale_id" is not null)),
	CONSTRAINT "sale_correction_distinct_sales_check" CHECK ("sale_correction"."replacement_sale_id" is null or "sale_correction"."replacement_sale_id" <> "sale_correction"."original_sale_id"),
	CONSTRAINT "sale_correction_reason_length_check" CHECK (char_length("sale_correction"."reason") between 2 and 240),
	CONSTRAINT "sale_correction_fingerprint_check" CHECK ("sale_correction"."command_fingerprint" ~ '^[a-f0-9]{64}$')
);
--> statement-breakpoint
ALTER TABLE "cash_account" ADD CONSTRAINT "cash_account_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_account" ADD CONSTRAINT "cash_account_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_account_fk" FOREIGN KEY ("business_id","account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_expense_fk" FOREIGN KEY ("business_id","expense_id") REFERENCES "public"."expense"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_transfer_fk" FOREIGN KEY ("business_id","transfer_id") REFERENCES "public"."cash_transfer"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_receivable_payment_fk" FOREIGN KEY ("business_id","receivable_payment_id") REFERENCES "public"."receivable_payment"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_reversal_fk" FOREIGN KEY ("business_id","reversal_of_movement_id") REFERENCES "public"."cash_movement"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_operation_receipt" ADD CONSTRAINT "cash_operation_receipt_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_operation_receipt" ADD CONSTRAINT "cash_operation_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfer" ADD CONSTRAINT "cash_transfer_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfer" ADD CONSTRAINT "cash_transfer_business_from_account_fk" FOREIGN KEY ("business_id","from_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfer" ADD CONSTRAINT "cash_transfer_business_to_account_fk" FOREIGN KEY ("business_id","to_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transfer" ADD CONSTRAINT "cash_transfer_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_business_account_fk" FOREIGN KEY ("business_id","account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_category" ADD CONSTRAINT "catalog_category_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_operation" ADD CONSTRAINT "catalog_operation_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_operation" ADD CONSTRAINT "catalog_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_operation" ADD CONSTRAINT "catalog_operation_business_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."catalog_category"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_operation" ADD CONSTRAINT "catalog_operation_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."catalog_product"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_operation" ADD CONSTRAINT "catalog_operation_business_movement_fk" FOREIGN KEY ("business_id","product_id","movement_id") REFERENCES "public"."inventory_movement"("business_id","product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_business_category_fk" FOREIGN KEY ("business_id","category_id") REFERENCES "public"."catalog_category"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_business_price_currency_fk" FOREIGN KEY ("business_id","selling_price_currency","selling_price_currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "public"."catalog_product"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_reversal_fk" FOREIGN KEY ("business_id","product_id","reverses_movement_id") REFERENCES "public"."inventory_movement"("business_id","product_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_voided_by_user_id_user_id_fk" FOREIGN KEY ("voided_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_business_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customer"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_operation" ADD CONSTRAINT "receivable_operation_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_operation" ADD CONSTRAINT "receivable_operation_business_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_operation" ADD CONSTRAINT "receivable_operation_business_customer_fk" FOREIGN KEY ("business_id","customer_id") REFERENCES "public"."customer"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_operation" ADD CONSTRAINT "receivable_operation_business_receivable_customer_fk" FOREIGN KEY ("business_id","receivable_id","customer_id") REFERENCES "public"."receivable"("business_id","id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_operation" ADD CONSTRAINT "receivable_operation_business_payment_fk" FOREIGN KEY ("business_id","receivable_id","customer_id","payment_id") REFERENCES "public"."receivable_payment"("business_id","receivable_id","customer_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_business_receivable_customer_fk" FOREIGN KEY ("business_id","receivable_id","customer_id") REFERENCES "public"."receivable"("business_id","id","customer_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_reversal_fk" FOREIGN KEY ("business_id","receivable_id","customer_id","reverses_payment_id") REFERENCES "public"."receivable_payment"("business_id","receivable_id","customer_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_business_currency_digits_fk" FOREIGN KEY ("business_id","currency","currency_minor_unit_digits") REFERENCES "public"."business_settings"("business_id","currency","currency_minor_unit_digits") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_business_cash_account_fk" FOREIGN KEY ("business_id","cash_account_id") REFERENCES "public"."cash_account"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_business_id_business_settings_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business_settings"("business_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_business_original_fk" FOREIGN KEY ("business_id","original_sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_correction" ADD CONSTRAINT "sale_correction_business_replacement_fk" FOREIGN KEY ("business_id","replacement_sale_id") REFERENCES "public"."sale"("business_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_account_business_name_unique" ON "cash_account" USING btree ("business_id",lower("name"));--> statement-breakpoint
CREATE INDEX "cash_account_business_status_created_idx" ON "cash_account" USING btree ("business_id","status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_expense_unique" ON "cash_movement" USING btree ("business_id","expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_transfer_action_unique" ON "cash_movement" USING btree ("business_id","transfer_id","action");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_movement_reversal_unique" ON "cash_movement" USING btree ("business_id","reversal_of_movement_id");--> statement-breakpoint
CREATE INDEX "cash_movement_business_account_created_idx" ON "cash_movement" USING btree ("business_id","account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "cash_movement_business_occurred_idx" ON "cash_movement" USING btree ("business_id","occurred_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_operation_receipt_actor_key_unique" ON "cash_operation_receipt" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "cash_operation_receipt_resource_idx" ON "cash_operation_receipt" USING btree ("business_id","action","resource_id");--> statement-breakpoint
CREATE INDEX "cash_transfer_business_occurred_idx" ON "cash_transfer" USING btree ("business_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "expense_business_status_occurred_idx" ON "expense" USING btree ("business_id","status","occurred_at","id");--> statement-breakpoint
CREATE INDEX "expense_business_category_occurred_idx" ON "expense" USING btree ("business_id","category","occurred_at");--> statement-breakpoint
CREATE INDEX "expense_business_account_created_idx" ON "expense" USING btree ("business_id","account_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_category_business_name_ci_unique" ON "catalog_category" USING btree ("business_id",lower("name"));--> statement-breakpoint
CREATE INDEX "catalog_category_business_status_created_idx" ON "catalog_category" USING btree ("business_id","status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_operation_actor_key_unique" ON "catalog_operation" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "catalog_operation_category_idx" ON "catalog_operation" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "catalog_operation_product_idx" ON "catalog_operation" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "catalog_operation_movement_idx" ON "catalog_operation" USING btree ("movement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_product_business_sku_ci_unique" ON "catalog_product" USING btree ("business_id",lower("sku")) WHERE "catalog_product"."sku" is not null;--> statement-breakpoint
CREATE INDEX "catalog_product_business_status_created_idx" ON "catalog_product" USING btree ("business_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "catalog_product_business_category_idx" ON "catalog_product" USING btree ("business_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movement_reverses_once_unique" ON "inventory_movement" USING btree ("reverses_movement_id") WHERE "inventory_movement"."reverses_movement_id" is not null;--> statement-breakpoint
CREATE INDEX "inventory_movement_business_product_created_idx" ON "inventory_movement" USING btree ("business_id","product_id","created_at","id");--> statement-breakpoint
CREATE INDEX "customer_business_status_created_idx" ON "customer" USING btree ("business_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "customer_business_name_idx" ON "customer" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "receivable_business_status_due_idx" ON "receivable" USING btree ("business_id","status","due_date","created_at","id");--> statement-breakpoint
CREATE INDEX "receivable_business_customer_created_idx" ON "receivable" USING btree ("business_id","customer_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_operation_actor_key_unique" ON "receivable_operation" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "receivable_operation_customer_idx" ON "receivable_operation" USING btree ("business_id","customer_id");--> statement-breakpoint
CREATE INDEX "receivable_operation_receivable_idx" ON "receivable_operation" USING btree ("business_id","receivable_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receivable_payment_reversal_once_unique" ON "receivable_payment" USING btree ("reverses_payment_id") WHERE "receivable_payment"."reverses_payment_id" is not null;--> statement-breakpoint
CREATE INDEX "receivable_payment_business_receivable_created_idx" ON "receivable_payment" USING btree ("business_id","receivable_id","created_at","id");--> statement-breakpoint
CREATE INDEX "receivable_payment_cash_account_idx" ON "receivable_payment" USING btree ("business_id","cash_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_correction_business_original_unique" ON "sale_correction" USING btree ("business_id","original_sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_correction_business_replacement_unique" ON "sale_correction" USING btree ("business_id","replacement_sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sale_correction_actor_key_unique" ON "sale_correction" USING btree ("business_id","actor_user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sale_correction_business_created_at_idx" ON "sale_correction" USING btree ("business_id","created_at");