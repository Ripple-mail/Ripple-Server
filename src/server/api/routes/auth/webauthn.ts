import express, { Router } from 'express';
import { generateAuthenticationOptions, verifyAuthenticationResponse, generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { origin, rpID, rpName } from '../../utils/webauthn';
import { users, passkeys } from '../../../../../db/schema';
import { eq } from 'drizzle-orm';
import { db } from '../../../../../db/db';
import { authenticationChallengeMap, registrationChallengeMap } from '../../utils/challengeStore';

const router: Router = express.Router();

router.post('/generate-registration-options', async (req, res) => {
    const { userId } = req.body;

    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });
    if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

    const existingCreds = await db.select().from(passkeys).where(eq(passkeys.userId, user.id));

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
    const { userId, credential } = req.body;

    const expectedChallenge = registrationChallengeMap.get(userId);
    if (!expectedChallenge) return res.status(400).json({ status: 'error', error: 'No challenge found for user' });

    let verification;

    try {
        console.dir(credential, { depth: null });

        verification = verifyRegistrationResponse({
            response: credential,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID
        });
        console.log(verification);
    } catch (error) {
        console.log(verification); //@ts-ignore
        return res.status(400).json({ status: 'error', error: error.message ?? String(error) });
    }

    const { verified, registrationInfo } = await verification;

    if (verified && registrationInfo) {
        const { credential: { id, publicKey, counter, transports } } = registrationInfo;
        
        await db.insert(passkeys).values({
            userId,
            credentialId: id,
            publicKey: Buffer.from(publicKey).toString('base64url'),
            counter: counter.toString(),
            transports
        });

        registrationChallengeMap.delete(userId);
        await db.update(users).set({ twofaEnabled: true, twofaPasskeyEnabled: true }).where(eq(users.id, userId));
    }

    res.json({ status: 'success', verified });
});

router.post('/generate-authentication-options', async (req, res) => {
    const { email } = req.body;

    const user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });
    if (!user) return res.status(404).json({ status: 'error', error: 'User not found' });

    const creds = await db.select().from(passkeys).where(eq(passkeys.userId, user.id));

    const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
        allowCredentials: creds.map(cred => ({
            id: cred.credentialId,
            transports: cred.transports || undefined
        }))
    });

    authenticationChallengeMap.set(user.id, options.challenge);

    res.json({ options, userId: user.id });
});

router.post('/verify-authentication', async (req, res) => {
    const { userId, credential } = req.body;

    const expectedChallenge = authenticationChallengeMap.get(userId);
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
                counter: parseInt(cred.counter)
            }
        });
    } catch (error) { //@ts-ignore
        return res.status(400).json({ status: 'error', error: error.message ?? String(error) });
    }

    const { verified, authenticationInfo } = verification;

    if (verified && authenticationInfo) {
        await db.update(passkeys).set({ counter: authenticationInfo.newCounter.toString() }).where(eq(passkeys.credentialId, cred.credentialId));
        authenticationChallengeMap.delete(userId);
    }

    res.json({ status: 'success', verified });
});

export default router;