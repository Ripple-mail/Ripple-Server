import express, { Router } from 'express';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { db } from '../../../../../db/db';
import { eq } from 'drizzle-orm';
import { userTotp, users } from '../../../../../db/schema';

const router: Router = express.Router();

function formatSecret(secret: string) {
    return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

router.post('/setup', async (req, res) => {
    const { userId } = req.body;
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });
    if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Ripple', secret);
    const qr = await qrcode.toDataURL(otpauth);

    await db.insert(userTotp).values({ userId, secret }).onConflictDoUpdate({ target: userTotp.userId, set: { secret, confirmed: false } });
    res.json({ qr, secret: formatSecret(secret) });
});

router.post('/verify', async (req, res) => {
    const { token, userId } = req.body;
    if (!userId) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

    const record = await db.query.userTotp.findFirst({
        where: eq(userTotp.userId, userId)
    });
    if (!record) return res.status(400).json({ status: 'error', error: 'No TOTP setup found' });

    const isValid = authenticator.check(token, record.secret);
    if (!isValid) return res.status(400).json({ status: 'error', error: 'Invalid token' });

    await db.update(userTotp).set({ confirmed: true }).where(eq(userTotp.userId, userId));
    await db.update(users).set({ twofaEnabled: true, twofaTotpEnabled: true }).where(eq(users.id, userId));
    res.json({ status: 'success' });
});

router.post('/disable', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

    await db.delete(userTotp).where(eq(userTotp.userId, userId));
    await db.update(users).set({ twofaTotpEnabled: false }).where(eq(users.id, userId));

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });

    if (user && !user.twofaPasskeyEnabled) {
        await db.update(users).set({ twofaEnabled: false }).where(eq(users.id, userId));
    }

    res.json({ status: 'success' });
});

export default router;