import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { loadEnv } from 'vite';

import constants from '../demo/constants.json' with { type: 'json' };
import { commercialDemoAssets, signatureDataUrl } from '../demo/helpers/assets.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const loaded = loadEnv('demo', root, '');
for (const [name, value] of Object.entries(loaded)) {
  if (process.env[name] === undefined) process.env[name] = value;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variable ${name} manquante dans .env.demo.local.`);
  return value;
}

function assertStaging() {
  const supabaseUrl = required('VITE_SUPABASE_URL').replace(/\/$/, '');
  const databaseUrl = required('DEMO_DATABASE_URL');
  const email = required('DEMO_EMAIL').toLowerCase();

  if (process.env.DEMO_PREPARE_CONFIRM !== 'CREATE_STAGING_DEMO_DATA') {
    throw new Error('DEMO_PREPARE_CONFIRM doit valoir exactement CREATE_STAGING_DEMO_DATA.');
  }
  if (process.env.VITE_APP_ENV !== 'staging') {
    throw new Error('VITE_APP_ENV doit valoir staging.');
  }
  if (supabaseUrl !== `https://${constants.stagingProjectRef}.supabase.co`) {
    throw new Error(`Seul le staging ${constants.stagingProjectRef} peut être préparé.`);
  }
  if (
    !databaseUrl.toLowerCase().includes(constants.stagingProjectRef) ||
    databaseUrl.toLowerCase().includes(constants.mainProjectRef)
  ) {
    throw new Error('DEMO_DATABASE_URL ne désigne pas explicitement le staging autorisé.');
  }
  if (email !== constants.businessEmail) {
    throw new Error(`DEMO_EMAIL doit être ${constants.businessEmail}.`);
  }
  return { supabaseUrl, databaseUrl, email };
}

async function main() {
  const { supabaseUrl, databaseUrl, email } = assertStaging();
  const password = required('DEMO_PASSWORD');
  const portalEmail = (
    process.env.DEMO_PORTAL_EMAIL?.trim() || constants.portalEmail
  ).toLowerCase();
  const portalPassword = process.env.DEMO_PORTAL_PASSWORD?.trim() || password;
  const serviceRoleKey = required('DEMO_SUPABASE_SERVICE_ROLE_KEY');
  if (password.length < 8 || portalPassword.length < 8) {
    throw new Error('Les mots de passe de démo doivent comporter au moins 8 caractères.');
  }
  if (serviceRoleKey === process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error('La clé de préparation doit être une clé serveur, jamais la clé publique.');
  }

  console.log(
    `Préparation unique du tenant ${constants.organizationSlug} sur ${constants.stagingProjectRef}.`,
  );
  console.log(`Compte métier : ${email} ; contact portail : ${portalEmail}.`);
  console.log(
    'Mutations : comptes Auth, données fictives, cinq fichiers PNG et deux signatures sur le staging.',
  );

  const sql = postgres(databaseUrl, {
    ssl: 'require',
    max: 1,
    connect_timeout: 20,
    idle_timeout: 5,
    connection: { application_name: 'rezo360-commercial-demo-prepare' },
  });
  const storage = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let assets = [];
  const uploadedAssets = [];

  try {
    const [existing] = await sql`
      select
        exists(select 1 from public.organizations where slug = ${constants.organizationSlug}) as organization_exists,
        exists(select 1 from auth.users where lower(email) in (${email}, ${portalEmail})) as account_exists
    `;
    if (existing.organization_exists || existing.account_exists) {
      throw new Error(
        'Le tenant ou l’un des comptes existe déjà. La préparation est volontairement à usage unique ; utilisez une branche staging fraîche.',
      );
    }

    assets = await commercialDemoAssets(constants);
    for (const asset of assets) {
      const { error } = await storage.storage
        .from(asset.bucket)
        .upload(asset.path, asset.body, { contentType: 'image/png', upsert: false });
      if (error) throw error;
      uploadedAssets.push(asset);
    }

    const seedSql = await readFile(
      path.join(root, 'demo', 'fixtures', 'commercial-demo-staging.sql'),
      'utf8',
    );
    await sql.begin(async (transaction) => {
      await transaction`select set_config('rezo360.demo.project_ref', ${constants.stagingProjectRef}, true)`;
      await transaction`select set_config('rezo360.demo.email', ${email}, true)`;
      await transaction`select set_config('rezo360.demo.password', ${password}, true)`;
      await transaction`select set_config('rezo360.demo.portal_email', ${portalEmail}, true)`;
      await transaction`select set_config('rezo360.demo.portal_password', ${portalPassword}, true)`;
      await transaction`select set_config('rezo360.demo.signature_client', ${signatureDataUrl('Nadia Belkacem', '#1d4ed8')}, true)`;
      await transaction`select set_config('rezo360.demo.signature_technician', ${signatureDataUrl('Alex Martin', '#0f766e')}, true)`;
      await transaction.unsafe(seedSql);
    });

    const [verification] = await sql`
      select
        (select count(*)::int from public.customers where organization_id = ${constants.organizationId}) as customers,
        (select count(*)::int from public.missions where organization_id = ${constants.organizationId}) as missions,
        (select count(*)::int from public.intervention_reports where organization_id = ${constants.organizationId}) as reports,
        (select count(*)::int from public.quotes where organization_id = ${constants.organizationId}) as quotes,
        (select count(*)::int from public.invoices where organization_id = ${constants.organizationId}) as invoices,
        (select count(*)::int from public.stock_consumables where organization_id = ${constants.organizationId}) as stock_items
    `;
    if (
      verification.customers < 6 ||
      verification.missions < 10 ||
      verification.reports < 2 ||
      verification.quotes < 2 ||
      verification.invoices < 1 ||
      verification.stock_items < 8
    ) {
      throw new Error(`Vérification du dataset incomplète : ${JSON.stringify(verification)}`);
    }
    console.log(`Dataset vérifié : ${JSON.stringify(verification)}.`);
  } catch (error) {
    for (const bucket of new Set(uploadedAssets.map((asset) => asset.bucket))) {
      const paths = uploadedAssets
        .filter((asset) => asset.bucket === bucket)
        .map((asset) => asset.path);
      const { error: cleanupError } = await storage.storage.from(bucket).remove(paths);
      if (cleanupError)
        console.error(`Nettoyage Storage incomplet (${bucket}) : ${cleanupError.message}`);
    }
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
