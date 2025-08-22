import { sql } from 'drizzle-orm';
import { pgTable, pgEnum, serial, text, timestamp, integer, boolean, index, uniqueIndex, customType } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

function prefixedId(prefix: string, rowName: string = 'id') {
    return text(rowName).primaryKey().$defaultFn(() => `${prefix}_${createId()}`);
}

export const themeOptions = pgEnum('theme', ['light', 'dark', 'system']);

export const mfaMethods = pgEnum('mfa_method', ['otp', 'webauthn', 'both']);

export const rcptTypes = pgEnum('rcpt_types', [
    'to',
    'cc',
    'bcc'
]);

export const mailboxTypes = pgEnum('mailbox_types', [
    'inbox',
    'sent',
    'draft',
    'trash'
]);

export const actionTypes = pgEnum('action_types', [
    // Auth/Security
    'register',
    'login',
    'failed_login_attempt',
    'logout',
    'password_reset_request',
    'password_reset_complete',
    'two_factor_enabled',
    'two_factor_disabled',

    // Emails
    'send_email',
    'move_email',
    'delete_email',
    'restore_email',
    'forward_email',

    // Mailboxes and Labels
    'create_mailbox',
    'rename_mailbox',
    'delete_mailbox',
    'create_label',
    'rename_label',
    'delete_label',
    'apply_label',
    'remove_label'
]);

const tsvector = customType<{ data: string; notNull: true; default: false; }>({
    dataType() {
        return 'tsvector';
    }
});

export const users = pgTable('users', {
    id: prefixedId('usr'),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
    isActive: boolean('is_active').default(true),
    lastLoginAt: timestamp('last_login_at')
}, (table) => [
    uniqueIndex('users_username_idx').on(table.username),
    uniqueIndex('users_email_idx').on(table.email),
    index('active_users_idx').on(table.username).where(sql`deleted_at IS NULL AND is_active = true`)
]);

export const user_settings = pgTable('user_settings', {
    userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),

    // UI/Gen
    theme: themeOptions().default('light').notNull(),
    language: text('language').default('en').notNull(),

    // MFA
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaMethod: mfaMethods(),
});

export const mailboxes = pgTable('mailboxes', {
    id: prefixedId('mlb'),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    name: text('name').notNull(),
    mailboxType: mailboxTypes('mailbox_type').default('inbox'),
    systemMailbox: boolean('system_mailbox').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at')
}, (table) => [
    index('mailbox_user_idx').on(table.userId),
    uniqueIndex('mailbox_user_name_idx').on(table.userId, table.name)
]);

export const emails = pgTable('emails', {
    id: prefixedId('eml'),
    mailboxId: integer('mailbox_id').references(() => mailboxes.id).notNull(),
    senderId: text('sender_id').references(() => users.id),
    subject: text('subject'),
    emlPath: text('eml_path').notNull(),
    bodyText: text('body_text'),
    isRead: boolean('is_read').default(false),
    hasAttachments: boolean('has_attachments').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
    searchVector: tsvector('search_vector').notNull()
}, (table) => [
    index('email_mailbox_idx').on(table.mailboxId),
    index('email_sender_idx').on(table.senderId),
    index('email_mailbox_created_idx').on(table.mailboxId, table.createdAt)
]);

export const recipients = pgTable('recipients', {
    id: serial('id').primaryKey(),
    emailId: integer('email_id').references(() => emails.id).notNull(),
    userId: text('user_id').references(() => users.id),
    type: rcptTypes('type').notNull()
}, (table) => [
    index('recipient_email_idx').on(table.emailId),
    index('recipient_rcpt_idx').on(table.userId),
    index('recipient_email_type_idx').on(table.emailId, table.type)
]);

export const attachments = pgTable('attachments', {
    id: serial('id').primaryKey(),
    emailId: integer('email_id').references(() => emails.id).notNull(),
    fileName: text('file_name').notNull(),
    filePath: text('file_path').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes'),
    createdAt: timestamp('created_at').defaultNow(),
    deletedAt: timestamp('deleted_at')
}, (table) => [
    index('attachment_email_idx').on(table.emailId)
]);

export const labels = pgTable('labels', {
    id: prefixedId('lbl'),
    userId: text('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    uniqueIndex('label_user_name_idx').on(table.userId, table.name)
]);

export const emailLabels = pgTable('email_labels', {
    id: serial('id').primaryKey(),
    emailId: integer('email_id').references(() => emails.id).notNull(),
    labelId: integer('label_id').references(() => labels.id).notNull()
}, (table) => [
    index('email_label_email_idx').on(table.emailId),
    index('email_label_label_idx').on(table.labelId),
    uniqueIndex('email_label_unique_idx').on(table.emailId, table.labelId)
]);

export const auditLogs = pgTable('audit_logs', {
    id: serial('id').primaryKey(),
    userId: text('user_id').references(() => users.id),
    action: text('action').notNull(),
    actionType: actionTypes('action_type').notNull(),
    ipAddress: text('ip_address'),
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow()
});