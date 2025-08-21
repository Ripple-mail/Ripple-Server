import express, { Router} from 'express';
import argon2 from 'argon2';
import { db } from '../../db/db';
import { eq, or } from 'drizzle-orm';
import { users, mailboxes, auditLogs } from '../../db/schema';
import net from 'node:net';

const router: Router = express.Router();

const emailRegex = /^[^~]+~[^~]+$/

router.post('/', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: 'error', error: 'Username, email, and password are required' });
    }

    if (!emailRegex.test(email)) {
        return res.status(400).json({ status: 'error', error: 'Invalid email format' });
    }

    try {
        const existingUser = await db.query.users.findFirst({
            where: or(
                eq(users.username, username),
                eq(users.email, email)
            )
        });

        if (existingUser) {
            return res.status(409).json({ status: 'error', error: 'Username or email already in use' });
        }

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const user = (await db.insert(users).values({
            username,
            email,
            passwordHash
        }).returning({ id: users.id }))[0];

        await db.insert(mailboxes).values([
            { name: 'inbox', userId: user.id, mailboxType: 'inbox', systemMailbox: true },
            { name: 'sent', userId: user.id, mailboxType: 'sent', systemMailbox: true },
            { name: 'drafts', userId: user.id, mailboxType: 'draft', systemMailbox: true },
            { name: 'trash', userId: user.id, mailboxType: 'trash', systemMailbox: true },
        ]);

        const userAgent = req.headers['user-agent'] || '';
        const clientIp = req.ips.length ? req.ips[0] : req.ip;
        if (clientIp && !net.isIP(clientIp)) {
            return res.status(400).json({ status: 'error', error: 'Invalid IP address' });
        }

        await db.insert(auditLogs).values({
            userId: user.id,
            action: 'User registerd succesfully',
            actionType: 'register',
            metadata: JSON.stringify({
                agent: userAgent,
            }),
            ipAddress: clientIp
        });

        return res.status(201).json({ status: 'success', message: 'User registered succesfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal server error' });
    }
});