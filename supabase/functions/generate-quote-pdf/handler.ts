import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.112.2';
// @ts-types="npm:@types/pdfkit@0.17.3"
import PDFDocument from 'npm:pdfkit@0.17.2';

import {
  QUOTE_PDF_GENERATOR_VERSION,
  renderQuotePdf,
  type QuotePdfInput,
  type QuotePdfOrganization,
} from '../_shared/quote-pdf-render.ts';

/**
 * Finalise un brouillon au moment de son premier PDF, puis renvoie un lien
 * signé. Le changement `draft -> sent` est conditionné par `updated_at` : une
 * édition concurrente ne peut donc jamais produire un PDF périmé. Le PDF est
 * rendu avant de figer le devis, mais n'est téléversé qu'après la transition.
 *
 * Idempotent et concurrent-safe : deux appels simultanés (double clic, deux
 * onglets) ne créent jamais deux fichiers ni deux lignes.
 */

const BUCKET = 'quote-documents';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

async function digest(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

export interface QuotePdfServiceConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  fetch?: typeof fetch;
  now?: () => Date;
}

const DEFAULT_PAYMENT_TERMS = 'Paiement à 30 jours à compter de la réception.';
const DEFAULT_PAYMENT_METHOD = 'Virement bancaire / Carte bancaire Pro.';

