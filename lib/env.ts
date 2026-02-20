const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

for (const key of required) {
  getEnv(key);
}

export const env = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseAnonKey: getEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  leadosSecretsKey: process.env.LEADOS_SECRETS_KEY,
  backofficeAdminEmail: process.env.BACKOFFICE_ADMIN_EMAIL,
  openAiApiKey: process.env.OPENAI_API_KEY,
  metaApiBaseUrl: process.env.META_API_BASE_URL ?? 'https://graph.facebook.com/v20.0',
  resendApiKey: process.env.RESEND_API_KEY
};
