import { env } from '@/lib/env';

export async function sendLeadNotificationEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!env.resendApiKey) {
    return { sent: false as const, reason: 'missing_resend_api_key' as const };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.notificationFromEmail,
      to: [params.to],
      subject: params.subject,
      html: params.html
    })
  });

  if (!response.ok) {
    return {
      sent: false as const,
      reason: 'provider_error' as const,
      status: response.status,
      body: await response.text()
    };
  }

  return { sent: true as const };
}
