import { isEmailDeliveryEnabled, sendEmail } from '../src/lib/email';

// Load local .env without printing values or throwing if missing.
try {
  process.loadEnvFile?.('.env');
} catch {
  // .env may not exist or may have already been loaded by the environment
}

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error('Usage: npx tsx scripts/send-test-email.ts <recipient-email>');
    process.exit(1);
  }

  if (!isEmailDeliveryEnabled()) {
    console.error('Email delivery is disabled. Run with EMAIL_DELIVERY_ENABLED=true to send a real email.');
    process.exit(1);
  }

  try {
    const result = await sendEmail({
      to,
      subject: 'Aura Budget test email',
      text: 'This is a test email sent from Aura Budget to verify email delivery configuration.',
    });

    console.log(`Test email sent successfully. messageId: ${result.messageId}`);
  } catch (error) {
    console.error('Failed to send test email:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
