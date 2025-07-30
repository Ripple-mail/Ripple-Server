import express, { Router } from 'express';
import { db } from '../../../../db/db';
import { eq } from 'drizzle-orm';
import { users, userTotp } from '../../../../db/schema';
import { authenticator } from 'otplib';

const router: Router = express.Router();

router.post('/', async (req, res) => {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || user.password !== password) {
        res.status(401).send({ status: 'error', error: 'Invalid email or password' });
        return;
    }

    if (user.twofaTotpEnabled) {
        res.send({ status: 'totp_required', user });
    } else {
        res.status(200).send({ status: 'success', user });
    }
});

router.post('/totp', async (req, res) => {
    const { userId, token } = req.body;

    const record = await db.query.userTotp.findFirst({
        where: eq(userTotp.userId, userId)
    });

    if (!record?.confirmed) return res.status(400).json({ status: 'error', error: 'TOTP not set up' });

    const isValid = authenticator.check(token, record.secret);
    if (!isValid) return res.status(400).json({ status: 'error', error: 'Invalid token' });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
        res.status(401).send({ status: 'error', error: 'User not found' });
        return;
    }

    res.json({ status: 'success', message: 'TOTP verified', user });
});

export default router;