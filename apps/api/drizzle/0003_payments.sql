CREATE TYPE "public"."payment_method" AS ENUM('qris', 'gopay', 'transfer', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."payment_source" AS ENUM('screenshot', 'sheet', 'chat');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"source" "payment_source" NOT NULL,
	"source_ref" text,
	"image_sha256" text,
	"source_row" integer,
	"draft_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_business_id_paid_at_index" ON "payments" USING btree ("business_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_source_ref_unique" ON "payments" USING btree ("business_id","source","source_ref") WHERE "payments"."source_ref" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_image_row_unique" ON "payments" USING btree ("business_id","image_sha256","source_row") WHERE "payments"."image_sha256" IS NOT NULL;