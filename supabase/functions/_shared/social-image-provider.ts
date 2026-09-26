import { buildRezo360MarketingContext } from './social-marketing-context.ts';

export const SOCIAL_IMAGE_GENERATOR_VERSION = 'social-image-v2-zero-creation';
export const DEFAULT_SOCIAL_IMAGE_PROVIDER = 'mock';
export const DEFAULT_SOCIAL_IMAGE_MODEL = 'mock-social-image-background';
export const SOCIAL_FINAL_IMAGE_WIDTH = 1080;
export const SOCIAL_FINAL_IMAGE_HEIGHT = 1350;
export const SOCIAL_IMAGE_MAX_RENDER_ATTEMPTS = 3;

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const BRAND_BLUE: [number, number, number] = [27, 68, 200];

export type SocialVisualLayout =
  | 'typographic'
  | 'editorial'
  | 'field_photo'
  | 'abstract'
  | 'object_focus'
  | 'minimal'
  | 'split';

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

export interface SocialImagePromptInput {
  post: SocialImagePostContext;
  layout: SocialVisualLayout;
  width: number;
  height: number;
}

export interface SocialImagePrompt {
  prompt: string;
  negativePrompt: string;
  layout: SocialVisualLayout;
  promptChars: number;
}

export interface GeneratedSocialBackground {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  palette: {
    base: [number, number, number];
    accent: [number, number, number];
    ink: [number, number, number];
  };
  promptSummary: string;
}

export interface SocialImageGenerationInput {
  post: SocialImagePostContext;
  prompt: SocialImagePrompt;
}

export interface SocialRenderedImage {
  bytes: Uint8Array;
  mimeType: 'image/png';
  width: number;
  height: number;
  altText: string;
  originalFilename: string;
  render: {
    layout: SocialVisualLayout;
    fontSize: number;
    lineCount: number;
    attempts: number;
    safeZoneOk: boolean;
    contrastRatio: number;
  };
  promptSummary: string;
}

export interface SocialGeneratedImageVariant extends SocialRenderedImage {
  index: number;
}

export interface SocialImageUsage {
  generationCount: number;
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

export interface ImageGenerationProvider {
  readonly id: string;
  readonly model: string;
  generateBackground(input: SocialImageGenerationInput): Promise<{
    background: GeneratedSocialBackground;
    usage: SocialImageUsage;
    provider: string;
    model: string;
  }>;
}

export type SocialImageProvider = ImageGenerationProvider;

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

function encodePng(width: number, height: number, raw: Uint8Array): Uint8Array {
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

function luminance(color: readonly number[]) {
  const [r, g, b] = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(a: readonly number[], b: readonly number[]) {
  const bright = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (bright + 0.05) / (dark + 0.05);
}

function setPixel(raw: Uint8Array, width: number, x: number, y: number, color: readonly number[]) {
  if (x < 0 || y < 0 || x >= width || y >= Math.floor(raw.length / (width * 3 + 1))) return;
  const stride = width * 3 + 1;
  const offset = y * stride + 1 + x * 3;
  raw[offset] = color[0]!;
  raw[offset + 1] = color[1]!;
  raw[offset + 2] = color[2]!;
}

function fillRect(
  raw: Uint8Array,
  width: number,
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  color: readonly number[],
) {
  for (let yy = Math.max(0, y); yy < y + rectHeight; yy += 1) {
    for (let xx = Math.max(0, x); xx < x + rectWidth; xx += 1) setPixel(raw, width, xx, yy, color);
  }
}

function makeRaw(width: number, height: number, palette: GeneratedSocialBackground['palette'], layout: SocialVisualLayout) {
  const stride = width * 3 + 1;
  const raw = new Uint8Array(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x += 1) {
      const editorialLine = layout === 'editorial' && x % 120 < 4;
      const split = layout === 'split' && x > width * 0.58;
      const abstract = layout === 'abstract' && (x + y) % 67 < 9;
      const field = layout === 'field_photo' && y > height * 0.55 && (x * 3 + y) % 41 < 12;
      const useAccent = editorialLine || split || abstract || field;
      const color = useAccent ? palette.accent : palette.base;
      const offset = y * stride + 1 + x * 3;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
    }
  }
  return raw;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’]/g, "'")
    .trim()
    .toUpperCase();
}

