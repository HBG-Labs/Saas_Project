import constants from '../constants.json' with { type: 'json' };

export interface DemoEnvironment {
  baseUrl: string;
  businessEmail: string;
  businessPassword: string;
  portalEmail: string;
  portalPassword: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Variable ${name} manquante. Copiez les variables "Démo commerciale" de .env.example dans .env.demo.local.`,
    );
  }
  return value;
}

function assertLoopbackBaseUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(`DEMO_BASE_URL doit être une URL HTTP locale, reçu : ${url.origin}`);
  }
}

export function readDemoEnvironment(): DemoEnvironment {
  const baseUrl = required('DEMO_BASE_URL').replace(/\/$/, '');
  const supabaseUrl = required('VITE_SUPABASE_URL').replace(/\/$/, '');
  const businessEmail = required('DEMO_EMAIL').toLowerCase();
  const businessPassword = required('DEMO_PASSWORD');
  const portalEmail = (
    process.env.DEMO_PORTAL_EMAIL?.trim() || constants.portalEmail
  ).toLowerCase();
  const portalPassword = process.env.DEMO_PORTAL_PASSWORD?.trim() || businessPassword;

  assertLoopbackBaseUrl(baseUrl);

  if (businessEmail !== constants.businessEmail) {
    throw new Error(`DEMO_EMAIL doit être ${constants.businessEmail} pour ce scénario validé.`);
  }
  if (businessPassword.length < 8 || portalPassword.length < 8) {
    throw new Error('Les mots de passe de démo doivent comporter au moins 8 caractères.');
  }
  if (process.env.VITE_APP_ENV !== 'staging') {
    throw new Error('VITE_APP_ENV doit valoir staging pour enregistrer la démo commerciale.');
  }

  const expectedSupabaseUrl = `https://${constants.stagingProjectRef}.supabase.co`;
  if (supabaseUrl !== expectedSupabaseUrl) {
    throw new Error(
      `Refus de sécurité : la démo accepte uniquement le staging ${constants.stagingProjectRef}.`,
    );
  }
  if (supabaseUrl.includes(constants.mainProjectRef)) {
    throw new Error('Refus de sécurité : le projet Supabase principal ne peut jamais être filmé.');
  }

  return {
    baseUrl,
    businessEmail,
    businessPassword,
    portalEmail,
    portalPassword,
    supabaseUrl,
    supabasePublishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY'),
  };
}

export { constants as DEMO };
