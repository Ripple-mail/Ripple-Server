import { Request, Response, NextFunction } from 'express';
import { validateSession } from '../utils/session';
import { db } from '../../db/db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.session || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ status: 'error', error: 'No session token provided' });

    const session = await validateSession(token);
    if (!session) return res.status(403).json({ status: 'error', error: 'Invalid or expired session' });

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.userId)
    });
    if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

    req.user = user;
    req.session = session;
    next();
}