const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '10000', '11110', '00001', '00001', '11110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '01100', '01000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
};

function charPattern(char: string) {
  return FONT[char] ?? ['00000', '00000', '11111', '00000', '11111', '00000', '00000'];
}

function measureLine(line: string, scale: number): number {
  return Array.from(line).reduce((sum, char) => sum + (char === ' ' ? 3 : 6) * scale, 0);
}

function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measureLine(next, scale) <= maxWidth || line.length === 0) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawText(raw: Uint8Array, width: number, x: number, y: number, lines: string[], scale: number, color: readonly number[]) {
  let cursorY = y;
  for (const line of lines) {
    let cursorX = x;
    for (const char of line) {
      if (char === ' ') {
        cursorX += 4 * scale;
        continue;
      }
      const pattern = charPattern(char);
      for (let row = 0; row < pattern.length; row += 1) {
        for (let col = 0; col < pattern[row]!.length; col += 1) {
          if (pattern[row]![col] === '1') {
            fillRect(raw, width, cursorX + col * scale, cursorY + row * scale, scale, scale, color);
          }
        }
      }
      cursorX += 6 * scale;
    }
    cursorY += 9 * scale;
  }
}

export class SocialImagePromptBuilder {
  build(input: SocialImagePromptInput): SocialImagePrompt {
    const prompt = [
      buildRezo360MarketingContext(),
      `FORMAT: ${input.width}x${input.height}, Instagram 4:5.`,
      `LAYOUT: ${input.layout}.`,
      `AUDIENCE: ${input.post.audience ?? 'entreprises de terrain'}.`,
      `OBJECTIVE: ${input.post.objective ?? 'notoriete et visites qualifiees'}.`,
      `VISUAL_CONCEPT: ${input.post.visualConcept}.`,
      'Créer uniquement un background/composition sans texte principal, sans logo, sans watermark.',
      'Ne pas inventer de fausse interface REZO360, dashboard, facture, planning ou application mobile.',
      'Rendu publicitaire editorial premium, sobre, professionnel, humain, terrain, pas AI SaaS ad.',
    ].join('\n');
    const negativePrompt = [
      'texte illisible',
      'logo invente',
      'watermark',
      'fausse interface produit',
      'dashboard fictif',
      'telephone flottant generique',
      'ouvriers absurdes',
      'EPI incoherents',
      'anatomie deformee',
      'style futuriste generique',
    ].join(', ');
    return { prompt, negativePrompt, layout: input.layout, promptChars: prompt.length + negativePrompt.length };
  }
}

export class SocialLayoutEngine {
  private readonly layouts: SocialVisualLayout[] = [
    'typographic',
    'editorial',
    'field_photo',
    'abstract',
    'object_focus',
    'minimal',
    'split',
  ];

  select(post: SocialImagePostContext): SocialVisualLayout {
    const text = `${post.visualConcept} ${post.objective ?? ''}`.toLowerCase();
    if (/terrain|chantier|intervention|technicien/.test(text)) return 'field_photo';
    if (/document|papier|administratif|facture|devis/.test(text)) return 'object_focus';
    if (/question|curiosite|interaction/.test(text)) return 'typographic';
    return this.layouts[(post.slotIndex - 1) % this.layouts.length]!;
  }
}

