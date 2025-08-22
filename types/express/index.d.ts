import "express";

export interface JwtUser {
    id: number;
    email: string;
    username: string;
}

declare module "express-serve-static-core" {
    interface Request {
        user?: JwtUser;
    }
}