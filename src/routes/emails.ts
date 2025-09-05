import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { eq, inArray, sql, and, isNull, isNotNull } from 'drizzle-orm';
import { auditLogs, emails, mailboxes, userEmails, recipients } from '../../db/schema';
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

//? Currently only for changing mailbox, but could also be used to update label or something as well under the same route.
router.patch('/', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const user = req.user;
    const { ids, mailboxId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ status: 'error', error: 'ids is required and must be a non-empty array' });
    }

    if (!mailboxId) {
        return res.status(400).json({ status: 'error', error: 'mailboxId is required' });
    }

    try {
        await db.transaction(async (tx) => {
            const result = await tx.update(userEmails)
                .set({ mailboxId })
                .where(
                    and(
                        inArray(userEmails.id, ids),
                        eq(userEmails.userId, user.id)
                    )
                )
                .returning({ id: userEmails.id });
            
            if (result.length > 0) {
                await tx.insert(auditLogs).values({
                    userId: user.id,
                    action: 'Emails moved successfully',
                    actionType: 'move_email',
                    metadata: JSON.stringify({
                        agent: req.audit.agent,
                        ids: result.map(r => r.id),
                        mailboxId
                    }),
                    ipAddress: req.audit.ipAddress
                });
            }

            return res.status(200).json({ status: 'succcess', message: `Moved ${result.length} email${result.length > 1 || result.length < 1 ? 's' : ''} to mailbox ${mailboxId}`, updatedIds: result.map(r => r.id) });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

router.delete('/', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const user = req.user;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ status: 'error', error: 'ids is required and must be a non-empty-array' });
    }

    try {
        const [trashMailbox] = await db
            .select()
            .from(mailboxes)
            .where(
                and(
                    eq(mailboxes.userId, req.user.id),
                    eq(mailboxes.mailboxType, 'trash'),
                    eq(mailboxes.systemMailbox, true) // Currently only use system mailbox. Maybe custom in 4 years?
                )
            )
            .limit(1);
        
        if (!trashMailbox) {
            return res.status(404).json({ status: 'error', error: 'Trash mailbox not found for user. Please contact support if this continues.' });
        }

        await db.transaction(async (tx) => {
            const result = await tx.update(userEmails)
                .set({ deletedAt: new Date() })
                .where(
                    and(
                        eq(userEmails.userId, user.id),
                        isNotNull(userEmails.deletedAt),
                        inArray(userEmails.id, ids),
                        eq(userEmails.mailboxId, trashMailbox.id)
                    )
                )
                .returning({ id: userEmails.id });

            if (result.length === 0) {
                return res.status(404).json({ status: 'error', error: 'No matching emails in trash' });
            }

            await tx.insert(auditLogs).values({
                userId: user.id,
                action: `Email${result.length > 1 ? 's' : ''} deleted successfully`,
                actionType: 'delete_email',
                metadata: JSON.stringify({
                    agent: req.audit.agent,
                    ids: result.map(r => r.id),
                    mailboxId: trashMailbox.id
                }),
                ipAddress: req.audit.ipAddress
            });

            return res.status(200).json({ status: 'success', message: `Permanently deleted ${result.length} email${result.length > 1 ? 's' : ''}` });
        })
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

        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'Email sent successfully',
            actionType: 'send_email',
            metadata: JSON.stringify({
                email: {
                    id: email.id,
                    emlPath: email.emlPath
                },
                agent: req.audit.agent
            }),
            ipAddress: req.audit.ipAddress,
            createdAt: email.createdAt ?? new Date()
        });

        return res.status(201).json({ status: 'success', email });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

//? Currently only for changing mailbox, but could also be used to update label or something as well under the same route.
router.patch('/:emailId', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const user = req.user;
    const { emailId } = req.params;
    const { mailboxId } = req.body;

    if (!mailboxId) {
        return res.status(400).json({ status: 'error', error: 'mailboxId is required' });
    }

    const emailMatch = and(
        eq(userEmails.emailId, emailId),
        eq(userEmails.userId, user.id)
    );
    const now = new Date();

    try {
        await db.transaction(async (tx) => {
            const [mailbox] = await tx
                .select()
                .from(mailboxes)
                .where(
                    and(
                        eq(mailboxes.id, mailboxId),
                        eq(mailboxes.userId, user.id)
                    )
                );

            if (!mailbox) {
                return res.status(404).json({ status: 'error', error: 'Mailbox does not exist for this user' });
            }

            const [result] = await tx
                .update(userEmails)
                .set({ mailboxId, updatedAt: now })
                .where(emailMatch)
                .returning();

            if (!result) {
                return res.status(404).json({ status: 'error', error: 'Email does not exist for this user' });
            }

            if (mailbox.mailboxType === 'trash') {
                await tx
                    .update(userEmails)
                    .set({ trashSince: now })
                    .where(emailMatch);
            } else if (result.trashSince !== null) {
                await tx
                    .update(userEmails)
                    .set({ trashSince: null })
                    .where(emailMatch);
            }

            await tx.insert(auditLogs).values({
                userId: user.id,
                action: 'Email moved successfully',
                actionType: 'move_email' ,
                metadata: JSON.stringify({
                    agent: req.audit.agent,  
                }),
                ipAddress: req.audit.ipAddress,
                createdAt: now
            });

            return res.status(200).json({ status: 'success' });
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

router.delete('/:emailId', authMiddleware, async (req, res) => {
    if (!req.user) return;
    const user = req.user;
    const { emailId } = req.params;

    try {
        const [trashMailbox] = await db
            .select()
            .from(mailboxes)
            .where(
                and(
                    eq(mailboxes.userId, req.user.id),
                    eq(mailboxes.mailboxType, 'trash'),
                    eq(mailboxes.systemMailbox, true) // Currently only use system mailbox. Maybe custom in 4 years?
                )
            )
            .limit(1);
        
        if (!trashMailbox) {
            return res.status(404).json({ status: 'error', error: 'Trash mailbox not found for user. Please contact support if this continues.' });
        }

        const now = new Date();

        await db.transaction(async (tx) => {
            const [result] = await tx.update(userEmails)
                .set({ deletedAt: now })
                .where(
                    and(
                        eq(userEmails.id, emailId),
                        eq(userEmails.userId, user.id),
                        isNull(userEmails.deletedAt)
                    )
                )
                .returning();
            
            if (!result) {
                return res.status(404).json({ status: 'error', error: 'No matching emails in trash' });
            }

            await tx.insert(auditLogs).values({
                userId: user.id,
                action: 'Email deleted successfully',
                actionType: 'delete_email',
                metadata: JSON.stringify({
                    agent: req.audit.agent,
                    emailId,
                    mailboxId: trashMailbox.id
                }),
                ipAddress: req.audit.ipAddress,
                createdAt: now
            });
        });

        return res.status(204);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;