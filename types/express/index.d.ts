import "express";

export interface JwtUser {
    id: string;
    email: string;
    username: string;
}

export interface AuditOptions {
    agent: string;
    ipAddress: string | undefined;
}

declare module "express-serve-static-core" {
    interface Request {
        user?: JwtUser;
        audit: AuditOptions;
    }
}