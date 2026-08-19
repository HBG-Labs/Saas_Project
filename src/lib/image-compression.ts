/**
 * Compression d'images côté client pour REZO360.
 *
 * Conçu pour optimiser les photos d'interventions prises sur le terrain
 * par les techniciens (souvent 5 à 15 Mo sur smartphone) avant l'envoi
 * vers Supabase Storage, afin d'accélérer l'upload même en zone 3G/4G faible.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** Seuil minimal en octets sous lequel la compression n'est pas nécessaire (défaut: 500 Ko) */
  minSizeThreshold?: number;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  minSizeThreshold: 500 * 1024,
};

/**
 * Remplace l'extension d'un nom de fichier par `.jpg`.
 *
 * Un nom sans extension en reçoit une ; un nom qui commence par un point
 * (« .photo ») n'est pas amputé de sa partie visible.
 */
export function toJpegFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot <= 0) {
    return `${name}.jpg`;
  }
  return `${name.slice(0, lastDot)}.jpg`;
}

/**
 * Compresse une image si nécessaire tout en conservant son ratio d'aspect.
 * Les fichiers non-images (PDF, docs) ou déjà légers sont renvoyés sans modification.
 */
export async function compressImage(file: File, options?: CompressionOptions): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Pas de compression pour les fichiers non-images ou SVG
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  // Si le fichier est déjà inférieur au seuil, on l'envoie directement
  if (file.size <= opts.minSizeThreshold) {
    return file;
  }

  // Environnement sans DOM / Canvas (ex: tests Node ou environnement headless)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Calcul des dimensions cibles avec préservation du ratio
      if (width > opts.maxWidth || height > opts.maxHeight) {
        if (width / height > opts.maxWidth / opts.maxHeight) {
          height = Math.round((height * opts.maxWidth) / width);
          width = opts.maxWidth;
        } else {
          width = Math.round((width * opts.maxHeight) / height);
          height = opts.maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Dessin avec lissage haute qualité
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Si le résultat est plus lourd que l'original, on garde l'original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          // Le contenu est désormais du JPEG : garder « photo.png » stockerait
          // un fichier dont l'extension ment. L'affichage s'en remet au
          // `contentType`, mais le fichier téléchargé, lui, porte son nom.
          const compressedFile = new File([blob], toJpegFileName(file.name), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        },
        'image/jpeg',
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
