import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'hehe';
const EXPIRES_IN = '1h';

export function signJwt(payload: object) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyJwt(token: string) {
    return jwt.verify(token, SECRET);
}