import "express";

export interface JwtUser {
    id: string;
    email: string;
    username: string;
}

declare module "express-serve-static-core" {
    interface Request {
        user?: JwtUser;
    }
}