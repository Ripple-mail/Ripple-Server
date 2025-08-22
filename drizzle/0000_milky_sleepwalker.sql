CREATE TYPE "public"."action_types" AS ENUM('register', 'login', 'failed_login_attempt', 'logout', 'password_reset_request', 'password_reset_complete', 'two_factor_enabled', 'two_factor_disabled', 'send_email', 'move_email', 'delete_email', 'restore_email', 'forward_email', 'create_mailbox', 'rename_mailbox', 'delete_mailbox', 'create_label', 'rename_label', 'delete_label', 'apply_label', 'remove_label');--> statement-breakpoint
CREATE TYPE "public"."mailbox_types" AS ENUM('inbox', 'sent', 'draft', 'trash');--> statement-breakpoint
CREATE TYPE "public"."mfa_method" AS ENUM('otp', 'webauthn', 'both');--> statement-breakpoint
CREATE TYPE "public"."rcpt_types" AS ENUM('to', 'cc', 'bcc');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer,
	"created_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"action_type" "action_types" NOT NULL,
	"ip_address" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email_id" integer NOT NULL,
	"label_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer,
	"from_address" text,
	"message_id" text,
	"subject" text,
	"date" timestamp DEFAULT now(),
	"eml_path" text NOT NULL,
	"size_bytes" integer,
	"body_text" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"search_vector" "tsvector",
	CONSTRAINT "emails_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mailboxes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"mailbox_type" "mailbox_types" DEFAULT 'inbox',
	"system_mailbox" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "recipients" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" integer NOT NULL,
	"user_id" integer,
	"address" text,
	"type" "rcpt_types" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email_id" integer NOT NULL,
	"mailbox_id" integer NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_starred" boolean,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"theme" "theme" DEFAULT 'light' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfaMethod" "mfa_method"
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_labels" ADD CONSTRAINT "email_labels_user_email_id_user_emails_id_fk" FOREIGN KEY ("user_email_id") REFERENCES "public"."user_emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_labels" ADD CONSTRAINT "email_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mailboxes" ADD CONSTRAINT "mailboxes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipients" ADD CONSTRAINT "recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_emails" ADD CONSTRAINT "user_emails_mailbox_id_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."mailboxes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachment_email_idx" ON "attachments" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_label_user_email_idx" ON "email_labels" USING btree ("user_email_id");--> statement-breakpoint
CREATE INDEX "email_label_label_idx" ON "email_labels" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_label_unique_idx" ON "email_labels" USING btree ("user_email_id","label_id");--> statement-breakpoint
CREATE INDEX "email_sender_idx" ON "emails" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "email_created_idx" ON "emails" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "label_user_name_idx" ON "labels" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "mailbox_user_idx" ON "mailboxes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mailbox_user_name_idx" ON "mailboxes" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "recipient_email_idx" ON "recipients" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "recipient_rcpt_idx" ON "recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recipient_email_type_idx" ON "recipients" USING btree ("email_id","type");--> statement-breakpoint
CREATE INDEX "user_emails_user_idx" ON "user_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_emails_mailbox_idx" ON "user_emails" USING btree ("mailbox_id");--> statement-breakpoint
CREATE INDEX "user_emails_email_idx" ON "user_emails" USING btree ("email_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_emails_unique_idx" ON "user_emails" USING btree ("user_id","email_id","mailbox_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "active_users_idx" ON "users" USING btree ("username") WHERE deleted_at IS NULL AND is_active = true;