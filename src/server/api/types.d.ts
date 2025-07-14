import 'express';

declare module 'express-servce-static-core' {
    interface Request {
        requestSize?: number;
    }
}