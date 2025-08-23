import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { eq, inArray, sql, and } from 'drizzle-orm';
import { auditLogs, emails, mailboxes, userEmails } from '../../db/schema';
import net from 'node:net';

const router: Router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
   if (!req.user) return;

    try {
        let mailboxIds: number[];

        if (!req.query.mailboxId) {
            const userMailboxes = await db.query.mailboxes.findMany({
                where: eq(mailboxes.userId, req.user.id),
            });

            if (userMailboxes.length === 0) {
                return res.status(404).json({ status: 'error', error: 'No mailboxes found for user' });
            }

            mailboxIds = userMailboxes.map(mb => mb.id);
        } else {
            mailboxIds = [Number(req.query.mailboxId)];
        }

        if (req.query.query) {
            const term = String(req.query.query ?? '');
            if (term.trim().length === 0) {
                return res.status(400).json({ status: 'error', error: 'Search terms cannot be empty' });
            }

            const prefixQuery = term.split(/\s+/).map(word => `${word}:*`).join(' & ');

            const results = await db
                .select({
                    id: emails.id,
                    subject: emails.subject,
                    mailbox_id: userEmails.mailboxId,
                    body_text: emails.bodyText,
                    recipients: sql<string[]>`
                        ARRAY(
                            SELECT r.address
                            FROM recipients r
                            WHERE r.email_id = emails.id
                        )
                    `.as('recipients'),
                    rank: sql<number>`
                      ts_rank(${emails.searchVector}, websearch_to_tsquery('english', ${term}))
                      + 0.5 * ts_rank(${emails.searchVector}, to_tsquery('english', ${prefixQuery}))
                    `.as('rank')
                })
                .from(userEmails)
                .leftJoin(emails, eq(userEmails.emailId, emails.id))
                .where(
                    and(
                        eq(userEmails.userId, req.user.id),
                        inArray(userEmails.mailboxId, mailboxIds),
                        sql`
                          (
                            ${emails.searchVector} @@ websearch_to_tsquery('english', ${term})
                            OR ${emails.searchVector} @@ to_tsquery('english', ${prefixQuery})
                            OR emails.subject ILIKE '%' || ${term} || '%'
                            OR emails.from_address ILIKE '%' || ${term} || '%'
                            OR EXISTS (
                              SELECT 1
                              FROM recipients r
                              WHERE r.email_id = emails.id
                                AND r.address ILIKE '%' || ${term} || '%'
                            )
                          )
                        `
                    )
                )
                .groupBy(emails.id, userEmails.mailboxId)
                .orderBy(sql`rank DESC`);

            return res.status(200).json({ status: 'success', data: results });
        } else {
            const userMailboxEmails = await db
                .select()
                .from(userEmails)
                .innerJoin(emails, eq(userEmails.emailId, emails.id))
                .where(
                    and(
                        eq(userEmails.userId, req.user.id),
                        inArray(userEmails.mailboxId, mailboxIds)
                    )
                )
                .orderBy(emails.createdAt);


            return res.status(200).json({ status: 'success', data: userMailboxEmails });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

router.post('/send', authMiddleware, async (req, res) => {
    if (!req.user) return;

    try {
        // Send email here

        const userAgent = req.headers['user-agent'] || '';
        const clientIp = req.ips.length ? req.ips[0] : req.ip;
        if (clientIp && !net.isIP(clientIp)) {
            return res.status(400).json({ status: 'error', error: 'Invalid IP address' });
        }

        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'Email sent successfully',
            actionType: 'send_email',
            metadata: JSON.stringify({
                agent: userAgent
            }),
            ipAddress: clientIp
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;