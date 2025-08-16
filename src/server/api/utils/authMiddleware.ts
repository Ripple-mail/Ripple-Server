import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './jwt';

export interface AuthenticatedRequest extends Request {
    user?: any;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ status: 'error', error: 'Not authenticated' });

    try {
        const decoded = verifyJwt(token);
        req.user = decoded;
        next();
    } catch {
        return res.status(402).json({ status: 'error', error: 'Invalid or expired token' });
    }
}