function paletteFor(layout: SocialVisualLayout, slotIndex: number): GeneratedSocialBackground['palette'] {
  const palettes: GeneratedSocialBackground['palette'][] = [
    { base: [246, 248, 252], accent: BRAND_BLUE, ink: [18, 24, 38] },
    { base: [250, 250, 248], accent: [38, 38, 38], ink: [16, 20, 28] },
    { base: [241, 247, 246], accent: [16, 99, 132], ink: [18, 34, 38] },
    { base: [248, 246, 242], accent: [148, 91, 62], ink: [24, 24, 24] },
  ];
  if (layout === 'minimal') return { base: [252, 252, 250], accent: BRAND_BLUE, ink: [12, 16, 24] };
  return palettes[(slotIndex - 1) % palettes.length]!;
}

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'mock';

  constructor(readonly model = DEFAULT_SOCIAL_IMAGE_MODEL) {}

  generateBackground(input: SocialImageGenerationInput) {
    const started = Date.now();
    const palette = paletteFor(input.prompt.layout, input.post.slotIndex);
    const raw = makeRaw(SOCIAL_FINAL_IMAGE_WIDTH, SOCIAL_FINAL_IMAGE_HEIGHT, palette, input.prompt.layout);
    return Promise.resolve({
      background: {
        bytes: encodePng(SOCIAL_FINAL_IMAGE_WIDTH, SOCIAL_FINAL_IMAGE_HEIGHT, raw),
        mimeType: 'image/png' as const,
        width: SOCIAL_FINAL_IMAGE_WIDTH,
        height: SOCIAL_FINAL_IMAGE_HEIGHT,
        palette,
        promptSummary: input.prompt.prompt,
      },
      usage: {
        generationCount: 1,
        promptChars: input.prompt.promptChars,
        estimatedCost: 0,
        latencyMs: Date.now() - started,
      },
      provider: this.id,
      model: this.model,
    });
  }
}

export const MockSocialImageProvider = MockImageGenerationProvider;

export class SocialVisualRenderer {
  render(input: {
    post: SocialImagePostContext;
    background: GeneratedSocialBackground;
    layout: SocialVisualLayout;
  }): SocialRenderedImage {
    const palette = input.background.palette;
    const contrast = contrastRatio(palette.base, palette.ink);
    let scale = this.initialScale(input.post.visualText);
    let attempts = 0;
    let lines: string[] = [];
    const safe = this.textBox(input.layout);

    while (attempts < SOCIAL_IMAGE_MAX_RENDER_ATTEMPTS) {
      attempts += 1;
      lines = wrapText(input.post.visualText, scale, safe.width);
      const textHeight = lines.length * 9 * scale;
      const maxLine = Math.max(...lines.map((line) => measureLine(line, scale)), 0);
      if (textHeight <= safe.height && maxLine <= safe.width && lines.length <= 4) break;
      scale = Math.max(8, scale - 3);
    }

    const raw = makeRaw(SOCIAL_FINAL_IMAGE_WIDTH, SOCIAL_FINAL_IMAGE_HEIGHT, palette, input.layout);
    const panel = [255, 255, 255, 222] as const;
    fillRect(raw, SOCIAL_FINAL_IMAGE_WIDTH, safe.x - 32, safe.y - 32, safe.width + 64, safe.height + 64, panel);
    drawText(raw, SOCIAL_FINAL_IMAGE_WIDTH, safe.x, safe.y, lines, scale, palette.ink);
    this.drawBrandMark(raw, input.layout, palette.accent);

    return {
      bytes: encodePng(SOCIAL_FINAL_IMAGE_WIDTH, SOCIAL_FINAL_IMAGE_HEIGHT, raw),
      mimeType: 'image/png',
      width: SOCIAL_FINAL_IMAGE_WIDTH,
      height: SOCIAL_FINAL_IMAGE_HEIGHT,
      altText: `Visuel REZO360 - ${input.post.visualText}`.slice(0, 180),
      originalFilename: `rezo360-social-${input.post.slotIndex}.png`,
      promptSummary: input.background.promptSummary,
      render: {
        layout: input.layout,
        fontSize: scale * 7,
        lineCount: lines.length,
        attempts,
        safeZoneOk: attempts <= SOCIAL_IMAGE_MAX_RENDER_ATTEMPTS,
        contrastRatio: Number(contrast.toFixed(2)),
      },
    };
  }

  private initialScale(text: string): number {
    const length = normalizeText(text).length;
    if (length <= 24) return 18;
    if (length <= 44) return 15;
    if (length <= 70) return 12;
    return 10;
  }

  private textBox(layout: SocialVisualLayout) {
    if (layout === 'split') return { x: 80, y: 250, width: 520, height: 620 };
    if (layout === 'minimal') return { x: 96, y: 340, width: 888, height: 520 };
    if (layout === 'field_photo') return { x: 80, y: 120, width: 860, height: 420 };
    if (layout === 'object_focus') return { x: 96, y: 720, width: 840, height: 360 };
    return { x: 86, y: 250, width: 860, height: 560 };
  }

