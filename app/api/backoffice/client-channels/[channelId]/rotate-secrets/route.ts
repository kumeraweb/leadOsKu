import { z } from 'zod';
import { requireBackofficeAdmin } from '@/lib/domain/authz';
import { fail, ok } from '@/lib/domain/http';
import { encryptSecret } from '@/lib/domain/crypto';

const rotateSchema = z.object({
  meta_access_token: z.string().min(1),
  meta_app_secret: z.string().min(1)
});

export async function PATCH(req: Request, { params }: { params: { channelId: string } }) {
  const auth = await requireBackofficeAdmin();
  if ('error' in auth) {
    return fail(auth.error, auth.status);
  }

  const payload = await req.json().catch(() => null);
  const parsed = rotateSchema.safeParse(payload);
  if (!parsed.success) {
    return fail('Invalid payload', 400);
  }

  const { channelId } = params;

  const { data, error } = await auth.serviceSupabase
    .from('client_channels')
    .update({
      meta_access_token_enc: encryptSecret(parsed.data.meta_access_token),
      meta_app_secret_enc: encryptSecret(parsed.data.meta_app_secret),
      encryption_version: 1
    })
    .eq('id', channelId)
    .select('id, client_id, phone_number_id, encryption_version, is_active')
    .maybeSingle();

  if (error) {
    return fail(error.message, 500);
  }

  if (!data) {
    return fail('Channel not found', 404);
  }

  return ok({ channel: data });
}
