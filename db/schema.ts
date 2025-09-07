import { sql, relations } from 'drizzle-orm';
import {
    pgTable,
    pgEnum,
    uuid,
    text,
    timestamp,
    integer,
    boolean,
    index,
    uniqueIndex,
    customType,
    varchar,
    inet,
    check,
    foreignKey,
    bigint,
    jsonb
} from 'drizzle-orm/pg-core';

export const themeOptions = pgEnum('theme', ['light', 'dark', 'system']);

export const mfaMethods = pgEnum('mfa_method', ['otp', 'webauthn']);

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

const tsvector = customType<{ data: string; notNull: false; default: false; }>({
    dataType() {
        return 'tsvector';
    }
});

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
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

export const userSettings = pgTable('user_settings', {
    userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),

    // UI/Gen
    theme: themeOptions().default('light').notNull(),
    language: text('language').default('en').notNull(),

    // MFA
    mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
    mfaMethods: mfaMethods().array(),
});

export const mailboxes = pgTable('mailboxes', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
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
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id').references(() => users.id),
    fromAddress: text('from_address'),
    messageId: text('message_id').unique(),
    subject: text('subject'),
    date: timestamp('date').defaultNow(),
    emlPath: text('eml_path').notNull(),
    sizeBytes: integer('size_bytes'),
    bodyText: text('body_text'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
    searchVector: tsvector('search_vector')
}, (table) => [
    index('email_sender_idx').on(table.senderId),
    index('email_created_idx').on(table.createdAt)
]);

export const userEmails = pgTable('user_emails', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    emailId: uuid('email_id').references(() => emails.id).notNull(),
    mailboxId: uuid('mailbox_id').references(() => mailboxes.id).notNull(),

    isRead: boolean('is_read').default(false),
    isStarred: boolean('is_starred'),
    isSender: boolean('is_sender').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    trashSince: timestamp('trash_since'),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at')
}, (table) => [
    index('user_emails_user_idx').on(table.userId),
    index('user_emails_mailbox_idx').on(table.mailboxId),
    index('user_emails_email_idx').on(table.emailId),
    uniqueIndex('user_emails_unique_idx').on(table.userId, table.emailId, table.mailboxId),
    index('user_emails_trash_since').on(table.trashSince)
]);

export const recipients = pgTable('recipients', {
    id: uuid('id').defaultRandom().primaryKey(),
    emailId: uuid('email_id').references(() => emails.id).notNull(),
    userId: uuid('user_id').references(() => users.id),
    address: text('address'),
    type: rcptTypes('type').notNull()
}, (table) => [
    index('recipient_email_idx').on(table.emailId),
    index('recipient_rcpt_idx').on(table.userId),
    index('recipient_email_type_idx').on(table.emailId, table.type),
    check('recipients_target_chk', sql`user_id IS NOT NULL OR address IS NOT NULL`)
]);

export const attachments = pgTable('attachments', {
    id: uuid('id').defaultRandom().primaryKey(),
    emailId: uuid('email_id').references(() => emails.id).notNull(),
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
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => [
    uniqueIndex('label_user_name_idx').on(table.userId, table.name)
]);

export const emailLabels = pgTable('email_labels', {
    id: uuid('id').defaultRandom().primaryKey(),
    userEmailId: uuid('user_email_id').references(() => userEmails.id, { onDelete: 'cascade' }).notNull(),
    labelId: uuid('label_id').references(() => labels.id, { onDelete: 'cascade' }).notNull()
}, (table) => [
    index('email_label_user_email_idx').on(table.userEmailId),
    index('email_label_label_idx').on(table.labelId),
    uniqueIndex('email_label_unique_idx').on(table.userEmailId, table.labelId)
]);

export const auditLogs = pgTable('audit_logs', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    actionType: actionTypes('action_type').notNull(),
    ipAddress: text('ip_address'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow()
});



// RELATIONS //
//#region RELATIONS

export const userRelations = relations(users, ({ many, one }) => ({
    settings: one(userSettings, {
        fields: [users.id],
        references: [userSettings.userId]
    }),
    mailboxes: many(mailboxes),
    userEmails: many(userEmails),
    sentEmails: many(emails),
    recipients: many(recipients),
    auditLogs: many(auditLogs),
    labels: many(labels)
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
    user: one(users, {
        fields: [userSettings.userId],
        references: [users.id]
    })
}));

export const mailboxRelations = relations(mailboxes, ({ many, one }) => ({
    user: one(users, {
        fields: [mailboxes.userId],
        references: [users.id]
    }),
    userEmails: many(userEmails)
}));

export const emailRelations = relations(emails, ({ many, one }) => ({
    sender: one(users, {
        fields: [emails.senderId],
        references: [users.id]
    }),
    userEmails: many(userEmails),
    recipients: many(recipients),
    attachments: many(attachments)
}));

export const userEmailRelations = relations(userEmails, ({ many, one }) => ({
    user: one(users, {
        fields: [userEmails.userId],
        references: [users.id]
    }),
    email: one(emails, {
        fields: [userEmails.emailId],
        references: [emails.id]
    }),
    mailbox: one(mailboxes, {
        fields: [userEmails.mailboxId],
        references: [mailboxes.id]
    }),
    labels: many(emailLabels)
}));

export const recipientRelations = relations(recipients, ({ one }) => ({
    email: one(emails, {
        fields: [recipients.emailId],
        references: [emails.id]
    }),
    user: one(users, {
        fields: [recipients.userId],
        references: [users.id]
    })
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
    email: one(emails, {
        fields: [attachments.emailId],
        references: [emails.id]
    })
}));

export const labelRelations = relations(labels, ({ many, one }) => ({
    user: one(users, {
        fields: [labels.userId],
        references: [users.id]
    }),
    emailLabels: many(emailLabels)
}));

export const emailLabelRelations = relations(emailLabels, ({ one }) => ({
    userEmail: one(userEmails, {
        fields: [emailLabels.userEmailId],
        references: [userEmails.id]
    }),
    label: one(labels, {
        fields: [emailLabels.labelId],
        references: [labels.id]
    })
}));

export const auditLogRelations = relations(auditLogs, ({ one }) => ({
    user: one(users, {
        fields: [auditLogs.userId],
        references: [users.id]
    })
}));

//#endregion