CREATE TYPE "public"."channel_sale_source" AS ENUM('screenshot');--> statement-breakpoint
CREATE TYPE "public"."delivery_channel" AS ENUM('gofood', 'grabfood', 'shopeefood');--> statement-breakpoint
ALTER TYPE "public"."concept_id" ADD VALUE 'channel_sales';--> statement-breakpoint
ALTER TYPE "public"."concept_id" ADD VALUE 'app_commission';--> statement-breakpoint
CREATE TABLE "channel_commissions" (
	"business_id" uuid NOT NULL,
	"channel" "delivery_channel" NOT NULL,
	"rate_bps" integer NOT NULL,
	"fee_per_order" integer NOT NULL,
	"draft_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_commissions_business_id_channel_pk" PRIMARY KEY("business_id","channel"),
	CONSTRAINT "commission_rate_range" CHECK ("channel_commissions"."rate_bps" >= 0 AND "channel_commissions"."rate_bps" <= 10000),
	CONSTRAINT "commission_fee_not_negative" CHECK ("channel_commissions"."fee_per_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "channel_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"channel" "delivery_channel" NOT NULL,
	"sold_on" date NOT NULL,
	"gross_sales" integer NOT NULL,
	"net_received" integer,
	"order_count" integer,
	"source" "channel_sale_source" NOT NULL,
	"image_sha256" text,
	"source_row" integer,
	"draft_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_gross_not_negative" CHECK ("channel_sales"."gross_sales" >= 0),
	CONSTRAINT "channel_net_within_gross" CHECK ("channel_sales"."net_received" IS NULL OR ("channel_sales"."net_received" >= 0 AND "channel_sales"."net_received" <= "channel_sales"."gross_sales")),
	CONSTRAINT "channel_orders_not_negative" CHECK ("channel_sales"."order_count" IS NULL OR "channel_sales"."order_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "channel_commissions" ADD CONSTRAINT "channel_commissions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_sales" ADD CONSTRAINT "channel_sales_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_sales_day_unique" ON "channel_sales" USING btree ("business_id","channel","sold_on");--> statement-breakpoint
CREATE INDEX "channel_sales_business_id_image_sha256_index" ON "channel_sales" USING btree ("business_id","image_sha256");