import { describe, expect, it } from 'vitest';

import { compressImage, toJpegFileName } from './image-compression';

describe('image-compression', () => {
  it('laisse passer les fichiers non-images intacts', async () => {
    const pdfFile = new File(['%PDF-1.4...'], 'document.pdf', { type: 'application/pdf' });
    const result = await compressImage(pdfFile);
    expect(result).toBe(pdfFile);
  });

  it('laisse passer les SVG intacts', async () => {
    const svgFile = new File(['<svg></svg>'], 'image.svg', { type: 'image/svg+xml' });
    const result = await compressImage(svgFile);
    expect(result).toBe(svgFile);
  });

  it('laisse passer les petites images sous le seuil', async () => {
    const smallFile = new File(['small'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await compressImage(smallFile, { minSizeThreshold: 1000 });
    expect(result).toBe(smallFile);
  });
});

describe('toJpegFileName — le nom suit le contenu', () => {
  it('remplace l’extension d’origine', () => {
    // Le contenu réencodé est du JPEG : « photo.png » livrerait au technicien
    // un fichier que son système ouvrira de travers.
    expect(toJpegFileName('photo.png')).toBe('photo.jpg');
    expect(toJpegFileName('IMG_4021.HEIC')).toBe('IMG_4021.jpg');
  });

  it('préserve les points internes au nom', () => {
    expect(toJpegFileName('chantier.2026-08-19.webp')).toBe('chantier.2026-08-19.jpg');
  });

  it('ajoute une extension à un nom qui n’en a pas', () => {
    expect(toJpegFileName('capture')).toBe('capture.jpg');
  });

  it('n’ampute pas un nom qui commence par un point', () => {
    expect(toJpegFileName('.photo')).toBe('.photo.jpg');
  });
});
