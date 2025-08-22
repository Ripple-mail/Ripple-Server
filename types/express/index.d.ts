import "express";

export interface JwtUser {
    id: string;
    email: string;
    name: string;
}

declare module "express-serve-static-core" {
    interface Request {
        user?: JwtUser;
    }
}