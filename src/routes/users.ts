import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '$db/db';
import { users } from '$db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const router: Router = express.Router();

router.get('/self', authMiddleware, async (req, res) => {
    try {
        const user = await db.query.users.findFirst({
            where: and(
                eq(users.id, req.user.id),
                isNull(users.deletedAt)
            )
        });

        return res.json({ status: 'success', user });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }
});

export default router;