import { sql } from 'drizzle-orm';
import { pgTable, check, serial, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    name: text('name'),
    email: text('email').unique().notNull(),
    password: text('password')
}, (table) => [
    check('email_check', sql`${table.email} ~* '~ripple\\.com$'`)
]);