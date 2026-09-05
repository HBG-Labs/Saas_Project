import { z } from 'zod';
import { messageDeLaFonction, supabase } from '@/services/supabase';
import { env } from '@/config/env';

const documentSchema = z.object({
  url: z.url(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().positive().max(5_000_000),
  generatedAt: z.string(),
  generatorVersion: z.string(),
});

/** Direct, ephemeral PDF response. No signed Storage URL or definitive emission. */
export async function downloadTestFacturX(
  invoiceId: string,
  expectedUpdatedAt: string,
): Promise<Blob> {
  const response = await supabase.functions.invoke<unknown>('generate-facturx', {
    body: { invoiceId, mode: 'test', expectedUpdatedAt },
  });
  const error: unknown = response.error;
  const data: unknown = response.data;
  if (error)
    throw new Error(
      await messageDeLaFonction(error, 'Le PDF de test n’a pas pu être préparé. Réessayez.'),
    );
  if (
    !(data instanceof Blob) ||
    data.type !== 'application/pdf' ||
    data.size < 5 ||
    data.size > 5_000_000
  )
    throw new Error('Le service n’a pas retourné un PDF de test valide.');
  return data;
}

/** Seul l'identifiant est transmis. Le serveur relit la facture et ses droits. */
export async function downloadFacturX(invoiceId: string): Promise<Blob> {
  const responseFromServer = await supabase.functions.invoke<unknown>('generate-facturx', {
    body: { invoiceId },
  });
  const error: unknown = responseFromServer.error;
  const data: unknown = responseFromServer.data;
  if (error)
    throw new Error(
      await messageDeLaFonction(error, 'Le PDF Factur-X n’a pas pu être préparé. Réessayez.'),
    );
  const parsed = documentSchema.safeParse(data);
  if (!parsed.success)
    throw new Error('La réponse du service de documents est incomplète. Réessayez.');
  const document = parsed.data;
  const url = new URL(document.url);
  if (
    url.origin !== new URL(env.VITE_SUPABASE_URL).origin ||
    !url.pathname.includes('/storage/v1/object/sign/invoice-electronic-documents/')
  )
    throw new Error('Le lien de téléchargement est invalide.');
  const response = await fetch(url, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
  if (!response.ok)
    throw new Error(
      'Le lien a expiré ou le document est indisponible. Relancez le téléchargement.',
    );
  const bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
  if (bytes.byteLength !== document.byteSize || hash !== document.sha256)
    throw new Error('L’intégrité du fichier téléchargé n’a pas pu être confirmée. Réessayez.');
  return new Blob([bytes], { type: 'application/pdf' });
}
