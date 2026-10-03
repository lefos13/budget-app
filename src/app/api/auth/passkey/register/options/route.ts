import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import {
  getRelyingParty,
  signChallenge,
  setChallengeCookie,
  parseTransports,
} from '@/lib/webauthn';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rpName, rpID } = getRelyingParty();

    const userPasskeys = await prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    });

    const excludeCredentials = userPasskeys.map((p) => ({
      id: p.credentialId,
      transports: parseTransports(p.transports),
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const challengeToken = signChallenge({
      challenge: options.challenge,
      purpose: 'register',
      userId: user.id,
    });

    const res = NextResponse.json(options, { status: 200 });
    setChallengeCookie(res, challengeToken);
    return res;
  } catch (error) {
    console.error('Error in /api/auth/passkey/register/options:', error);
    return NextResponse.json(
      { error: 'Failed to generate passkey registration options' },
      { status: 500 }
    );
  }
}
