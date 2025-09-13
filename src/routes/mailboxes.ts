import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../../db/db';
import { mailboxes, auditLogs } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const router: Router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    try {
        const userMailboxes = await db.query.mailboxes.findMany({
            where: and(
                eq(mailboxes.userId, req.user.id),
                isNull(mailboxes.deletedAt)
            ),
            orderBy: (mailboxes, { asc }) => [asc(mailboxes.createdAt)],
        });
        res.status(200).json({ status: 'success', data: userMailboxes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ status: 'error', error: 'Mailbox name is required and must be a non-empty string' });
    }

    try {
        const existingMailbox = await db.query.mailboxes.findFirst({
            where: and(
                eq(mailboxes.userId, req.user.id),
                eq(mailboxes.name, name.trim())
            )
        });

        if (existingMailbox) {
            return res.status(409).json({ status: 'error', error: 'A mailbox with this name already exists' });
        }

        const [newMailbox] = await db.insert(mailboxes).values({
            userId: req.user.id,
            name: name.trim(),
            systemMailbox: false,
            mailboxType: null,
        }).returning();

        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: `Created mailbox: ${name.trim()}`,
            actionType: 'create_mailbox',
            ipAddress: req.audit.ipAddress,
            metadata: JSON.stringify({
                agent: req.audit.agent,
                mailboxId: newMailbox.id
            })
        });

        res.status(201).json({ status: 'success', data: newMailbox });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

// Update a mailbox name
router.put('/:mailboxId', authMiddleware, async (req, res) => {
    const { name } = req.body;
    const { mailboxId } = req.params;

    if (!mailboxId || typeof mailboxId !== 'string' || mailboxId.trim().length === 0) {
        return res.status(400).json({ status: 'error', error: 'Invalid mailbox ID' });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ status: 'error', error: 'New mailbox name is required' });
    }

    try {
        const mailbox = await db.query.mailboxes.findFirst({
            where: and(
                eq(mailboxes.id, mailboxId),
                eq(mailboxes.userId, req.user.id)
            )
        });

        if (!mailbox) {
            return res.status(404).json({ status: 'error', error: 'Mailbox not found' });
        }

        if (mailbox.systemMailbox) {
            return res.status(403).json({ status: 'error', error: 'Cannot rename a system mailbox' });
        }

        const oldName = mailbox.name;
        const [updatedMailbox] = await db.update(mailboxes)
            .set({ name: name.trim(), updatedAt: new Date() })
            .where(eq(mailboxes.id, mailboxId))
            .returning();
        
        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: `Renamed mailbox from "${oldName}" to "${name.trim()}"`,
            actionType: 'rename_mailbox',
            ipAddress: req.audit.ipAddress,
            metadata: JSON.stringify({
                agent: req.audit.agent,
                mailboxId: updatedMailbox.id
            })
        });

        res.status(200).json({ status: 'success', data: updatedMailbox });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

// Soft-delete a mailbox
router.delete('/:mailboxId', authMiddleware, async (req, res) => {
    const { mailboxId } = req.params;

    if (!mailboxId || typeof mailboxId !== 'string' || mailboxId.trim().length === 0) {
        return res.status(400).json({ status: 'error', error: 'Invalid mailbox ID' });
    }

    try {
        const mailbox = await db.query.mailboxes.findFirst({
            where: and(
                eq(mailboxes.id, mailboxId),
                eq(mailboxes.userId, req.user.id)
            )
        });

        if (!mailbox) {
            return res.status(404).json({ status: 'error', error: 'Mailbox not found' });
        }

        if (mailbox.systemMailbox) {
            return res.status(403).json({ status: 'error', error: 'Cannot delete a system mailbox' });
        }

        // TODO: Decide what happens to emails in this mailbox.
        // For now, we'll just mark the mailbox as deleted.
        await db.update(mailboxes)
            .set({ deletedAt: new Date() })
            .where(eq(mailboxes.id, mailboxId));

        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: `Deleted mailbox: ${mailbox.name}`,
            actionType: 'delete_mailbox',
            ipAddress: req.audit.ipAddress,
            metadata: JSON.stringify({
                agent: req.audit.agent,
                mailboxId: mailbox.id
            })
        });

        res.status(200).json({ status: 'success', message: 'Mailbox deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;
