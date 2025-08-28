ALTER TABLE "user_settings" RENAME COLUMN "mfaMethod" TO "mfaMethods";--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "mfaMethods" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."mfa_method";--> statement-breakpoint
CREATE TYPE "public"."mfa_method" AS ENUM('otp', 'webauthn');--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "mfaMethods" SET DATA TYPE "public"."mfa_method"[] USING "mfaMethods"::"public"."mfa_method"[];--> statement-breakpoint
ALTER TABLE "user_emails" ADD COLUMN "is_sender" boolean DEFAULT false;