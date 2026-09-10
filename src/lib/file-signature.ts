/**
 * Validation légère du contenu réel avant un dépôt Storage.
 *
 * Le type MIME d'un `File` est fourni par le navigateur et peut être falsifié.
 * Les buckets Supabase le contrôlent à nouveau, mais ils voient eux aussi le
 * type déclaré par la requête. Cette vérification des octets bloque les
 * déguisements les plus courants avant qu'ils n'atteignent le réseau.
 */

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function commencePar(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((octet, index) => bytes[index] === octet);
}

async function lire(fragment: Blob): Promise<Uint8Array> {
  if (typeof fragment.arrayBuffer === 'function') {
    return new Uint8Array(await fragment.arrayBuffer());
  }

  return await new Promise<Uint8Array>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(lecteur.error ?? new Error('Lecture du fichier impossible.'));
    lecteur.onload = () => resolve(new Uint8Array(lecteur.result as ArrayBuffer));
    lecteur.readAsArrayBuffer(fragment);
  });
}

function estZip(bytes: Uint8Array): boolean {
  return (
    commencePar(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    commencePar(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
    commencePar(bytes, [0x50, 0x4b, 0x07, 0x08])
  );
}

async function contientStructureOffice(file: File, dossier: 'word/' | 'xl/'): Promise<boolean> {
  // Les noms du répertoire central ZIP sont placés en fin d'archive et ne sont
  // pas compressés. Lire les 256 derniers Kio évite de charger 25 Mio en mémoire.
  const debut = Math.max(0, file.size - 256 * 1024);
  const fin = await lire(file.slice(debut));
  const texte = new TextDecoder('latin1').decode(fin);
  return texte.includes('[Content_Types].xml') && texte.includes(dossier);
}

function estWebp(bytes: Uint8Array): boolean {
  return (
    commencePar(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function estHeic(bytes: Uint8Array): boolean {
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return false;
  }
  const marque = String.fromCharCode(...bytes.slice(8, 12));
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(marque);
}

/**
 * Lève une erreur compréhensible si les premiers octets ne correspondent pas
 * au type déclaré. Les types inconnus restent refusés par défaut.
 */
export async function assertFileSignature(file: File): Promise<void> {
  if (file.size === 0) {
    throw new Error('Le fichier est vide.');
  }

  const entete = await lire(file.slice(0, 4096));
  let valide = false;

  switch (file.type) {
    case 'application/pdf':
      valide = commencePar(entete, PDF);
      break;
    case 'image/jpeg':
      valide = commencePar(entete, JPEG);
      break;
    case 'image/png':
      valide = commencePar(entete, PNG);
      break;
    case 'image/webp':
      valide = estWebp(entete);
      break;
    case 'image/heic':
      valide = estHeic(entete);
      break;
    case 'application/msword':
    case 'application/vnd.ms-excel':
      valide = commencePar(entete, OLE);
      break;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      valide = estZip(entete) && (await contientStructureOffice(file, 'word/'));
      break;
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      valide = estZip(entete) && (await contientStructureOffice(file, 'xl/'));
      break;
    case 'text/plain':
    case 'text/csv':
      // Un octet NUL est un indicateur fiable d'un binaire déguisé en texte.
      valide = !entete.includes(0);
      break;
  }

  if (!valide) {
    throw new Error(
      'Le contenu du fichier ne correspond pas à son format déclaré. Vérifiez le fichier avant de réessayer.',
    );
  }
}
