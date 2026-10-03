import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRelyingParty, signChallenge, setChallengeCookie } from '@/lib/webauthn';

export async function POST() {
  try {
    const { rpID } = getRelyingParty();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: [],
    });

    const challengeToken = signChallenge({
      challenge: options.challenge,
      purpose: 'login',
    });

    const res = NextResponse.json(options, { status: 200 });
    setChallengeCookie(res, challengeToken);
    return res;
  } catch (error) {
    console.error('Error in /api/auth/passkey/login/options:', error);
    return NextResponse.json(
      { error: 'Failed to generate passkey login options' },
      { status: 500 }
    );
  }
}
