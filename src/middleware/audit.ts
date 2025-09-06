import { Request, Response, NextFunction } from 'express';

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
    const agent = req.headers['user-agent'] || ''; // Just so I don't forget, user-agent will be `okhttp/{version}` when sent from Mobile-App.
    const ipAddress = req.ips.length ? req.ips[0] : req.ip;

    req.audit = { agent, ipAddress }
    next();
}