export function createQuotePdfHandler(config: QuotePdfServiceConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

    try {
      const authorization = request.headers.get('authorization') ?? '';
      if (!/^Bearer\s+\S+$/i.test(authorization)) {
        return json({ error: 'Connectez-vous pour préparer le devis.' }, 401);
      }
      let body: unknown;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json({ error: 'Requête illisible.' }, 400);
      }
      const quoteId = (body as { quoteId?: unknown } | null)?.quoteId;
      if (typeof quoteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(quoteId)) {
        return json({ error: 'Référence de devis invalide.' }, 400);
      }

      const caller: SupabaseClient = createClient(config.url, config.anonKey, {
        global: { headers: { Authorization: authorization }, fetch: config.fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: auth, error: authError } = await caller.auth.getUser(
        authorization.replace(/^Bearer\s+/i, ''),
      );
      if (authError || !auth.user)
        return json({ error: 'Votre session a expiré. Reconnectez-vous.' }, 401);

      const { data: quote, error: quoteError } = await caller
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();
      if (quoteError)
        return json({ error: 'Le devis ne peut pas être chargé pour le moment.' }, 503);
      if (!quote) return json({ error: 'Devis introuvable ou inaccessible.' }, 404);
      const admin: SupabaseClient = createClient(config.url, config.serviceRoleKey, {
        global: { fetch: config.fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const table = admin.from('quote_documents');

      async function finalizeDraft(): Promise<Response | null> {
        if (quote.status !== 'draft') return null;
        const { data, error } = await caller
          .from('quotes')
          .update({ status: 'sent' })
          .eq('id', quoteId)
          .eq('status', 'draft')
          .eq('updated_at', quote.updated_at)
          .select('id,status')
          .maybeSingle();
        if (error) {
          return json(
            { error: "Vous n'avez pas l'autorisation d'envoyer ce devis." },
            error.code === '42501' ? 403 : 503,
          );
        }
        if (!data) {
          return json(
            {
              error:
                'Le devis a changé pendant la préparation du PDF. Relisez-le puis recommencez.',
            },
            409,
          );
        }
        return null;
      }

      async function ready(doc: {
        object_path: string;
        pdf_sha256: string;
        byte_size: number;
        generated_at: string;
      }) {
        const { data, error } = await caller.storage
          .from(BUCKET)
          .createSignedUrl(doc.object_path, 60);
        if (error || !data) {
          return json(
            { error: 'Le document conservé est temporairement indisponible. Réessayez.' },
            503,
          );
        }
        return json({
          url: data.signedUrl,
          sha256: doc.pdf_sha256,
          byteSize: doc.byte_size,
          generatedAt: doc.generated_at,
        });
      }

      const { data: existing, error: readError } = await table
        .select('*')
        .eq('quote_id', quoteId)
        .maybeSingle();
      if (readError)
        return json(
          { error: 'La conservation des documents est temporairement indisponible.' },
          503,
        );
      if (existing) {
        const finalizationError = await finalizeDraft();
        if (finalizationError) return finalizationError;
        return await ready(existing);
      }

      const [itemsResult, organizationResult] = await Promise.all([
        caller
          .from('quote_items')
          .select('*')
          .eq('quote_id', quoteId)
          .order('position')
          .order('id')
          .limit(501),
        caller.from('organizations').select('*').eq('id', quote.organization_id).maybeSingle(),
      ]);
      if (itemsResult.error || organizationResult.error) {
        return json({ error: 'Les données du devis ne peuvent pas être vérifiées.' }, 503);
      }
      if (!itemsResult.data || itemsResult.data.length === 0 || itemsResult.data.length > 500) {
        return json({ error: 'Le devis doit comporter entre 1 et 500 lignes.' }, 422);
      }
      if (!organizationResult.data)
        return json({ error: 'Entreprise introuvable ou inaccessible.' }, 404);

      const customerResult = quote.customer_id
        ? await caller.from('customers').select('*').eq('id', quote.customer_id).maybeSingle()
        : { data: null, error: null };
      if (customerResult.error) {
        return json({ error: 'Les coordonnées du client ne peuvent pas être vérifiées.' }, 503);
      }

      const org = organizationResult.data;
      const organization: QuotePdfOrganization = {
        name: org.name,
        legal_name: org.legal_name,
        address_line1: org.address_line1,
        address_line2: org.address_line2,
        postal_code: org.postal_code,
        city: org.city,
        country: org.country,
        registration_number: org.registration_number,
        vat_number: org.vat_number,
        email: org.email,
        phone: org.phone,
        iban: org.iban,
        bic: org.bic,
      };

      let logoBytes: Uint8Array | null = null;
      const logoPrefix = `${config.url.replace(/\/$/, '')}/storage/v1/object/public/organization-branding/`;
      if (typeof org.logo_url === 'string' && org.logo_url.startsWith(logoPrefix)) {
        const logoPath = decodeURIComponent(org.logo_url.slice(logoPrefix.length));
        if (logoPath.startsWith(`${quote.organization_id}/`)) {
          const { data: logo } = await admin.storage
            .from('organization-branding')
            .download(logoPath);
          if (logo && logo.size <= 2 * 1024 * 1024) {
            logoBytes = new Uint8Array(await logo.arrayBuffer());
          }
        }
      }

      const vatRate = Number(quote.vat_rate);
      const items = (itemsResult.data as Array<Record<string, unknown>>).map((it) => {
        const quantity = Number(it.quantity);
        const unitPriceCents = Number(it.unit_price_cents);
        return {
          description: String(it.description),
          unit: String(it.unit),
          quantity,
          unit_price_cents: unitPriceCents,
          line_total_cents: Math.round(quantity * unitPriceCents),
        };
      });
      const grossSubtotalCents = items.reduce((sum, it) => sum + it.line_total_cents, 0);
      const discountCents = Math.round(
        grossSubtotalCents * (Number(quote.discount_rate ?? 0) / 100),
      );
      const subtotalCents = grossSubtotalCents - discountCents;
      const vatCents = Math.round(subtotalCents * (vatRate / 100));
      const totalCents = Math.round(subtotalCents * (1 + vatRate / 100));

      const input: QuotePdfInput = {
        reference: quote.reference,
        title: quote.title,
        customer_name: quote.customer_name,
        site_name: quote.site_name,
        notes: quote.notes,
        valid_until: quote.valid_until,
        issue_date: quote.issue_date ?? String(quote.created_at).slice(0, 10),
        customer_address: customerResult.data
          ? [
              [customerResult.data.address_line1, customerResult.data.address_line2]
                .filter(Boolean)
                .join(' '),
              [customerResult.data.postal_code, customerResult.data.city].filter(Boolean).join(' '),
              customerResult.data.country,
            ].filter((line): line is string => Boolean(line))
          : [],
        customer_registration_number: customerResult.data?.registration_number ?? null,
        customer_vat_number: customerResult.data?.vat_number ?? null,
        document_options:
          quote.document_options &&
          typeof quote.document_options === 'object' &&
          !Array.isArray(quote.document_options)
            ? (quote.document_options as QuotePdfInput['document_options'])
            : null,
        vat_rate: vatRate,
        gross_subtotal_cents: grossSubtotalCents,
        discount_cents: discountCents,
        subtotal_cents: subtotalCents,
        vat_cents: vatCents,
        total_cents: totalCents,
        payment_terms: (org.quote_payment_terms as string | null)?.trim() || DEFAULT_PAYMENT_TERMS,
        payment_method:
          (org.quote_payment_method as string | null)?.trim() || DEFAULT_PAYMENT_METHOD,
        items,
      };

      let pdf: Uint8Array;
      try {
        pdf = await renderQuotePdf(
          PDFDocument,
          input,
          organization,
          config.now?.() ?? new Date(),
          logoBytes,
        );
      } catch (error) {
        console.error('quote pdf render failed', error instanceof Error ? error.name : 'unknown');
        return json(
          { error: error instanceof Error ? error.message : 'Le PDF n’a pas pu être préparé.' },
          422,
        );
      }

      const finalizationError = await finalizeDraft();
      if (finalizationError) return finalizationError;

      const pdfHash = await digest(pdf);
      const objectPath = `${quote.organization_id}/${quoteId}/devis.pdf`;
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(objectPath, pdf, {
        contentType: 'application/pdf',
        upsert: false,
        cacheControl: '0',
      });
      if (uploadError) {
        // Double clic, concurrent ou reprise : ne jamais remplacer un fichier existant.
        const { data: concurrent } = await table.select('*').eq('quote_id', quoteId).maybeSingle();
        if (concurrent) return await ready(concurrent);
        const { data: stored, error: downloadError } = await admin.storage
          .from(BUCKET)
          .download(objectPath);
        if (
          downloadError ||
          !stored ||
          (await digest(new Uint8Array(await stored.arrayBuffer()))) !== pdfHash
        ) {
          return json(
            {
              error:
                'Le document n’a pas pu être conservé. Réessayez ; aucun fichier existant n’a été remplacé.',
            },
            503,
          );
        }
      }

      const document = {
        quote_id: quoteId,
        organization_id: quote.organization_id,
        generator_version: QUOTE_PDF_GENERATOR_VERSION,
        object_path: objectPath,
        pdf_sha256: pdfHash,
        byte_size: pdf.length,
      };
      const { data: inserted, error: insertError } = await table
        .insert(document)
        .select('*')
        .single();
      if (insertError) {
        const { data: concurrent } = await table.select('*').eq('quote_id', quoteId).maybeSingle();
        if (concurrent) return await ready(concurrent);
        return json(
          { error: 'Le document est en cours de conservation. Réessayez dans quelques instants.' },
          503,
        );
      }
      return await ready(inserted);
    } catch (error) {
      console.error('quote pdf request failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Le téléchargement est temporairement indisponible. Réessayez.' }, 503);
    }
  };
}
