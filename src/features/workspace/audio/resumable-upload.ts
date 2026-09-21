import { Upload, type UploadOptions } from 'tus-js-client';

import { env } from '@/config/env';
import { supabase } from '@/services/supabase';

/**
 * Envoi reprenable vers Supabase Storage (protocole TUS, endpoint
 * `/storage/v1/upload/resumable`), avec `tus-js-client`.
 *
 * Ce que ça change par rapport à `storage.from().upload()` : le fichier part
 * par tranches de 6 Mo (la taille exigée par Supabase), chaque tranche est
 * acquittée, et l'URL d'envoi rendue par le serveur permet de REPRENDRE
 * après une coupure là où on s'était arrêté — en la gardant dans le stockage
 * local avec l'enregistrement. Les règles du bucket s'appliquent comme pour
 * un envoi simple : le fichier n'est accepté que si la ligne
 * `workspace_recordings` de la session existe déjà.
 */

export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

export interface ResumableUploadParams {
  bucket: string;
  path: string;
  blob: Blob;
  contentType: string;
  /** URL d'envoi d'une tentative précédente : reprise. */
  uploadUrl?: string | undefined;
  onUploadUrl?: (url: string) => void;
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}

/** Le jeton de la session : l'envoi est fait au nom de la personne, la RLS s'applique. */
async function jetonSession(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token)
    throw new Error('Session absente : reconnectez-vous pour envoyer l’enregistrement.');
  return token;
}

/**
 * Injectable pour les tests : par défaut, `tus-js-client`. Résout à la fin de
 * l'envoi, rejette sur échec après les reprises internes (les délais de
 * `retryDelays` couvrent les micro-coupures ; une coupure longue rejette et
 * l'appelant réessaiera plus tard avec `uploadUrl`).
 */
export type ResumableUploader = (params: ResumableUploadParams) => Promise<void>;

export const uploadResumable: ResumableUploader = async (params) => {
  const token = await jetonSession();
  await new Promise<void>((resolve, reject) => {
    const options: UploadOptions = {
      endpoint: `${env.VITE_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: params.bucket,
        objectName: params.path,
        contentType: params.contentType,
        cacheControl: '3600',
      },
      chunkSize: TUS_CHUNK_SIZE,
      ...(params.uploadUrl ? { uploadUrl: params.uploadUrl } : {}),
      onProgress: (sent, total) => params.onProgress?.(sent, total),
      onSuccess: () => resolve(),
      onError: (error) => reject(error instanceof Error ? error : new Error(String(error))),
    };
    const upload = new Upload(params.blob, options);
    params.signal?.addEventListener('abort', () => {
      void upload.abort();
      reject(new Error('Envoi annulé.'));
    });
    void upload.findPreviousUploads().then((previous) => {
      const reprise = previous[0];
      if (reprise && !params.uploadUrl) upload.resumeFromPreviousUpload(reprise);
      upload.start();
      // L'URL est connue après la création côté serveur : on la remonte dès
      // qu'elle existe pour que la reprise soit possible après un rechargement.
      const surveiller = window.setInterval(() => {
        if (upload.url) {
          params.onUploadUrl?.(upload.url);
          window.clearInterval(surveiller);
        }
      }, 250);
    });
  });
};
