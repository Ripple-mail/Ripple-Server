import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { eq, inArray, sql, and, isNull } from 'drizzle-orm';
import { auditLogs, emails, mailboxes, userEmails, recipients } from '../../db/schema';
import net from 'node:net';
import { saveEmail } from '../utils/saveEmail';

const router: Router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    if (!req.user) return;

    try {
        let mailboxIds: string[];

        if (!req.query.mailboxId) {
            const userMailboxes = await db.query.mailboxes.findMany({
                where: and(
                    eq(mailboxes.userId, req.user.id),
                    isNull(mailboxes.deletedAt)
                ),
            });

            if (userMailboxes.length === 0) {
                return res.status(404).json({ status: 'error', error: 'No mailboxes found for user' });
            }

            mailboxIds = userMailboxes.map(mb => mb.id);
        } else {
            const mailboxId = req.query.mailboxId as string;
            
            const mailbox = await db.query.mailboxes.findFirst({
                where: and(eq(mailboxes.id, mailboxId), eq(mailboxes.userId, req.user.id))
            });
            if (!mailbox) {
                return res.status(404).json({ status: 'error', error: 'Mailbox not found or access denied' });
            }
            mailboxIds = [mailboxId];
        }

        if (req.query.query) {
            const term = (req.query.query as string) ?? '';
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
                        `,
                        isNull(userEmails.deletedAt)
                    )
                )
                .groupBy(emails.id, userEmails.mailboxId)
                .orderBy(sql`rank DESC`);

            return res.status(200).json({ status: 'success', data: results });
        } else {
            const userMailboxEmails = await db
                .select({
                    user_emails: userEmails,
                    emails: emails,
                    recipients: sql<string[]>`
                        ARRAY(
                            SELECT r.address
                            FROM recipients r
                            WHERE r.email_id = emails.id AND r.type IN ('to', 'cc')
                        )
                    `.as('recipients')
                })
                .from(userEmails)
                .innerJoin(emails, eq(userEmails.emailId, emails.id))
                .where(
                    and(
                        eq(userEmails.userId, req.user.id),
                        inArray(userEmails.mailboxId, mailboxIds),
                        isNull(userEmails.deletedAt)
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

router.get('/:emailId', authMiddleware, async (req, res) => {
    if (!req.user) return res.status(401).json({ status: 'error', error: 'Unauthorized' });

    const { emailId } = req.params;
    console.log('EMAIL DEBUG: Fetching emailId:', emailId, 'for userId:', req.user.id);

    try {
        const result = await db
            .select({
                user_email: userEmails,
                email: emails
            })
            .from(userEmails)
            .innerJoin(emails, eq(userEmails.emailId, emails.id))
            .where(and(eq(userEmails.emailId, emailId), eq(userEmails.userId, req.user.id)))
            .limit(1);

        if (!result || result.length === 0) {
            return res.status(404).json({ status: 'error', error: 'Email not found or access denied' });
        }

        const { user_email, email } = result[0];

        if (!user_email.isRead) {
            await db.update(userEmails).set({ isRead: true }).where(eq(userEmails.id, user_email.id));
        }
        const emailRecipients = await db.select().from(recipients).where(eq(recipients.emailId, email.id));

        const userEmailWithEmail = {
            ...user_email,
            email: {
                ...email,
                recipients: emailRecipients
            }
        };

        return res.status(200).json({ status: 'success', data: userEmailWithEmail });
    } catch (err) {
        console.error('EMAIL DEBUG: Error fetching email:', err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

router.post('/send', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const { from: sender, recipients, subject, body: bodyText } = req.body;

    try {
        const email = await saveEmail({ sender, subject, bodyText, recipients });

        const userAgent = req.headers['user-agent'] || ''; // Just so I don't forget, user-agent will be `okhttp/{version}` when sent from Mobile-App.
        const clientIp = req.ips.length ? req.ips[0] : req.ip;
        if (clientIp && !net.isIP(clientIp)) {
            return res.status(400).json({ status: 'error', error: 'Invalid IP address' });
        }

        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'Email sent successfully',
            actionType: 'send_email',
            metadata: JSON.stringify({
                email: {
                    id: email.id,
                    emlPath: email.emlPath
                },
                agent: userAgent
            }),
            ipAddress: clientIp,
            createdAt: email.createdAt ?? new Date()
        });

        return res.status(201).json({ status: 'success', email });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

/* router.delete('/:emailId', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const emailId = Number(req.params.emailId.split('?')[0]);

    if (isNaN(emailId)) return res.status(400).json({ status: 'error', error: 'emailId must be a number' });

    const timeNow = new Date();

    try {
        await db
            .update(userEmails)
            .set({ deletedAt: timeNow })
            .where(
                and(
                    eq(userEmails.userId, req.user.id),
                    eq(userEmails.emailId, emailId)
                )
            );

        const userAgent = req.headers['user-agent'] || '';
        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'Email deleted successfully',
            actionType: 'delete_email',
            metadata: JSON.stringify({
                emailId,
                agent: userAgent
            }),
            createdAt: timeNow
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
}); */

export default router;