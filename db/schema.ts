import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const mailboxes = pgTable('mailboxes', {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').defaultNow()
});

export const emails = pgTable('emails', {
    id: serial('id').primaryKey(),
    mailboxId: integer('mailbox_id').references(() => mailboxes.id),
    senderId: integer('sender_id').references(() => users.id),
    subject: text('subject').notNull(),
    emlPath: text('eml_path').notNull(),
    isRead: boolean('is_read').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow()
});

export const recipients = pgTable('recipients', {
    id: serial('id').primaryKey(),
    emailId: integer('email_id').references(() => emails.id),
    recipient: text('recipient').notNull(),
    type: text('type').notNull()
});

export const attachments = pgTable('attachments', {
    id: serial('id').primaryKey(),
    emailId: integer('email_id').references(() => emails.id),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull(),
    createdAt: timestamp('created_at').defaultNow()
});