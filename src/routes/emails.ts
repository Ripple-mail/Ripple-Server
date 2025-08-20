import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { eq, inArray } from 'drizzle-orm';
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

        const userEmails = await db.query.emails.findMany({
            where: inArray(emails.mailboxId, mailboxIds),
        });

        return res.status(200).json({ status: 'success', data: userEmails });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;