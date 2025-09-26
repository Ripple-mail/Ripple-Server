import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { users } from '$db/schema';

const SECRET = process.env.JWT_SECRET || 'super-secret-key';

type JwtUser = typeof users.$inferSelect;

export function signJwt(payload: JwtUser, expiresIn: SignOptions['expiresIn'] = '2h') {
    return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyJwt(token: string): (JwtUser & JwtPayload) | null {
    try {
        return jwt.verify(token, SECRET) as JwtUser & JwtPayload;
    } catch {
        return null;
    }
}