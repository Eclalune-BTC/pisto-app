DROP INDEX "cash_movement_business_account_created_idx";--> statement-breakpoint
DROP INDEX "cash_movement_business_occurred_idx";--> statement-breakpoint
DROP INDEX "expense_business_status_occurred_idx";--> statement-breakpoint
DROP INDEX "expense_business_account_created_idx";--> statement-breakpoint
DROP INDEX "inventory_movement_business_product_created_idx";--> statement-breakpoint
DROP INDEX "receivable_payment_business_receivable_created_idx";--> statement-breakpoint
DROP INDEX "sale_business_status_occurred_at_idx";--> statement-breakpoint
DROP INDEX "sale_business_created_at_idx";--> statement-breakpoint
DROP INDEX "sale_business_status_created_at_idx";--> statement-breakpoint
CREATE INDEX "cash_movement_business_account_occurred_created_idx" ON "cash_movement" USING btree ("business_id","account_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "cash_movement_business_occurred_created_idx" ON "cash_movement" USING btree ("business_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "expense_business_occurred_created_idx" ON "expense" USING btree ("business_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "expense_business_status_occurred_created_idx" ON "expense" USING btree ("business_id","status","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "expense_business_account_occurred_created_idx" ON "expense" USING btree ("business_id","account_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "inventory_movement_business_product_occurred_created_idx" ON "inventory_movement" USING btree ("business_id","product_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "receivable_payment_business_receivable_occurred_created_idx" ON "receivable_payment" USING btree ("business_id","receivable_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "sale_business_occurred_created_idx" ON "sale" USING btree ("business_id","occurred_at","created_at","id");--> statement-breakpoint
CREATE INDEX "sale_business_status_occurred_created_idx" ON "sale" USING btree ("business_id","status","occurred_at","created_at","id");