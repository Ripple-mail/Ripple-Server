import express, { Router } from 'express';
import { db } from '../../../../db/db';
import { eq, sql } from 'drizzle-orm';
import { emails, users } from '../../../../db/schema';
import { readMailDir, readEmail } from '../../storage/readMail';
import { getIO } from '../socket/websocket';
import { saveEmail } from '../utils/storeEmail';

const router: Router = express.Router();

router.get('/', async (req, res) => {
    if (!req.query) {
        try {
            const userList = await db.query.users.findMany();

            res.status(200).send({ status: 'success', userList });
            return;
        } catch (error) {
            res.status(500).send({ status: 'error', error });
            return;
        }
    } else {
        if (req.query.query) {
            const searchQuery: string = req.query.query as string;
            const userList = await db.select().from(users).where(
                sql`${users.email} ILIKE ${'%' + searchQuery + '%'}`
            );

            res.status(200).send({ status: 'success', userList });
            return;
        }
    }
});

router.get('/:userId', async (req, res) => {
    const userId = req.params.userId.split('?')[0];

    if (!userId) {
        res.status(400).send({ status: 'error', error: 'Invalid user or ID' });
        return;
    }

    let user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) {
        res.status(404).send({ status: 'error', error: 'User with this ID not found.' });
        return;
    }

    res.status(200).send({ status: 'success', user });
    return;
});

router.get('/:userId/mail', async (req, res) => {
    const userId = req.params.userId.split('?')[0];

    if (!userId) {
        res.status(400).send({ status: 'error', error: 'Invalid user or ID' });
        return;
    }

    let user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) {
        res.status(404).send({ status: 'error', error: 'User with this ID not found.' });
        return;
    }

    try {
        const emails = await readMailDir(user.email.split('~')[0]);
        res.status(200).send({ status: 'success', emails });
        return;
    } catch (error) {
        res.status(500).send({ status: 'error', error });
        return;
    }
});

router.get('/:userId/mail/sent', async (req, res) => {
    const userId = req.params.userId.split('?')[0];

    if (!userId) {
        res.status(400).send({ status: 'error', error: 'Invalid user or ID' });
        return;
    }

    let user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) {
        res.status(404).send({ status: 'error', error: 'User with this ID not found.' });
        return;
    }

    try {
        const sentEmailsdb = await db.query.emails.findMany({
            where: eq(emails.from, user.email)
        });

        return;
    } catch (error) {
        res.status(500).send({ status: 'error', error });
        return;
    }
});

router.get('/:userId/read/:timestamp', async (req, res) => {
    const { userId, timestamp } = req.params;

    if (!userId) return res.status(400).send({ status: 'error', error: 'Invalid user or ID' });

    let user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) return res.status(404).send({ status: 'error', error: 'User with this ID not found. '});

    try {
        const read = await readEmail(user.email.split('~')[0], timestamp, true);
        if (!read) return res.status(404).send({ status: 'error', error: 'Email not found.' });
        
        const io = getIO();
        io.to(`user_${user.id}`).emit('readEmail', read.filename);

        return res.status(200).send({ status: 'success', message: 'Successfully marked email as read' });
    } catch (error) {
        return res.status(500).send({ status: 'error', error });
    }
});

router.get('/:userId/mail/:timestamp', async (req, res) => {
    const { timestamp, userId } = req.params;

    if (!userId) {
        res.status(400).send({ status: 'error', error: 'Invalid user or ID' });
        return;
    }

    let user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (!user) {
        res.status(404).send({ status: 'error', error: 'User with this ID not found.' });
        return;
    }

    try {
        const email = await readEmail(user.email.split('~')[0], timestamp);
        if (!email) return res.status(404).send({ status: 'error', error: 'Email not found.' });

        const io = getIO();
        io.to(`user_${user.id}`).emit('readEmail', email.filename);
        res.status(200).send({ status: 'success', email });
        return;
    } catch (error) {
        res.status(500).send({ status: 'error', error });
        return;
    }
});

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const response = await db.insert(users).values({
            name,
            email,
            password
        });

        res.status(200).send({ status: 'success', response });
        return;
    } catch (error) {
        res.status(500).send({ status: 'error', error });
        return;
    }
});

router.post('/:userId/mail/send', async (req, res) => {
    const { from, rcpt, subject, body, fileHashes } = req.body;
    try {
        const path = await saveEmail(rcpt, `From: ${from}\nTo: ${rcpt}\nSubject: ${subject}\r\nAttachments: [${fileHashes}]\r\n${body}`);

        // Get rcpt user
        let user = await db.query.users.findFirst({
            where: eq(users.email, rcpt)
        });

        // Emit newEmail via socket
        const io = getIO();
        io.to(`user_${user?.id}`).emit('newEmail');

        res.status(200).send({ status: 'success', response: 'Email sent successfully' });
        return;
    } catch (error) {
        res.status(500).send({ status: 'error', error });
        return;
    }
});

export default router;