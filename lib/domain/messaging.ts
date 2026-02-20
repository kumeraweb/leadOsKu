import { env } from '@/lib/env';

export async function sendWhatsappText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}) {
  const url = `${env.metaApiBaseUrl}/${params.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'text',
      text: { body: params.text }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${body}`);
  }

  return response.json();
}
