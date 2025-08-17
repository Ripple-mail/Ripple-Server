import jwt, { SignOptions } from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'super-secret-key';

export function signJwt(payload: object, expiresIn: SignOptions['expiresIn'] = '1h') {
    return jwt.sign(payload, SECRET, { expiresIn });
}

export function verifyJwt(token: string) {
    try {
        return jwt.verify(token, SECRET);
    } catch {
        return null;
    }
}