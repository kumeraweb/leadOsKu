import { env } from '@/lib/env';

export async function sendLeadNotificationEmail(params: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!env.resendApiKey) {
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'no-responder@leados.cl',
      to: [params.to],
      subject: params.subject,
      html: params.html
    })
  });
}
