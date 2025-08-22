import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { emails, mailboxes } from '../../db/schema';

const router: Router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ status: 'error', error: 'User not authenticated' });
    }

    try {
        const userMailboxes = await db.query.mailboxes.findMany({
            where: eq(mailboxes.userId, req.user.id),
        });

        if (userMailboxes.length === 0) {
            return res.status(404).json({ status: 'error', error: 'No mailboxes found for user' });
        }

        const mailboxIds = userMailboxes.map(mb => mb.id);

        if (req.query.query) {
            const term = String(req.query.query ?? '');
            if (term.trim().length === 0) {
                return res.status(400).json({ status: 'error', error: 'Search terms cannot be empty' });
            }

            const results = await db
                .select({
                    id: emails.id,
                    subject: emails.subject,
                    mailboxId: emails.mailboxId,
                    rank: sql<number>`ts_rank(${emails.searchVector}, plainto_tsquery('english', ${term}))`.as('rank')
                })
                .from(emails)
                .where(
                    and(
                        sql`${emails.searchVector} @@ plainto_tsquery('english', ${term})`,
                        inArray(emails.mailboxId, mailboxIds)
                    )
                )
                .orderBy(sql`rank DESC`);

            return res.status(200).json({ status: 'success', data: results });
        } else {
            const userEmails = await db.query.emails.findMany({
                where: inArray(emails.mailboxId, mailboxIds),
            });

            return res.status(200).json({ status: 'success', data: userEmails });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;