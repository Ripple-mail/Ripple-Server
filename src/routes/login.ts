import express, { Router } from 'express';
import bcrypt from 'bcrypt';
import { signJwt } from '../utils/jwt';
import { auditLogs, users, userSettings } from '../../db/schema';
import { db } from '../../db/db';
import { eq, or } from 'drizzle-orm';
import argon2 from 'argon2';

const router: Router = express.Router();

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

        const usersSettings = await db.query.userSettings.findFirst({
            where: eq(userSettings.userId, user.id)
        });

        const passwordMatch = await argon2.verify(user.passwordHash, password);
        if (!passwordMatch) {
            await db.insert(auditLogs).values({
                userId: user.id,
                action: 'Login attempt failed',
                actionType: 'failed_login_attempt',
                metadata: JSON.stringify({
                    method: 'password',
                    agent: req.audit.agent
                }),
                ipAddress: req.audit.ipAddress
            });
            return res.status(401).json({ status: 'error', error: 'Invalid credentials' });
        }

        if (usersSettings && usersSettings.mfaEnabled) {
            return res.status(200).json({ status: 'mfa_required', methods: usersSettings.mfaMethods /* Send some kind of code that links with mfa to verify user login attempt on mfa */ });
        }

        const token = signJwt({ id: user.id, username: user.username, email: user.email });

        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

        await db.insert(auditLogs).values({
            userId: user.id,
            action: 'User logged in successfully',
            actionType: 'login',
            metadata: JSON.stringify({
                method: 'password',
                agent: req.audit.agent
            }),
            ipAddress: req.audit.ipAddress
        });

        const isWebBrowser = /Mozilla|Chrome|Safari|Edge/.test(req.audit.agent);

        if (isWebBrowser) {
            res.cookie('jwt', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            });
        }

        return res.json({ status: 'success', message: 'Login successful', token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;