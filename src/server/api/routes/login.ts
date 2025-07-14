import express, { Router } from 'express';
import { db } from '../../../../db/db';
import { eq } from 'drizzle-orm';
import { users } from '../../../../db/schema';

const router: Router = express.Router();

router.post('/', async (req, res) => {
    const { email, password } = req.body;

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || user.password !== password) {
        res.status(401).send({ status: 'error', error: 'Invalid email or password' });
        return;
    }

    res.status(200).send({ status: 'success', user });
});

export default router;