  private drawBrandMark(raw: Uint8Array, layout: SocialVisualLayout, accent: readonly number[]) {
    const x = layout === 'field_photo' ? 80 : 850;
    const y = layout === 'object_focus' ? 90 : 1120;
    fillRect(raw, SOCIAL_FINAL_IMAGE_WIDTH, x, y, 148, 14, accent);
    fillRect(raw, SOCIAL_FINAL_IMAGE_WIDTH, x, y + 32, 88, 14, accent);
  }
}

export class VisualQualityCheck {
  validate(image: SocialRenderedImage): SocialRenderedImage {
    if (image.width !== SOCIAL_FINAL_IMAGE_WIDTH || image.height !== SOCIAL_FINAL_IMAGE_HEIGHT) {
      throw new SocialImageValidationError('Dimensions finales Instagram invalides.');
    }
    if (image.mimeType !== 'image/png') throw new SocialImageValidationError('Format final invalide.');
    if (image.bytes.byteLength === 0 || image.bytes.byteLength > 10 * 1024 * 1024) {
      throw new SocialImageValidationError('Taille du fichier final invalide.');
    }
    if (!image.render.safeZoneOk || image.render.lineCount > 4) {
      throw new SocialImageValidationError('Texte hors zone de securite.');
    }
    if (image.render.contrastRatio < 4.5) {
      throw new SocialImageValidationError('Contraste insuffisant pour le texte.');
    }
    return image;
  }
}

export async function generateRenderedSocialImage(input: {
  provider: ImageGenerationProvider;
  post: SocialImagePostContext;
}): Promise<SocialImageGenerationResult> {
  const started = Date.now();
  const layout = new SocialLayoutEngine().select(input.post);
  const prompt = new SocialImagePromptBuilder().build({
    post: input.post,
    layout,
    width: SOCIAL_FINAL_IMAGE_WIDTH,
    height: SOCIAL_FINAL_IMAGE_HEIGHT,
  });
  const background = await input.provider.generateBackground({ post: input.post, prompt });
  if (
    background.background.width !== SOCIAL_FINAL_IMAGE_WIDTH ||
    background.background.height !== SOCIAL_FINAL_IMAGE_HEIGHT ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(background.background.mimeType)
  ) {
    throw new SocialImageValidationError('Background provider invalide.', {
      usage: background.usage,
      provider: background.provider,
      model: background.model,
    });
  }
  const rendered = new VisualQualityCheck().validate(
    new SocialVisualRenderer().render({ post: input.post, background: background.background, layout }),
  );

  return validateSocialImageResult(
    {
      provider: background.provider,
      model: background.model,
      generatorVersion: SOCIAL_IMAGE_GENERATOR_VERSION,
      usage: {
        generationCount: background.usage.generationCount,
        promptChars: background.usage.promptChars,
        estimatedCost: background.usage.estimatedCost,
        latencyMs: Date.now() - started,
      },
      variants: [{ ...rendered, index: 1 }],
    },
    1,
  );
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
    if (variant.mimeType !== 'image/png') throw new SocialImageValidationError('Format image final invalide.', result);
    if (variant.width !== SOCIAL_FINAL_IMAGE_WIDTH || variant.height !== SOCIAL_FINAL_IMAGE_HEIGHT) {
      throw new SocialImageValidationError('Dimensions image finale invalides.', result);
    }
    if (variant.bytes.byteLength === 0 || variant.bytes.byteLength > 10 * 1024 * 1024) {
      throw new SocialImageValidationError('Taille image Social Studio invalide.', result);
    }
  }
  return result;
}

export function createConfiguredSocialImageProvider(env: {
  provider?: string | null;
  model?: string | null;
  allowMock?: string | null;
}): ImageGenerationProvider | null {
  const provider = env.provider?.trim().toLowerCase();
  if (!provider) return null;

  if (provider === 'mock') {
    if (env.allowMock?.trim().toLowerCase() !== 'true') return null;
    return new MockImageGenerationProvider(env.model?.trim() || DEFAULT_SOCIAL_IMAGE_MODEL);
  }

  throw new SocialImageProviderError('Social image provider non supporte.', 'unsupported_provider');
}
