CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'sending', 'sent');--> statement-breakpoint
CREATE TYPE "public"."concept_event_kind" AS ENUM('explained', 'confused', 'correct_use');--> statement-breakpoint
CREATE TYPE "public"."concept_id" AS ENUM('revenue', 'cogs', 'gross_profit', 'gross_margin', 'net_profit', 'items_sold', 'menu_cost', 'operating_expense', 'cash');--> statement-breakpoint
CREATE TYPE "public"."cost_source" AS ENUM('owner', 'recipe', 'estimate', 'seed');--> statement-breakpoint
CREATE TYPE "public"."draft_status" AS ENUM('pending', 'executing', 'done', 'failed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."menu_category" AS ENUM('kopi', 'non-kopi', 'makanan');--> statement-breakpoint
CREATE TYPE "public"."message_source" AS ENUM('whatsapp', 'demo', 'system');--> statement-breakpoint
CREATE TYPE "public"."outbound_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."recipient_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."schedule_frequency" AS ENUM('once', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."schedule_kind" AS ENUM('recap', 'reminder');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('active', 'cancelled', 'done');--> statement-breakpoint
CREATE TYPE "public"."sheet_connection_status" AS ENUM('active', 'broken');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('seed', 'chat', 'sheet');--> statement-breakpoint
CREATE TABLE "agent_steps" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "agent_steps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"trace_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"tool_name" text NOT NULL,
	"input" jsonb NOT NULL,
	"output" jsonb
);
--> statement-breakpoint
CREATE TABLE "agent_turns" (
	"trace_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid,
	"channel" "message_source" NOT NULL,
	"action" text NOT NULL,
	"attempts" smallint NOT NULL,
	"ungrounded" jsonb NOT NULL,
	"input_tokens" integer NOT NULL,
	"cached_input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"outbound_messages" smallint DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"png" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"city" text NOT NULL,
	"open_hour" smallint NOT NULL,
	"close_hour" smallint NOT NULL,
	"whatsapp_phone" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "businesses_whatsappPhone_unique" UNIQUE("whatsapp_phone")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"status" "recipient_status" DEFAULT 'pending' NOT NULL,
	"ses_message_id" text,
	"error" text,
	CONSTRAINT "campaign_recipients_campaign_id_customer_id_pk" PRIMARY KEY("campaign_id","customer_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"trace_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "concept_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_id" uuid NOT NULL,
	"concept" "concept_id" NOT NULL,
	"kind" "concept_event_kind" NOT NULL,
	"trace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_summaries" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"covers_through_message_id" bigint NOT NULL,
	"summary" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"consent_source" text NOT NULL,
	"consented_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_unsubscribeToken_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"args" jsonb NOT NULL,
	"summary" text NOT NULL,
	"status" "draft_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"trace_id" uuid NOT NULL,
	"card_wamid" text,
	"outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"wamid" text PRIMARY KEY NOT NULL,
	"business_id" uuid,
	"phone" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"trace_id" uuid
);
--> statement-breakpoint
CREATE TABLE "menu_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"source" "cost_source" NOT NULL,
	"includes_packaging" boolean,
	"valid_from" date NOT NULL,
	"draft_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amount_not_negative" CHECK ("menu_costs"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "menu_category" NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_positive" CHECK ("menu_items"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"business_id" uuid NOT NULL,
	"trace_id" uuid NOT NULL,
	"message" jsonb NOT NULL,
	"source" "message_source" NOT NULL,
	"wamid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"business_id" uuid,
	"trace_id" uuid,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbound_status" DEFAULT 'pending' NOT NULL,
	"wamid" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "outbound_messages_idempotencyKey_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" "schedule_kind" NOT NULL,
	"frequency" "schedule_frequency" NOT NULL,
	"time" text NOT NULL,
	"day_of_week" text,
	"date" date,
	"recap_kind" text,
	"reminder_text" text,
	"next_run_at" timestamp with time zone NOT NULL,
	"status" "schedule_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_format" CHECK ("schedules"."time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "sheet_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"sheet_title" text NOT NULL,
	"tab_id" integer NOT NULL,
	"tab_title" text NOT NULL,
	"column_map" jsonb,
	"status" "sheet_connection_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"sold_on" date NOT NULL,
	"sold_at" timestamp with time zone,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"source" "transaction_source" NOT NULL,
	"source_sheet_id" text,
	"source_row" integer,
	"draft_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quantity_positive" CHECK ("transactions"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_trace_id_agent_turns_trace_id_fk" FOREIGN KEY ("trace_id") REFERENCES "public"."agent_turns"("trace_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_turns" ADD CONSTRAINT "agent_turns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_events" ADD CONSTRAINT "concept_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_costs" ADD CONSTRAINT "menu_costs_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_connections" ADD CONSTRAINT "sheet_connections_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_steps_trace_id_index" ON "agent_steps" USING btree ("trace_id");--> statement-breakpoint
CREATE INDEX "agent_turns_business_id_created_at_index" ON "agent_turns" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_expires_at_index" ON "attachments" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "concept_events_business_id_concept_index" ON "concept_events" USING btree ("business_id","concept");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_business_id_email_index" ON "customers" USING btree ("business_id","email");--> statement-breakpoint
CREATE INDEX "drafts_open" ON "drafts" USING btree ("business_id") WHERE "drafts"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "inbound_messages_unprocessed" ON "inbound_messages" USING btree ("phone") WHERE "inbound_messages"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "menu_costs_menu_item_id_valid_from_index" ON "menu_costs" USING btree ("menu_item_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_business_id_name_index" ON "menu_items" USING btree ("business_id","name");--> statement-breakpoint
CREATE INDEX "messages_business_id_id_index" ON "messages" USING btree ("business_id","id");--> statement-breakpoint
CREATE INDEX "schedules_due" ON "schedules" USING btree ("next_run_at") WHERE "schedules"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "sheet_connections_one_active" ON "sheet_connections" USING btree ("business_id") WHERE "sheet_connections"."status" = 'active';--> statement-breakpoint
CREATE INDEX "transactions_business_id_sold_on_index" ON "transactions" USING btree ("business_id","sold_on");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_sheet_row_unique" ON "transactions" USING btree ("business_id","source_sheet_id","source_row") WHERE "transactions"."source_sheet_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_seed_unique" ON "transactions" USING btree ("business_id","menu_item_id","sold_at") WHERE "transactions"."source" = 'seed';