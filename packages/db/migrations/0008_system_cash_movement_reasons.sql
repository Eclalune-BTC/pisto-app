ALTER TABLE "cash_movement" DROP CONSTRAINT "cash_movement_reason_length_check";--> statement-breakpoint
ALTER TABLE "cash_movement" ALTER COLUMN "reason" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_movement" ADD CONSTRAINT "cash_movement_reason_length_check" CHECK (("cash_movement"."reason" is not null and char_length("cash_movement"."reason") between 1 and 240) or (
        "cash_movement"."reason" is null
        and "cash_movement"."action" in ('transfer_in', 'transfer_out', 'receivable_payment', 'reverse')
      ));--> statement-breakpoint
UPDATE "cash_movement" SET "reason" = NULL
WHERE "action" = 'receivable_payment' AND "reason" = 'Receivable payment';--> statement-breakpoint
UPDATE "cash_movement" AS "reversal" SET "reason" = NULL
FROM "cash_movement" AS "original"
WHERE "reversal"."action" = 'reverse'
  AND "reversal"."reason" = 'Receivable payment reversal'
  AND "original"."business_id" = "reversal"."business_id"
  AND "original"."id" = "reversal"."reversal_of_movement_id"
  AND "original"."action" = 'receivable_payment';--> statement-breakpoint
UPDATE "cash_movement" AS "leg" SET "reason" = NULL
FROM "cash_transfer" AS "transfer"
WHERE "leg"."action" IN ('transfer_in', 'transfer_out')
  AND "leg"."reason" = 'Cash transfer'
  AND "transfer"."business_id" = "leg"."business_id"
  AND "transfer"."id" = "leg"."transfer_id"
  AND "transfer"."note" IS NULL;
