import { createClient } from 'npm:@supabase/supabase-js@2.112.2';
// @ts-types="npm:@types/pdfkit@0.17.3"
import PDFDocument from 'npm:pdfkit@0.17.2';
import { preparerExportCii } from '../../../src/features/einvoicing/canonical/mapper.ts';
import { preparerTestFacturX } from '../../../src/features/einvoicing/canonical/test-preview.ts';
import type { InvoiceWithItems, Organization } from '../../../src/types/domain.ts';
import {
  FACTURX_GENERATOR_VERSION,
  FACTURX_PROFILE,
  renderFacturX,
} from '../_shared/facturx-render.ts';

const bucket = 'invoice-electronic-documents';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
const digest = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
const fonts = Promise.all([
  Deno.readFile(new URL('./assets/NotoSans-Regular.ttf', import.meta.url)),
  Deno.readFile(new URL('./assets/NotoSans-Bold.ttf', import.meta.url)),
]).then(([regular, bold]) => ({ regular, bold }));

export interface FacturXServiceConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  /** Tests isolate Auth, REST and Storage from live data through this transport. */
  fetch?: typeof fetch;
  now?: () => Date;
}

export function createFacturXHandler(config: FacturXServiceConfig) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    try {
      const authorization = request.headers.get('authorization') ?? '';
      if (!/^Bearer\s+\S+$/i.test(authorization))
        return json({ error: 'Connectez-vous pour télécharger la facture.' }, 401);
      if (Number(request.headers.get('content-length')) > 1024)
        return json({ error: 'Requête trop volumineuse.' }, 413);
      const raw = await request.text();
      if (raw.length > 1024) return json({ error: 'Requête trop volumineuse.' }, 413);
      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: 'Requête illisible.' }, 400);
      }
      const invoiceId = (body as { invoiceId?: unknown } | null)?.invoiceId;
      const mode = (body as { mode?: unknown } | null)?.mode;
      const expectedUpdatedAt = (body as { expectedUpdatedAt?: unknown } | null)?.expectedUpdatedAt;
      if (mode !== undefined && mode !== 'test')
        return json({ error: 'Mode de document invalide.' }, 400);
      if (mode === 'test' && typeof expectedUpdatedAt !== 'string')
        return json({ error: 'La version du brouillon est requise pour le mode test.' }, 400);
      if (
        typeof invoiceId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId)
      )
        return json({ error: 'Référence de facture invalide.' }, 400);
      const caller = createClient(config.url, config.anonKey, {
        global: { headers: { Authorization: authorization }, fetch: config.fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: auth, error: authError } = await caller.auth.getUser(
        authorization.replace(/^Bearer\s+/i, ''),
      );
      if (authError || !auth.user)
        return json({ error: 'Votre session a expiré. Reconnectez-vous.' }, 401);

      // Toujours vérifier les droits actuels avec la RLS, même pour un fichier existant.
      const { data: header, error: headerError } = await caller
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .maybeSingle();
      if (headerError)
        return json({ error: 'La facture ne peut pas être chargée pour le moment.' }, 503);
      if (!header) return json({ error: 'Facture introuvable ou inaccessible.' }, 404);
      // Test mode returns before creating any privileged client or accessing Storage.
      if (mode === 'test') {
        if (header.status !== 'draft')
          return json({ error: 'Le mode test est réservé aux brouillons.' }, 409);
        if (header.updated_at !== expectedUpdatedAt)
          return json(
            { error: 'Ce brouillon a changé. Actualisez-le avant de relancer le test.' },
            409,
          );
        const [items, totals, organization] = await Promise.all([
          caller
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('position')
            .order('id')
            .limit(501),
          caller.from('invoice_totals').select('*').eq('invoice_id', invoiceId).maybeSingle(),
          caller.from('organizations').select('*').eq('id', header.organization_id).maybeSingle(),
        ]);
        if (items.error || totals.error || organization.error)
          return json({ error: 'Les données du brouillon ne peuvent pas être vérifiées.' }, 503);
        if (!organization.data)
          return json({ error: 'Entreprise introuvable ou inaccessible.' }, 404);
        if (!items.data || items.data.length > 500)
          return json({ error: 'Le mode test prend en charge au maximum 500 lignes.' }, 422);
        const { data: latest, error: latestError } = await caller
          .from('invoices')
          .select('updated_at,status')
          .eq('id', invoiceId)
          .maybeSingle();
        if (latestError)
          return json({ error: 'La version du brouillon ne peut pas être vérifiée.' }, 503);
        if (!latest) return json({ error: 'Facture introuvable ou inaccessible.' }, 404);
        if (latest.status !== 'draft' || latest.updated_at !== header.updated_at)
          return json(
            { error: 'Ce brouillon a changé pendant la préparation. Actualisez-le et réessayez.' },
            409,
          );
        const simulatedAt = config.now?.() ?? new Date();
        const preparation = preparerTestFacturX(
          {
            ...header,
            items: items.data,
            totals: totals.data,
            vatBreakdown: [],
          } as InvoiceWithItems,
          organization.data as Organization,
          simulatedAt,
        );
        if (!preparation.invoice) return json({ error: preparation.issues.join(' · ') }, 422);
        try {
          const result = await renderFacturX(
            PDFDocument,
            preparation.invoice,
            await fonts,
            simulatedAt,
          );
          if (result.pdf.length > 5_000_000)
            return json({ error: 'Le PDF de test est trop volumineux.' }, 422);
          return new Response(new Uint8Array(result.pdf), {
            headers: {
              ...cors,
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="TEST-${invoiceId}-factur-x.pdf"`,
            },
          });
        } catch (error) {
          console.error(
            'facturx test render failed',
            error instanceof Error ? error.name : 'unknown',
          );
          return json(
            {
              error:
                error instanceof Error ? error.message : 'Le PDF de test n’a pas pu être préparé.',
            },
            422,
          );
        }
      }
      const admin = createClient(config.url, config.serviceRoleKey, {
        global: { fetch: config.fetch },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const table = admin.from('invoice_electronic_documents');
      const { data: existing, error: readError } = await table
        .select('*')
        .eq('invoice_id', invoiceId)
        .maybeSingle();
      if (readError)
        return json(
          { error: 'La conservation des documents est temporairement indisponible.' },
          503,
        );
      async function ready(document: {
        object_path: string;
        pdf_sha256: string;
        byte_size: number;
        generated_at: string;
        generator_version: string;
      }) {
        // Un lien signé court, accordé seulement après lecture autorisée de la facture.
        const { data, error } = await caller.storage
          .from(bucket)
          .createSignedUrl(document.object_path, 60);
        if (error || !data)
          return json(
            { error: 'Le document conservé est temporairement indisponible. Réessayez.' },
            503,
          );
        return json({
          url: data.signedUrl,
          sha256: document.pdf_sha256,
          byteSize: document.byte_size,
          generatedAt: document.generated_at,
          generatorVersion: document.generator_version,
        });
      }
      if (existing) return await ready(existing);

      const [itemsResult, totalsResult] = await Promise.all([
        caller
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', invoiceId)
          .order('position')
          .order('id')
          .limit(501),
        caller.from('invoice_totals').select('*').eq('invoice_id', invoiceId).maybeSingle(),
      ]);
      if (itemsResult.error || totalsResult.error)
        return json({ error: 'Les montants de la facture ne peuvent pas être vérifiés.' }, 503);
      if (!itemsResult.data || itemsResult.data.length > 500)
        return json({ error: 'Factur-X prend en charge au maximum 500 lignes par facture.' }, 422);
      const invoice = {
        ...header,
        items: itemsResult.data,
        totals: totalsResult.data,
        vatBreakdown: [],
      } as InvoiceWithItems;
      const preparation = preparerExportCii(invoice);
      if (!preparation.invoice) return json({ error: preparation.issues.join(' · ') }, 422);
      let result: Awaited<ReturnType<typeof renderFacturX>>;
      try {
        // Date stable : une reprise après interruption reproduit les mêmes octets.
        result = await renderFacturX(
          PDFDocument,
          preparation.invoice,
          await fonts,
          new Date(invoice.issued_at!),
        );
      } catch (error) {
        console.error('facturx render failed', error instanceof Error ? error.name : 'unknown');
        return json(
          { error: error instanceof Error ? error.message : 'Le PDF n’a pas pu être préparé.' },
          422,
        );
      }
      const pdfHash = await digest(result.pdf);
      const xmlHash = await digest(new TextEncoder().encode(result.xml));
      const objectPath = `${header.organization_id}/${invoiceId}/factur-x.pdf`;
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(objectPath, result.pdf, {
          contentType: 'application/pdf',
          upsert: false,
          cacheControl: '0',
        });
      if (uploadError) {
        // Double clic, concurrent ou reprise : ne jamais remplacer un fichier existant.
        const { data: concurrent } = await table
          .select('*')
          .eq('invoice_id', invoiceId)
          .maybeSingle();
        if (concurrent) return await ready(concurrent);
        const { data: stored, error: downloadError } = await admin.storage
          .from(bucket)
          .download(objectPath);
        if (
          downloadError ||
          !stored ||
          (await digest(new Uint8Array(await stored.arrayBuffer()))) !== pdfHash
        )
          return json(
            {
              error:
                'Le document n’a pas pu être conservé. Réessayez ; aucun fichier existant n’a été remplacé.',
            },
            503,
          );
      }
      const document = {
        invoice_id: invoiceId,
        organization_id: header.organization_id,
        format: 'factur_x',
        profile: FACTURX_PROFILE,
        generator_version: FACTURX_GENERATOR_VERSION,
        object_path: objectPath,
        xml_sha256: xmlHash,
        pdf_sha256: pdfHash,
        byte_size: result.pdf.length,
      };
      const { data: inserted, error: insertError } = await table
        .insert(document)
        .select('*')
        .single();
      if (insertError) {
        const { data: concurrent } = await table
          .select('*')
          .eq('invoice_id', invoiceId)
          .maybeSingle();
        if (concurrent) return await ready(concurrent);
        return json(
          { error: 'Le document est en cours de conservation. Réessayez dans quelques instants.' },
          503,
        );
      }
      return await ready(inserted);
    } catch (error) {
      console.error('facturx request failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Le téléchargement est temporairement indisponible. Réessayez.' }, 503);
    }
  };
}
