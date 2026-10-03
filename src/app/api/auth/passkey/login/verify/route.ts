import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, setSessionCookie } from '@/lib/auth';
import {
  getRelyingParty,
  readChallengeCookie,
  clearChallengeCookie,
  parseTransports,
} from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const challengeData = readChallengeCookie(req, 'login');
    if (!challengeData || !challengeData.challenge) {
      const res = NextResponse.json(
        { error: 'Passkey challenge expired, please try again' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    let body: AuthenticationResponseJSON;
    try {
      body = await req.json();
    } catch {
      const res = NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    if (!body || typeof body !== 'object' || !body.id) {
      const res = NextResponse.json(
        { error: 'Passkey not recognised' },
        { status: 401 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const passkey = await prisma.passkey.findUnique({
      where: { credentialId: body.id },
      include: { user: true },
    });

    if (!passkey || !passkey.user) {
      const res = NextResponse.json(
        { error: 'Passkey not recognised' },
        { status: 401 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const { rpID, origin } = getRelyingParty();
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: parseTransports(passkey.transports),
        },
        requireUserVerification: false,
      });
    } catch (err) {
      console.error('Error verifying authentication response:', err);
      const res = NextResponse.json(
        { error: 'Passkey not recognised' },
        { status: 401 }
      );
      clearChallengeCookie(res);
      return res;
    }

    if (!verification.verified) {
      const res = NextResponse.json(
        { error: 'Passkey not recognised' },
        { status: 401 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const { newCounter } = verification.authenticationInfo;
    if (passkey.counter > 0 || newCounter > 0) {
      if (newCounter <= passkey.counter) {
        console.warn(
          `Passkey counter rollback detected for passkey ${passkey.id}: stored=${passkey.counter}, received=${newCounter}`
        );
        const res = NextResponse.json(
          { error: 'Passkey not recognised' },
          { status: 401 }
        );
        clearChallengeCookie(res);
        return res;
      }
    }

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: newCounter,
        lastUsedAt: new Date(),
      },
    });

    const token = createSessionToken({
      userId: passkey.user.id,
      email: passkey.user.email,
    });

    const safeUser = {
      id: passkey.user.id,
      name: passkey.user.name,
      email: passkey.user.email,
      avatarUrl: passkey.user.avatarUrl,
    };

    const res = NextResponse.json({ user: safeUser }, { status: 200 });
    setSessionCookie(res, token);
    clearChallengeCookie(res);
    return res;
  } catch (error) {
    console.error('Error in /api/auth/passkey/login/verify:', error);
    const res = NextResponse.json(
      { error: 'Failed to verify passkey' },
      { status: 500 }
    );
    clearChallengeCookie(res);
    return res;
  }
}
