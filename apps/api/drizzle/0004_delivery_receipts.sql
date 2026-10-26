ALTER TABLE "outbound_messages" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD COLUMN "read_at" timestamp with time zone;