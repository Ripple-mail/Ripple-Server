import crypto from 'crypto';
import { db } from '$db/db';
import { sessions, refreshTokens } from '$db/schema';
import { getOrCreateDevice } from './devices';
import { and, eq, gt } from 'drizzle-orm';

export function generateToken(): string {
    return crypto.randomBytes(64).toString('hex');
}

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSessionAndRefresh(userId: string, userAgent: string, ip: string, deviceFingerprint?: string) {
    const sessionToken = generateToken();
    const refreshToken = generateToken();
    const sessionTokenHash = hashToken(sessionToken);
    const refreshTokenHash = hashToken(refreshToken);

    const sessionExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 2);
    const refreshExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    const device = await getOrCreateDevice(userId, userAgent, ip, deviceFingerprint);

    const [session] = await db.insert(sessions).values({
        userId,
        deviceId: device.id,
        sessionTokenHash,
        ipAddress: ip,
        userAgent,
        expiresAt: sessionExpiresAt
    }).returning();

    await db.insert(refreshTokens).values({
        sessionId: session.id,
        tokenHash: refreshTokenHash,
        createdByIp: ip,
        expiresAt: refreshExpiresAt
    });

    return { sessionToken, refreshToken, session, device }
}

export async function validateSession(token: string) {
    const tokenHash = hashToken(token);
    
    const session = await db.query.sessions.findFirst({
        where: and(
            eq(sessions.sessionTokenHash, tokenHash),
            gt(sessions.expiresAt, new Date())
        )
    });

    return session || null;
}

export async function rotateSession(refreshToken: string, ip: string, userAgent: string) {
    const refreshHash = hashToken(refreshToken);

    const oldRefresh = await db.query.refreshTokens.findFirst({
        where: and(
            eq(refreshTokens.tokenHash, refreshHash),
            gt(refreshTokens.expiresAt, new Date())
        )
    });
    if (!oldRefresh) return null;

    const oldSession = await db.query.sessions.findFirst({
        where: eq(sessions.id, oldRefresh.sessionId)
    });
    if (!oldSession) return null;

    await db.delete(sessions).where(eq(sessions.id, oldRefresh.sessionId));
    await db.update(refreshTokens).set({ revoked: true, revokedAt: new Date(), revokedByIp: ip }).where(eq(refreshTokens.id, oldRefresh.id));

    return createSessionAndRefresh(oldSession.userId, userAgent, ip);
}