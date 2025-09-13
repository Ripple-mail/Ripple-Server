import 'express';
import { sessions, users } from '../../db/schema';

export interface AuditOptions {
    agent: string;
    ipAddress: string | undefined;
}

declare module 'express-serve-static-core' {
    interface Request {
        user: typeof users.$inferSelect;
        audit: AuditOptions;
        session: typeof sessions.$inferSelect;
    }
}