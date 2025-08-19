import express, { Router } from 'express';
import bcrypt from 'bcrypt';
import { signJwt } from '../utils/jwt';
import { auditLogs, users } from '../../db/schema';
import { db } from '../../db/db';
import { eq, or } from 'drizzle-orm';
import argon2 from 'argon2';
import net from 'node:net';

const router: Router = express.Router();

const usersTest = [{ id: 1, username: 'Ripple', passwordHash: bcrypt.hashSync('password', 10) }];

router.post('/test', async (req, res) => {
    const { username, password } = req.body;
    const user = usersTest.find(u => u.username === username);
    if (!user) return res.status(400).json({ status: 'error', error: 'User not found' });

    const valid = bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ status: 'error', error: 'Invalid credentials' });

    const token = signJwt({ id: user.id, name: user.username, email: 'test~ripple.com' });
    res.json({ token });
});

router.post('/', async (req, res) => {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ status: 'error', error: 'Email/username and password required' });
    }

    try {
        const user = await db.query.users.findFirst({
            where: or(
                eq(users.email, identifier),
                eq(users.username, identifier)
            )
        });

        if (!user) {
            return res.status(401).json({ status: 'error', error: 'Invalid credentials' });
        }

        const passwordMatch = await argon2.verify(user.passwordHash, password);
        if (!passwordMatch) {
            return res.status(401).json({ status: 'error', error: 'Invalid credentials' });
        }

        const token = signJwt({ id: user.id, name: user.username, email: user.email });

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

        const userAgent = req.headers['user-agent'] || '';
        const clientIp = req.ips.length ? req.ips[0] : req.ip;
        if (clientIp && !net.isIP(clientIp)) {
            return res.status(400).json({ status: 'error', error: 'Invalid IP address' });
        }


        await db.insert(auditLogs).values({
            userId: user.id,
            action: 'User logged in successfully',
            actionType: 'login',
            metadata: JSON.stringify({
                method: 'password',
                browser: userAgent,
                success: true
            }),
            ipAddress: clientIp
        });

        const isWebBrowser = /Mozilla|Chrome|Safari|Edge/.test(userAgent);

        if (isWebBrowser) {
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'none'
            });
        }

        return res.json({ status: 'success', message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal server error' });
    }
});

export default router;