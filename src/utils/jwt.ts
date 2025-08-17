import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import type { JwtUser } from '../../types/express';

const SECRET = process.env.JWT_SECRET || 'super-secret-key';

export function signJwt(payload: JwtUser, expiresIn: SignOptions['expiresIn'] = '30m') {
    return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyJwt(token: string): (JwtUser & JwtPayload) | null {
    try {
        return jwt.verify(token, SECRET) as JwtUser & JwtPayload;
    } catch {
        return null;
    }
}