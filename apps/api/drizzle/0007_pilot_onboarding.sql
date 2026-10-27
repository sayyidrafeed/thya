ALTER TYPE "public"."menu_category" ADD VALUE 'lainnya';--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "is_demo_copy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Until now phone:register was the only way to give a business a number, so every one is a demo copy.
UPDATE "businesses" SET "is_demo_copy" = true WHERE "whatsapp_phone" IS NOT NULL AND "is_demo" = false;
