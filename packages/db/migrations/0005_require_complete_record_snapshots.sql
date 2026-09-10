ALTER TABLE "expense" DROP CONSTRAINT "expense_void_shape_check";--> statement-breakpoint
ALTER TABLE "catalog_product" DROP CONSTRAINT "catalog_product_price_snapshot_check";--> statement-breakpoint
ALTER TABLE "receivable" DROP CONSTRAINT "receivable_void_state_check";--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_void_shape_check" CHECK ((
        "expense"."status" = 'posted'
        and "expense"."voided_at" is null
        and "expense"."voided_by_user_id" is null
        and "expense"."void_reason" is null
      ) or (
        "expense"."status" = 'voided'
        and "expense"."voided_at" is not null
        and "expense"."voided_by_user_id" is not null
        and "expense"."void_reason" is not null
        and char_length("expense"."void_reason") between 1 and 240
      ));--> statement-breakpoint
ALTER TABLE "catalog_product" ADD CONSTRAINT "catalog_product_price_snapshot_check" CHECK ((
        "catalog_product"."selling_price_minor_units" is null
        and "catalog_product"."selling_price_currency" is null
        and "catalog_product"."selling_price_currency_minor_unit_digits" is null
      ) or (
        "catalog_product"."selling_price_minor_units" is not null
        and "catalog_product"."selling_price_currency" is not null
        and "catalog_product"."selling_price_currency_minor_unit_digits" is not null
        and "catalog_product"."selling_price_minor_units" >= 0
        and "catalog_product"."selling_price_currency" ~ '^[A-Z]{3}$'
        and "catalog_product"."selling_price_currency_minor_unit_digits" between 0 and 4
      ));--> statement-breakpoint
ALTER TABLE "receivable" ADD CONSTRAINT "receivable_void_state_check" CHECK ((
        "receivable"."status" = 'posted'
        and "receivable"."voided_by_user_id" is null
        and "receivable"."voided_at" is null
        and "receivable"."void_reason" is null
      ) or (
        "receivable"."status" = 'voided'
        and "receivable"."voided_by_user_id" is not null
        and "receivable"."voided_at" is not null
        and "receivable"."void_reason" is not null
        and char_length("receivable"."void_reason") between 1 and 240
      ));