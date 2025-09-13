import express, { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { userOtp, userSettings } from '../../../db/schema';
import { db } from '../../../db/db';
import { eq, sql } from 'drizzle-orm';

const router: Router = express.Router();
router.use(authMiddleware);

function formatSecret(secret: string) {
    return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

router.post('/setup', async (req, res) => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.email, res.locals.appName, secret);
    const qr = await qrcode.toDataURL(otpauth);

    await db
        .insert(userOtp)
        .values({
            userId: req.user.id,
            secret
        })
        .onConflictDoUpdate({
            target: userOtp.userId,
            set: {
                secret,
                confirmed: false
            }
        });

    res.json({ qr, secret: formatSecret(secret) });
});

router.post('/verify', async (req, res) => {
    const { token } = req.body;
    const record = await db.query.userOtp.findFirst({
        where: eq(userOtp.userId, req.user.id)
    });
    if (!record) return res.status(400).json({ status: 'error', error: 'No OTP setup found' });

    const isValid = authenticator.check(token, record.secret);
    if (!isValid) return res.status(400).json({ status: 'error', error: 'Invalid token' });

    await db.update(userOtp).set({ confirmed: true }).where(eq(userOtp.userId, req.user.id));
    await db.update(userSettings).set({ mfaEnabled: true, mfaMethods: sql`${userSettings.mfaMethods} || '{otp}'` }).where(eq(userOtp.userId, req.user.id));

    await db.execute(sql`
        UPDATE sessions 
        SET last_active_at = now()
        WHERE id = ${req.session.id}
    `);

    res.json({ status: 'success', message: 'TOTP verified and enabled' });
});

router.post('/disable', async (req, res) => {
    await db.delete(userOtp).where(eq(userOtp.userId, req.user.id));
    const [settings] = await db.update(userSettings).set({ mfaMethods: sql`ARRAY_REMOVE(${userSettings.mfaMethods}, otp)` }).where(eq(userSettings.userId, req.user.id)).returning();
    if (settings.mfaMethods?.length === 0) {
        await db.update(userSettings).set({ mfaEnabled: false }).where(eq(userSettings.userId, req.user.id));
    }

    res.json({ status: 'success', message: 'TOTP disabled' });
});

export default router;