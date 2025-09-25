import express, { Router } from 'express';
import { db } from '$db/db';
import { auditLogs } from '$db/schema';
import { authMiddleware } from '../middleware/auth';

const router: Router = express.Router();

router.post('/', authMiddleware, async (req, res) => {
    try {
        await db.insert(auditLogs).values({
            userId: req.user.id,
            action: 'User logged out successfully',
            actionType: 'logout',
            metadata: JSON.stringify({
                agent: req.audit.agent
            }),
            ipAddress: req.audit.ipAddress
        });

        const isWebBrowser = /Mozilla|Chrome|Safari|Edge/.test(req.audit.agent);

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