import { sql } from 'drizzle-orm';
import { pgTable, check, text, boolean, uuid, varchar, jsonb, timestamp, unique, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    email: text('email').unique().notNull(),
    password: text('password'),
    twofaEnabled: boolean('twofa_enabled').default(false),
    twofaTotpEnabled: boolean('twofa_totp_enabled').default(false),
    twofaPasskeyEnabled: boolean('twofa_passkey_enabled').default(false)
}, (table) => [
    check('email_check', sql`${table.email} ~* '~ripple\\.com$'`)
]);

export const emails = pgTable('emails', {
    path: text('path').primaryKey(),
    from: text('from').references(() => users.email).notNull(),
    rcpt: text('rcpt').references(() => users.email).notNull(),
});

export const attachments = pgTable('attachments', {
    fileHash: uuid('file_hash').primaryKey(),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(),
    size: integer('size'),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull()
});

export const userTotp = pgTable('user_totp', {
    userId: uuid('user_id').primaryKey().references(() => users.id),
    secret: varchar('secret', { length : 128 }).notNull(),
    confirmed: boolean('confirmed').default(false)
});

export const passkeys = pgTable('passkeys', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    credentialId: varchar('credential_id', { length: 255 }).notNull(),
    publicKey: varchar('public_key', { length: 5000 }).notNull(),
    counter: varchar('counter', { length: 64 }).notNull(),
    transports: jsonb('transports'),
    createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
    credentialIndex: unique().on(table.userId, table.credentialId)
}));