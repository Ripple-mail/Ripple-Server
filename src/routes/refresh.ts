import express, { Router } from 'express';
import { rotateSession } from '../utils/session';

const router: Router = express.Router();

router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies?.refresh || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ status: 'error', error: 'No refresh token' });

    const tokens = await rotateSession(refreshToken, req.audit.ipAddress || '', req.audit.agent);
    if (!tokens) return res.status(403).json({ status: 'error', error: 'Invalid or expired refresh token' });

    res.cookie('session', tokens.sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
    });
    res.cookie('refresh', tokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
    });

    res.json({ status: 'success' });
});

export default router;