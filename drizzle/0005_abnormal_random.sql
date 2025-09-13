ALTER TABLE "user_emails" ADD COLUMN "trash_since" timestamp;--> statement-breakpoint
CREATE INDEX "user_emails_trash_since" ON "user_emails" USING btree ("trash_since");