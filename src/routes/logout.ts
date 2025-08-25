import express, { Router } from 'express';
import { db } from '../../db/db';
import { auditLogs } from '../../db/schema';
import net from 'node:net';
import { authMiddleware } from '../middleware/auth';

const router: Router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
    if (!req.user) return;

    const userAgent = req.headers['user-agent'] || '';
    const clientIp = req.ips.length ? req.ips[0] : req.ip;
    if (clientIp && !net.isIP(clientIp)) {
        return res.status(400).json({ status: 'error', error: 'Invalid IP address' });
    }

    try {
        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'User logged out successfully',
            actionType: 'logout',
            metadata: JSON.stringify({
                agent: userAgent
            }),
            ipAddress: clientIp
        });

        const isWebBrowser = /Mozilla|Chrome|Safari|Edge/.test(userAgent);

        if (isWebBrowser) {
            res.cookie('jwt', '', {
                httpOnly: true,
                expires: new Date(0)
            });
        }
        
        return res.json({ status: 'success', message: 'Logged out successfully' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' })
    }
});

export default router;