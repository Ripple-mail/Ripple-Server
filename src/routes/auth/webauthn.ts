import express, { Router } from 'express';
import { generateAuthenticationOptions, verifyAuthenticationResponse, generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { origin, rpID, rpName } from '../../utils/webauthn';
import { eq, sql } from 'drizzle-orm';
import { db } from '$db/db';
import { passkeys, userSettings } from '$db/schema';
import { authenticationChallengeMap, registrationChallengeMap } from '../../utils/challengeStore';
import { authMiddleware } from '../../middleware/auth';

const router: Router = express.Router();
router.use(authMiddleware);

router.post('/generate-registration-options', async (req, res) => {
    const { user } = req;

    const existingCreds = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, user.id)
    });

    const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userName: user.email,
        excludeCredentials: existingCreds.map(cred => ({
            id: cred.credentialId,
            transports: cred.transports || undefined
        })),
        authenticatorSelection: {
            userVerification: 'preferred'
        },
        attestationType: 'none'
    });

    registrationChallengeMap.set(user.id, options.challenge);

    return res.json(options);
});

router.post('/verify-registration', async (req, res) => {
    const { credential } = req.body;
    const { user } = req;

    const expectedChallenge = registrationChallengeMap.get(user.id);
    if (!expectedChallenge) return res.status(400).json({ status: 'error', error: 'No challenge found for user' });

    let verification;

    try {
        verification = verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID
        });
    } catch {
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }

    const { verified, registrationInfo } = await verification;

    if (verified && registrationInfo) {
        const { credential: { id, publicKey, counter, transports } } = registrationInfo;

        await db.insert(passkeys).values({
            userId: user.id,
            credentialId: id,
            publicKey: Buffer.from(publicKey).toString('base64url'),
            counter: counter,
            transports
        });

        registrationChallengeMap.delete(user.id);
        await db.update(userSettings).set({ mfaEnabled: true, mfaMethods: sql`${userSettings.mfaMethods} || '{webauthn}'`}).where(eq(userSettings.userId, user.id));
    }
    
    return res.json({ status: 'success', verified });
});

router.post('/generate-authentication-options', async (req, res) => {
    const creds = await db.query.passkeys.findMany({
        where: eq(passkeys.userId, req.user.id)
    });

    const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
        allowCredentials: creds.map(cred => ({
            id: cred.credentialId,
            transports: cred.transports || undefined
        }))
    });

    authenticationChallengeMap.set(req.user.id, options.challenge);

    return res.json({ status: 'success', options });
});

router.post('/verify-authentication', async (req, res) => {
    const { credential } = req.body;

    const expectedChallenge = authenticationChallengeMap.get(req.user.id);
    if (!expectedChallenge) return res.status(400).json({ status: 'error', error: 'No challenge found for user' });

    const credId = credential.id;
    const cred = await db.query.passkeys.findFirst({
        where: eq(passkeys.credentialId, credId)
    });
    if (!cred) return res.status(404).json({ status: 'error', error: 'Credential not found' });

    let verification;

    try {
        verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: cred.credentialId,
                publicKey: Buffer.from(cred.publicKey, 'base64url'),
                counter: cred.counter
            }
        });
    } catch {
        return res.status(500).json({ status: 'error', error: 'Internal Server Error' });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
        await db.update(passkeys).set({ counter: authenticationInfo.newCounter }).where(eq(passkeys.credentialId, cred.credentialId));
        authenticationChallengeMap.delete(req.user.id);
    }

    return res.json({ status: 'success', verified });
});

export default router;