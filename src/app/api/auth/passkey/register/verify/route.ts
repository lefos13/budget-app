import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  getRelyingParty,
  readChallengeCookie,
  clearChallengeCookie,
  defaultPasskeyName,
} from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const challengeData = readChallengeCookie(req, 'register');
    if (!challengeData || !challengeData.challenge || challengeData.userId !== user.id) {
      const res = NextResponse.json(
        { error: 'Passkey challenge expired, please try again' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    let response: RegistrationResponseJSON;
    try {
      response = await req.json();
    } catch {
      const res = NextResponse.json(
        { error: 'Passkey verification failed' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    if (!response || typeof response !== 'object' || !response.id || !response.response) {
      const res = NextResponse.json(
        { error: 'Passkey verification failed' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const { rpID, origin } = getRelyingParty();
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeData.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: false,
      });
    } catch (err) {
      console.error('Error verifying registration response:', err);
      const res = NextResponse.json(
        { error: 'Passkey verification failed' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    if (!verification.verified || !verification.registrationInfo) {
      const res = NextResponse.json(
        { error: 'Passkey verification failed' },
        { status: 400 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    const existing = await prisma.passkey.findUnique({
      where: { credentialId: credential.id },
    });
    if (existing) {
      const res = NextResponse.json(
        { error: 'This passkey is already registered' },
        { status: 409 }
      );
      clearChallengeCookie(res);
      return res;
    }

    const userAgent = req.headers.get('user-agent');
    const name = defaultPasskeyName(userAgent);

    const passkey = await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: JSON.stringify(credential.transports ?? []),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        deviceType: true,
        backedUp: true,
      },
    });

    const res = NextResponse.json({ passkey }, { status: 201 });
    clearChallengeCookie(res);
    return res;
  } catch (error) {
    console.error('Error in /api/auth/passkey/register/verify:', error);
    const res = NextResponse.json(
      { error: 'Failed to register passkey' },
      { status: 500 }
    );
    clearChallengeCookie(res);
    return res;
  }
}
