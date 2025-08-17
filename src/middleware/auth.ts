import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../utils/jwt';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.jwt || req.headers['authorization']?.split(' ')[1];

    if (!token) return res.status(401).json({ status: 'error', error: 'No Token provided' });

    const decoded = verifyJwt(token);
    if (!decoded) return res.status(403).json({ status: 'error', error: 'Invalid token' });

    req.user = decoded;
    next();
}