CREATE TYPE "public"."mfa_method" AS ENUM('otp', 'webauthn', 'both');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'register' BEFORE 'login';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'failed_login_attempt' BEFORE 'logout';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'password_reset_request' BEFORE 'send_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'password_reset_complete' BEFORE 'send_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'two_factor_enabled' BEFORE 'send_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'two_factor_disabled' BEFORE 'send_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'move_email' BEFORE 'delete_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'restore_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'forward_email';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'create_mailbox';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'rename_mailbox';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'delete_mailbox';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'create_label';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'rename_label';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'delete_label';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'apply_label';--> statement-breakpoint
ALTER TYPE "public"."action_types" ADD VALUE 'remove_label';--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"theme" "theme" DEFAULT 'light' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfaMethod" "mfa_method"
);
--> statement-breakpoint
ALTER TABLE "mailboxes" DROP CONSTRAINT "mailboxes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "action_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "emails" ALTER COLUMN "sender_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "labels" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "labels" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mailboxes" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "mailboxes" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "recipients" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;