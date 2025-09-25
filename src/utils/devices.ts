import { db } from '$db/db';
import { auditLogs, devices } from '$db/schema';
import { eq, and } from 'drizzle-orm';

export async function getOrCreateDevice(userId: string, userAgent: string, ip: string, fingerprint?: string) {
    const device = await db.query.devices.findFirst({
        where: (table, { eq, and }) => {
            const conditions = [eq(table.userId, userId)];
            if (fingerprint) conditions.push(eq(table.deviceFingerprint, fingerprint));
            else conditions.push(eq(table.userAgent, userAgent));

            return and(...conditions);
        }
    });

    const now = new Date();

    if (device) {
        await db.update(devices)
            .set({
                lastSeenAt: now,
                lastIp: ip
            })
            .where(eq(devices.id, device.id));
        return device;
    }

    const [newDevice] = await db.insert(devices).values({
        userId,
        userAgent,
        lastIp: ip,
        deviceFingerprint: fingerprint || null,
        firstSeenAt: now,
        lastSeenAt: now
    }).returning();

    await db.insert(auditLogs).values({
        userId,
        action: 'Device added successfully',
        actionType: 'device_added',
        metadata: JSON.stringify({
            method: fingerprint ? 'fingerprint' : 'userAgent',
            fingerprint,
            agent: userAgent
        }),
        ipAddress: ip
    });

    return newDevice;
}