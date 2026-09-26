import { buildRezo360MarketingContext } from './social-marketing-context.ts';

export const SOCIAL_IMAGE_GENERATOR_VERSION = 'social-image-v1';
export const DEFAULT_SOCIAL_IMAGE_PROVIDER = 'mock';
export const DEFAULT_SOCIAL_IMAGE_MODEL = 'mock-social-image';
export const DEFAULT_SOCIAL_IMAGE_VARIANT_COUNT = 3;

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MOCK_SIZE = 512;

export interface SocialImagePostContext {
  organizationId: string;
  postId: string;
  slotIndex: number;
  hook: string;
  visualText: string;
  visualConcept: string;
  caption: string;
  cta: string | null;
  objective: string | null;
  audience: string | null;
}

export interface SocialImageGenerationInput {
  post: SocialImagePostContext;
  variantCount: number;
}

export interface SocialGeneratedImageVariant {
  index: number;
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  altText: string;
  originalFilename: string;
  promptSummary: string;
}

export interface SocialImageUsage {
  variantCount: number;
  promptChars: number;
  estimatedCost: number | null;
  latencyMs: number;
}

export interface SocialImageGenerationResult {
  provider: string;
  model: string;
  generatorVersion: string;
  usage: SocialImageUsage;
  variants: SocialGeneratedImageVariant[];
}

export interface SocialImageProvider {
  readonly id: string;
  readonly model: string;
  generatePostImages(input: SocialImageGenerationInput): Promise<SocialImageGenerationResult>;
}

export class SocialImageProviderError extends Error {
  constructor(message: string, readonly code = 'provider_error') {
    super(message);
    this.name = 'SocialImageProviderError';
  }
}

export class SocialImageValidationError extends Error {
  constructor(message: string, readonly result?: Pick<SocialImageGenerationResult, 'usage' | 'provider' | 'model'>) {
    super(message);
    this.name = 'SocialImageValidationError';
  }
}

function crcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function ascii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = ascii(type);
  const crcInput = concat([typeBytes, data]);
  return concat([u32(data.length), typeBytes, data, u32(crc32(crcInput))]);
}

function zlibStored(bytes: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  let offset = 0;
  while (offset < bytes.length) {
    const size = Math.min(65_535, bytes.length - offset);
    const final = offset + size >= bytes.length;
    const header = new Uint8Array(5);
    header[0] = final ? 1 : 0;
    header[1] = size & 0xff;
    header[2] = (size >>> 8) & 0xff;
    const inverted = (~size) & 0xffff;
    header[3] = inverted & 0xff;
    header[4] = (inverted >>> 8) & 0xff;
    blocks.push(header, bytes.slice(offset, offset + size));
    offset += size;
  }
  blocks.push(u32(adler32(bytes)));
  return concat(blocks);
}

function mockPng(width: number, height: number, colors: { base: number[]; accent: number[] }): Uint8Array {
  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const useAccent = (x + y) % 37 < 8 || Math.abs(x - y) < 6;
      const color = useAccent ? colors.accent : colors.base;
      const offset = row + 1 + x * 3;
      raw[offset] = color[0]!;
      raw[offset + 1] = color[1]!;
      raw[offset + 2] = color[2]!;
    }
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlibStored(raw)),
    chunk('IEND', new Uint8Array()),
  ]);
}

function promptSummary(input: SocialImageGenerationInput): string {
  return [
    buildRezo360MarketingContext(),
    `HOOK: ${input.post.hook}`,
    `VISUAL_TEXT: ${input.post.visualText}`,
    `VISUAL_CONCEPT: ${input.post.visualConcept}`,
    `OBJECTIVE: ${input.post.objective ?? 'non renseigne'}`,
    `AUDIENCE: ${input.post.audience ?? 'non renseignee'}`,
    'CONSTRAINTS: image Instagram carree, peu de texte, style professionnel REZO360, pas de faux chiffres.',
  ].join('\n');
}

export function validateSocialImageResult(
  result: SocialImageGenerationResult,
  expectedVariantCount: number,
): SocialImageGenerationResult {
  if (result.variants.length !== expectedVariantCount) {
    throw new SocialImageValidationError(
      'Le provider visuel doit retourner exactement le nombre de variantes demande.',
      result,
    );
  }
  for (const variant of result.variants) {
    if (variant.index < 1 || variant.index > expectedVariantCount) {
      throw new SocialImageValidationError('Index de variante visuelle invalide.', result);
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(variant.mimeType)) {
      throw new SocialImageValidationError('Format image Social Studio invalide.', result);
    }
    if (variant.bytes.byteLength === 0 || variant.bytes.byteLength > 10 * 1024 * 1024) {
      throw new SocialImageValidationError('Taille image Social Studio invalide.', result);
    }
    if (variant.width <= 0 || variant.height <= 0) {
      throw new SocialImageValidationError('Dimensions image Social Studio invalides.', result);
    }
  }
  return result;
}

export class MockSocialImageProvider implements SocialImageProvider {
  readonly id = 'mock';

  constructor(readonly model = DEFAULT_SOCIAL_IMAGE_MODEL) {}

  async generatePostImages(input: SocialImageGenerationInput): Promise<SocialImageGenerationResult> {
    const started = Date.now();
    const prompt = promptSummary(input);
    const palettes = [
      { base: [244, 247, 255], accent: [27, 68, 200] },
      { base: [247, 248, 250], accent: [16, 99, 132] },
      { base: [250, 250, 248], accent: [38, 38, 38] },
    ];

    const variants = Array.from({ length: input.variantCount }, (_, index) => {
      const variantIndex = index + 1;
      return {
        index: variantIndex,
        bytes: mockPng(MOCK_SIZE, MOCK_SIZE, palettes[index % palettes.length]!),
        mimeType: 'image/png' as const,
        width: MOCK_SIZE,
        height: MOCK_SIZE,
        altText: `Visuel Social Studio REZO360 ${variantIndex} - ${input.post.visualText}`.slice(0, 180),
        originalFilename: `social-studio-${input.post.slotIndex}-variant-${variantIndex}.png`,
        promptSummary: prompt,
      };
    });

    const result: SocialImageGenerationResult = {
      provider: this.id,
      model: this.model,
      generatorVersion: SOCIAL_IMAGE_GENERATOR_VERSION,
      usage: {
        variantCount: variants.length,
        promptChars: prompt.length,
        estimatedCost: 0,
        latencyMs: Date.now() - started,
      },
      variants,
    };
    return validateSocialImageResult(result, input.variantCount);
  }
}

export function createConfiguredSocialImageProvider(env: {
  provider?: string | null;
  model?: string | null;
  allowMock?: string | null;
}): SocialImageProvider | null {
  const provider = env.provider?.trim().toLowerCase();
  if (!provider) return null;

  if (provider === 'mock') {
    if (env.allowMock?.trim().toLowerCase() !== 'true') return null;
    return new MockSocialImageProvider(env.model?.trim() || DEFAULT_SOCIAL_IMAGE_MODEL);
  }

  throw new SocialImageProviderError('Social image provider non supporte.', 'unsupported_provider');
}
