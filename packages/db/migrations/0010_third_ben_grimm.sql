ALTER TABLE "expense" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD COLUMN "entry_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_entry_source_check" CHECK ("expense"."entry_source" in ('manual', 'voice', 'text'));--> statement-breakpoint
ALTER TABLE "receivable_payment" ADD CONSTRAINT "receivable_payment_entry_source_check" CHECK ("receivable_payment"."entry_source" in ('manual', 'voice', 'text'));