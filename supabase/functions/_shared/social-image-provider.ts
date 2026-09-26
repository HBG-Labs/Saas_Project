import { buildRezo360MarketingContext } from './social-marketing-context.ts';

export const SOCIAL_IMAGE_GENERATOR_VERSION = 'social-image-v3-agency-renderer';
export const DEFAULT_SOCIAL_IMAGE_PROVIDER = 'mock';
export const DEFAULT_SOCIAL_IMAGE_MODEL = 'mock-social-image-background';
export const DEFAULT_OPENAI_SOCIAL_IMAGE_MODEL = 'gpt-image-2.5-flare';
export const DEFAULT_SOCIAL_IMAGE_QUALITY = 'medium';
export const SOCIAL_FINAL_IMAGE_WIDTH = 1080;
export const SOCIAL_FINAL_IMAGE_HEIGHT = 1350;
export const SOCIAL_PROVIDER_IMAGE_WIDTH = 1024;
export const SOCIAL_PROVIDER_IMAGE_HEIGHT = 1536;
export const SOCIAL_IMAGE_MAX_RENDER_ATTEMPTS = 8;
export const SOCIAL_IMAGE_MIN_READABLE_FONT_SIZE = 48;
export const SOCIAL_IMAGE_PROVIDER_TIMEOUT_MS = 60_000;

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const BRAND_BLUE: Rgb = [27, 68, 200];
const BRAND_NIGHT: Rgb = [10, 27, 67];
const PAPER: Rgb = [250, 251, 253];
const INK: Rgb = [18, 24, 38];
const WHITE: Rgb = [255, 255, 255];
const OUTPUT_FORMAT = 'png';

type Rgb = [number, number, number];

export const SOCIAL_VISUAL_LAYOUTS = [
  'TYPOGRAPHIC_HERO',
  'EDITORIAL_LEFT',
  'EDITORIAL_CENTER',
  'SPLIT_VISUAL',
  'FULL_BLEED_VISUAL',
  'MINIMAL_OBJECT',
  'ABSTRACT_CAMPAIGN',
] as const;

export type SocialVisualLayout = (typeof SOCIAL_VISUAL_LAYOUTS)[number];
export type SocialImageQuality = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto';

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
  quality?: SocialImageQuality;
}

export interface SocialImagePrompt {
  prompt: string;
  negativePrompt: string;
  layout: SocialVisualLayout;
  promptChars: number;
  providerSize: `${number}x${number}`;
  outputFormat: typeof OUTPUT_FORMAT;
}

export interface GeneratedSocialBackground {
  bytes: Uint8Array;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
  palette: {
    base: Rgb;
    accent: Rgb;
    ink: Rgb;
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
    fontFamily: 'Nunito' | 'IBM Plex Sans Variable';
    fontSize: number;
    minFontSize: number;
    lineHeight: number;
    lineCount: number;
    attempts: number;
    textBox: Box;
    visualBox: Box;
    logoBox: Box;
    safeZoneOk: boolean;
    contrastRatio: number;
    crop: CropResult;
    renderMs: number;
    fileSizeBytes: number;
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

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutSpec {
  id: SocialVisualLayout;
  textBox: Box;
  visualBox: Box;
  logoPlacement: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  alignment: 'left' | 'center';
  maxLines: number;
  idealFontSize: number;
  textColor: Rgb;
  panel: 'none' | 'soft' | 'solid' | 'glass' | 'blue';
  accent: 'bar' | 'rule' | 'frame' | 'dot' | 'none';
  overlay: 'none' | 'vignette' | 'light-panel' | 'blue-wash';
}

interface TextFit {
  lines: string[];
  fontSize: number;
  scale: number;
  lineHeight: number;
  attempts: number;
  overflow: boolean;
  width: number;
  height: number;
}

interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8Array;
}

interface CropResult {
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  cropX: number;
  cropY: number;
}

type Fetcher = typeof fetch;

export class SocialImageProviderError extends Error {
  constructor(message: string, readonly code = 'provider_error') {
    super(message);
    this.name = 'SocialImageProviderError';
  }
}

export class SocialImageValidationError extends Error {
  constructor(
    message: string,
    readonly result?: Pick<SocialImageGenerationResult, 'usage' | 'provider' | 'model'>,
    readonly code = 'invalid_response',
  ) {
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

function pixelBufferToRaw(buffer: PixelBuffer): Uint8Array {
  const stride = buffer.width * 3 + 1;
  const raw = new Uint8Array(stride * buffer.height);
  for (let y = 0; y < buffer.height; y += 1) {
    raw[y * stride] = 0;
    raw.set(buffer.data.slice(y * buffer.width * 3, (y + 1) * buffer.width * 3), y * stride + 1);
  }
  return raw;
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

function encodePngFromPixels(buffer: PixelBuffer): Uint8Array {
  return encodePng(buffer.width, buffer.height, pixelBufferToRaw(buffer));
}

function readU32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
}

async function inflateZlib(bytes: Uint8Array): Promise<Uint8Array> {
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export async function decodePng(bytes: Uint8Array): Promise<PixelBuffer> {
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new SocialImageValidationError('PNG invalide.', undefined, 'invalid_png');
  }

  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];

  while (offset < bytes.length) {
    const length = readU32(bytes, offset);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = readU32(data, 0);
      height = readU32(data, 4);
      bitDepth = data[8]!;
      colorType = data[9]!;
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || ![0, 2, 6].includes(colorType) || width <= 0 || height <= 0) {
    throw new SocialImageValidationError('PNG non supporte par le renderer.', undefined, 'unsupported_png');
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const inflated = await inflateZlib(concat(idat));
  const stride = width * bpp;
  const result = new Uint8Array(width * height * 3);
  let sourceOffset = 0;
  let previous = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset]!;
    sourceOffset += 1;
    const row = inflated.slice(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    const unfiltered = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? unfiltered[x - bpp]! : 0;
      const up = previous[x] ?? 0;
      const upperLeft = x >= bpp ? previous[x - bpp]! : 0;
      const raw = row[x]!;
      if (filter === 0) unfiltered[x] = raw;
      else if (filter === 1) unfiltered[x] = (raw + left) & 0xff;
      else if (filter === 2) unfiltered[x] = (raw + up) & 0xff;
      else if (filter === 3) unfiltered[x] = (raw + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) unfiltered[x] = (raw + paeth(left, up, upperLeft)) & 0xff;
      else throw new SocialImageValidationError('Filtre PNG non supporte.', undefined, 'unsupported_png_filter');
    }

    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 3;
      const src = x * bpp;
      if (colorType === 0) {
        result[out] = unfiltered[src]!;
        result[out + 1] = unfiltered[src]!;
        result[out + 2] = unfiltered[src]!;
      } else if (colorType === 2) {
        result[out] = unfiltered[src]!;
        result[out + 1] = unfiltered[src + 1]!;
        result[out + 2] = unfiltered[src + 2]!;
      } else {
        const alpha = unfiltered[src + 3]! / 255;
        result[out] = Math.round(unfiltered[src]! * alpha + 255 * (1 - alpha));
        result[out + 1] = Math.round(unfiltered[src + 1]! * alpha + 255 * (1 - alpha));
        result[out + 2] = Math.round(unfiltered[src + 2]! * alpha + 255 * (1 - alpha));
      }
    }
    previous = unfiltered;
  }

  return { width, height, data: result };
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

function mix(a: readonly number[], b: readonly number[], amount: number): Rgb {
  return [
    Math.round(a[0]! * (1 - amount) + b[0]! * amount),
    Math.round(a[1]! * (1 - amount) + b[1]! * amount),
    Math.round(a[2]! * (1 - amount) + b[2]! * amount),
  ];
}

function averagePalette(buffer: PixelBuffer, fallbackAccent: Rgb): GeneratedSocialBackground['palette'] {
  let r = 0;
  let g = 0;
  let b = 0;
  const step = Math.max(1, Math.floor(buffer.width * buffer.height / 8000));
  let count = 0;
  for (let pixel = 0; pixel < buffer.width * buffer.height; pixel += step) {
    const offset = pixel * 3;
    r += buffer.data[offset]!;
    g += buffer.data[offset + 1]!;
    b += buffer.data[offset + 2]!;
    count += 1;
  }
  const base = [Math.round(r / count), Math.round(g / count), Math.round(b / count)] as Rgb;
  const ink = contrastRatio(base, INK) >= 4.5 ? INK : WHITE;
  return { base, accent: fallbackAccent, ink };
}

function setPixel(buffer: PixelBuffer, x: number, y: number, color: readonly number[]) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return;
  const offset = (y * buffer.width + x) * 3;
  buffer.data[offset] = color[0]!;
  buffer.data[offset + 1] = color[1]!;
  buffer.data[offset + 2] = color[2]!;
}

function getPixel(buffer: PixelBuffer, x: number, y: number): Rgb {
  const clampedX = Math.max(0, Math.min(buffer.width - 1, x));
  const clampedY = Math.max(0, Math.min(buffer.height - 1, y));
  const offset = (clampedY * buffer.width + clampedX) * 3;
  return [buffer.data[offset]!, buffer.data[offset + 1]!, buffer.data[offset + 2]!];
}

function blendPixel(buffer: PixelBuffer, x: number, y: number, color: readonly number[], alpha: number) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return;
  const offset = (y * buffer.width + x) * 3;
  buffer.data[offset] = Math.round(buffer.data[offset]! * (1 - alpha) + color[0]! * alpha);
  buffer.data[offset + 1] = Math.round(buffer.data[offset + 1]! * (1 - alpha) + color[1]! * alpha);
  buffer.data[offset + 2] = Math.round(buffer.data[offset + 2]! * (1 - alpha) + color[2]! * alpha);
}

function fillRect(buffer: PixelBuffer, box: Box, color: readonly number[], alpha = 1) {
  const startX = Math.max(0, Math.floor(box.x));
  const endX = Math.min(buffer.width, Math.ceil(box.x + box.width));
  const startY = Math.max(0, Math.floor(box.y));
  const endY = Math.min(buffer.height, Math.ceil(box.y + box.height));
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (alpha >= 1) setPixel(buffer, x, y, color);
      else blendPixel(buffer, x, y, color, alpha);
    }
  }
}

function strokeRect(buffer: PixelBuffer, box: Box, color: readonly number[], thickness: number, alpha = 1) {
  fillRect(buffer, { x: box.x, y: box.y, width: box.width, height: thickness }, color, alpha);
  fillRect(buffer, { x: box.x, y: box.y + box.height - thickness, width: box.width, height: thickness }, color, alpha);
  fillRect(buffer, { x: box.x, y: box.y, width: thickness, height: box.height }, color, alpha);
  fillRect(buffer, { x: box.x + box.width - thickness, y: box.y, width: thickness, height: box.height }, color, alpha);
}

function fillCircle(buffer: PixelBuffer, cx: number, cy: number, radius: number, color: readonly number[], alpha = 1) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= cy + radius; y += 1) {
    for (let x = Math.floor(cx - radius); x <= cx + radius; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
        if (alpha >= 1) setPixel(buffer, x, y, color);
        else blendPixel(buffer, x, y, color, alpha);
      }
    }
  }
}

function resizeCover(source: PixelBuffer, width: number, height: number, focusX = 0.5, focusY = 0.5): { buffer: PixelBuffer; crop: CropResult } {
  const scale = Math.max(width / source.width, height / source.height);
  const scaledWidth = source.width * scale;
  const scaledHeight = source.height * scale;
  const cropX = Math.max(0, Math.min(scaledWidth - width, (scaledWidth - width) * focusX));
  const cropY = Math.max(0, Math.min(scaledHeight - height, (scaledHeight - height) * focusY));
  const output: PixelBuffer = { width, height, data: new Uint8Array(width * height * 3) };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = (x + cropX) / scale;
      const sy = (y + cropY) / scale;
      setPixel(output, x, y, getPixel(source, Math.round(sx), Math.round(sy)));
    }
  }
  return { buffer: output, crop: { sourceWidth: source.width, sourceHeight: source.height, scale, cropX, cropY } };
}

function makeMockBackground(width: number, height: number, palette: GeneratedSocialBackground['palette'], layout: SocialVisualLayout): PixelBuffer {
  const buffer: PixelBuffer = { width, height, data: new Uint8Array(width * height * 3) };
  const softBlue = mix(palette.base, BRAND_BLUE, 0.08);
  const warm = mix(palette.base, [235, 223, 205], 0.35);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const gx = x / width;
      const gy = y / height;
      let color = mix(palette.base, softBlue, gx * 0.4 + gy * 0.24);
      if (layout === 'ABSTRACT_CAMPAIGN' && (x + y) % 71 < 14) color = mix(color, palette.accent, 0.12);
      if (layout === 'FULL_BLEED_VISUAL' && y > height * 0.58) color = mix(color, [72, 88, 112], 0.24);
      if (layout === 'MINIMAL_OBJECT' && x > width * 0.55 && y > height * 0.45) color = mix(color, warm, 0.42);
      if (layout === 'SPLIT_VISUAL' && x > width * 0.55) color = mix(color, palette.accent, 0.18);
      setPixel(buffer, x, y, color);
    }
  }

  if (layout === 'MINIMAL_OBJECT') {
    fillRect(buffer, { x: width * 0.56, y: height * 0.52, width: width * 0.28, height: height * 0.18 }, WHITE, 0.74);
    strokeRect(buffer, { x: width * 0.56, y: height * 0.52, width: width * 0.28, height: height * 0.18 }, palette.accent, 6, 0.52);
  }
  if (layout === 'ABSTRACT_CAMPAIGN') {
    fillCircle(buffer, width * 0.78, height * 0.22, width * 0.16, palette.accent, 0.18);
    fillCircle(buffer, width * 0.16, height * 0.78, width * 0.11, BRAND_NIGHT, 0.09);
  }
  if (layout === 'FULL_BLEED_VISUAL' || layout === 'SPLIT_VISUAL') {
    fillRect(buffer, { x: 0, y: height * 0.68, width, height: height * 0.32 }, [70, 82, 90], 0.16);
    fillRect(buffer, { x: width * 0.12, y: height * 0.62, width: width * 0.26, height: height * 0.08 }, [54, 60, 66], 0.18);
    fillCircle(buffer, width * 0.26, height * 0.6, width * 0.055, [52, 58, 64], 0.16);
  }
  return buffer;
}

function normalizeDisplayText(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('fr-FR');
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
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
};

function baseChar(char: string) {
  return char.normalize('NFD').replace(/\p{Diacritic}/gu, '')[0]?.toLocaleUpperCase('fr-FR') ?? char;
}

function accentOf(char: string): string | null {
  const mark = char.normalize('NFD').match(/\p{Diacritic}/u)?.[0];
  if (!mark) return null;
  if (mark === '\u0301') return 'acute';
  if (mark === '\u0300') return 'grave';
  if (mark === '\u0302') return 'circumflex';
  if (mark === '\u0308') return 'diaeresis';
  if (mark === '\u0327') return 'cedilla';
  return null;
}

function charPattern(char: string) {
  return FONT[baseChar(char)] ?? ['00000', '00000', '11111', '00000', '11111', '00000', '00000'];
}

function charAdvance(char: string, scale: number) {
  if (char === ' ') return 3.8 * scale;
  if (char === '.' || char === ',' || char === "'") return 3.6 * scale;
  return 6.6 * scale;
}

function measureLine(line: string, scale: number): number {
  return Array.from(line).reduce((sum, char) => sum + charAdvance(char, scale), 0);
}

function splitLongWord(word: string, scale: number, maxWidth: number): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const char of Array.from(word)) {
    const next = `${chunk}${char}`;
    if (chunk && measureLine(next, scale) > maxWidth) {
      chunks.push(chunk);
      chunk = char;
    } else {
      chunk = next;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapText(text: string, scale: number, maxWidth: number): string[] {
  const words = normalizeDisplayText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const pieces = measureLine(word, scale) > maxWidth ? splitLongWord(word, scale, maxWidth) : [word];
    for (const piece of pieces) {
      const next = line ? `${line} ${piece}` : piece;
      if (measureLine(next, scale) <= maxWidth || line.length === 0) {
        line = next;
      } else {
        lines.push(line);
        line = piece;
      }
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(text: string, spec: LayoutSpec): TextFit {
  let fontSize = spec.idealFontSize;
  let attempts = 0;
  let lines: string[] = [];
  let scale = fontSize / 7;
  let lineHeight = Math.round(fontSize * 1.06);
  let width = 0;
  let height = 0;
  while (attempts < SOCIAL_IMAGE_MAX_RENDER_ATTEMPTS) {
    attempts += 1;
    scale = fontSize / 7;
    lineHeight = Math.round(fontSize * 1.06);
    lines = wrapText(text, scale, spec.textBox.width);
    width = Math.max(...lines.map((line) => measureLine(line, scale)), 0);
    height = lines.length * lineHeight;
    if (
      lines.length <= spec.maxLines &&
      width <= spec.textBox.width &&
      height <= spec.textBox.height &&
      fontSize >= SOCIAL_IMAGE_MIN_READABLE_FONT_SIZE
    ) {
      return { lines, fontSize, scale, lineHeight, attempts, overflow: false, width, height };
    }
    fontSize -= attempts <= 3 ? 10 : 6;
  }
  return {
    lines,
    fontSize,
    scale,
    lineHeight,
    attempts,
    overflow:
      lines.length > spec.maxLines ||
      width > spec.textBox.width ||
      height > spec.textBox.height ||
      fontSize < SOCIAL_IMAGE_MIN_READABLE_FONT_SIZE,
    width,
    height,
  };
}

function drawGlyph(
  buffer: PixelBuffer,
  char: string,
  x: number,
  y: number,
  scale: number,
  color: readonly number[],
  weight = 1,
) {
  const pattern = charPattern(char);
  const accent = accentOf(char);
  const roundedScale = Math.max(2, Math.round(scale));
  if (accent === 'acute') fillRect(buffer, { x: x + roundedScale * 3, y: y - roundedScale * 1.8, width: roundedScale * 2, height: roundedScale }, color);
  if (accent === 'grave') fillRect(buffer, { x: x + roundedScale, y: y - roundedScale * 1.8, width: roundedScale * 2, height: roundedScale }, color);
  if (accent === 'circumflex') {
    fillRect(buffer, { x: x + roundedScale, y: y - roundedScale * 1.8, width: roundedScale, height: roundedScale }, color);
    fillRect(buffer, { x: x + roundedScale * 3, y: y - roundedScale * 1.8, width: roundedScale, height: roundedScale }, color);
  }
  if (accent === 'diaeresis') {
    fillRect(buffer, { x: x + roundedScale, y: y - roundedScale * 1.8, width: roundedScale, height: roundedScale }, color);
    fillRect(buffer, { x: x + roundedScale * 4, y: y - roundedScale * 1.8, width: roundedScale, height: roundedScale }, color);
  }
  for (let row = 0; row < pattern.length; row += 1) {
    for (let col = 0; col < pattern[row]!.length; col += 1) {
      if (pattern[row]![col] === '1') {
        fillRect(
          buffer,
          {
            x: Math.round(x + col * scale),
            y: Math.round(y + row * scale),
            width: Math.ceil(scale + weight),
            height: Math.ceil(scale + weight),
          },
          color,
        );
      }
    }
  }
  if (accent === 'cedilla') {
    fillRect(buffer, { x: x + roundedScale * 2, y: y + roundedScale * 7.4, width: roundedScale * 2, height: roundedScale }, color);
  }
}

function drawTextLine(
  buffer: PixelBuffer,
  line: string,
  x: number,
  y: number,
  scale: number,
  color: readonly number[],
  weight = 1,
) {
  let cursor = x;
  for (const char of Array.from(line)) {
    if (char !== ' ') drawGlyph(buffer, char, cursor, y, scale, color, weight);
    cursor += charAdvance(char, scale);
  }
}

function drawTextBlock(buffer: PixelBuffer, lines: string[], box: Box, fit: TextFit, alignment: 'left' | 'center', color: readonly number[]) {
  const totalHeight = lines.length * fit.lineHeight;
  let y = Math.round(box.y + Math.max(0, (box.height - totalHeight) / 2));
  for (const line of lines) {
    const width = measureLine(line, fit.scale);
    const x = alignment === 'center' ? Math.round(box.x + (box.width - width) / 2) : box.x;
    drawTextLine(buffer, line, x, y, fit.scale, color, fit.fontSize >= 82 ? 2 : 1);
    y += fit.lineHeight;
  }
}

function drawLogo(buffer: PixelBuffer, box: Box, textColor: readonly number[]) {
  const scale = box.height / 8;
  drawTextLine(buffer, 'REZO', box.x, box.y, scale, textColor, 1);
  drawTextLine(buffer, '360', box.x + 4 * 6.6 * scale + 7, box.y, scale, BRAND_BLUE, 1);
}

function layoutSpec(layout: SocialVisualLayout): LayoutSpec {
  const specs: Record<SocialVisualLayout, LayoutSpec> = {
    TYPOGRAPHIC_HERO: {
      id: layout,
      textBox: { x: 92, y: 310, width: 896, height: 500 },
      visualBox: { x: 72, y: 120, width: 936, height: 1110 },
      logoPlacement: 'bottom-left',
      alignment: 'left',
      maxLines: 3,
      idealFontSize: 104,
      textColor: INK,
      panel: 'solid',
      accent: 'bar',
      overlay: 'light-panel',
    },
    EDITORIAL_LEFT: {
      id: layout,
      textBox: { x: 90, y: 260, width: 610, height: 560 },
      visualBox: { x: 650, y: 130, width: 360, height: 880 },
      logoPlacement: 'top-left',
      alignment: 'left',
      maxLines: 4,
      idealFontSize: 84,
      textColor: INK,
      panel: 'soft',
      accent: 'rule',
      overlay: 'light-panel',
    },
    EDITORIAL_CENTER: {
      id: layout,
      textBox: { x: 116, y: 315, width: 848, height: 480 },
      visualBox: { x: 82, y: 142, width: 916, height: 1040 },
      logoPlacement: 'top-right',
      alignment: 'center',
      maxLines: 3,
      idealFontSize: 90,
      textColor: INK,
      panel: 'glass',
      accent: 'dot',
      overlay: 'vignette',
    },
    SPLIT_VISUAL: {
      id: layout,
      textBox: { x: 82, y: 280, width: 470, height: 610 },
      visualBox: { x: 585, y: 0, width: 495, height: 1350 },
      logoPlacement: 'bottom-left',
      alignment: 'left',
      maxLines: 4,
      idealFontSize: 76,
      textColor: INK,
      panel: 'solid',
      accent: 'frame',
      overlay: 'none',
    },
    FULL_BLEED_VISUAL: {
      id: layout,
      textBox: { x: 84, y: 720, width: 850, height: 390 },
      visualBox: { x: 0, y: 0, width: 1080, height: 1350 },
      logoPlacement: 'top-left',
      alignment: 'left',
      maxLines: 3,
      idealFontSize: 78,
      textColor: WHITE,
      panel: 'blue',
      accent: 'none',
      overlay: 'vignette',
    },
    MINIMAL_OBJECT: {
      id: layout,
      textBox: { x: 92, y: 730, width: 820, height: 340 },
      visualBox: { x: 92, y: 150, width: 820, height: 530 },
      logoPlacement: 'top-left',
      alignment: 'left',
      maxLines: 3,
      idealFontSize: 76,
      textColor: INK,
      panel: 'none',
      accent: 'rule',
      overlay: 'light-panel',
    },
    ABSTRACT_CAMPAIGN: {
      id: layout,
      textBox: { x: 110, y: 360, width: 780, height: 460 },
      visualBox: { x: 70, y: 120, width: 940, height: 1060 },
      logoPlacement: 'bottom-right',
      alignment: 'center',
      maxLines: 3,
      idealFontSize: 88,
      textColor: INK,
      panel: 'glass',
      accent: 'dot',
      overlay: 'blue-wash',
    },
  };
  return specs[layout];
}

function logoBoxFor(placement: LayoutSpec['logoPlacement']): Box {
  const width = 188;
  const height = 34;
  const margin = 72;
  if (placement === 'top-left') return { x: margin, y: margin, width, height };
  if (placement === 'top-right') return { x: SOCIAL_FINAL_IMAGE_WIDTH - margin - width, y: margin, width, height };
  if (placement === 'bottom-right') {
    return { x: SOCIAL_FINAL_IMAGE_WIDTH - margin - width, y: SOCIAL_FINAL_IMAGE_HEIGHT - margin - height, width, height };
  }
  return { x: margin, y: SOCIAL_FINAL_IMAGE_HEIGHT - margin - height, width, height };
}

function applyOverlay(buffer: PixelBuffer, spec: LayoutSpec) {
  if (spec.overlay === 'vignette') {
    for (let y = 0; y < buffer.height; y += 1) {
      const top = y / buffer.height;
      const alpha = top < 0.22 ? (0.22 - top) * 0.35 : top > 0.63 ? (top - 0.63) * 0.95 : 0;
      if (alpha <= 0) continue;
      for (let x = 0; x < buffer.width; x += 1) blendPixel(buffer, x, y, INK, Math.min(0.42, alpha));
    }
  }
  if (spec.overlay === 'light-panel') {
    fillRect(buffer, spec.visualBox, WHITE, 0.12);
  }
  if (spec.overlay === 'blue-wash') {
    fillCircle(buffer, 850, 260, 230, BRAND_BLUE, 0.12);
    fillCircle(buffer, 160, 1050, 160, BRAND_NIGHT, 0.08);
  }
}

function drawPanel(buffer: PixelBuffer, spec: LayoutSpec) {
  const box = {
    x: spec.textBox.x - 36,
    y: spec.textBox.y - 34,
    width: spec.textBox.width + 72,
    height: spec.textBox.height + 68,
  };
  if (spec.panel === 'solid') fillRect(buffer, box, WHITE, 0.92);
  if (spec.panel === 'soft') fillRect(buffer, box, PAPER, 0.8);
  if (spec.panel === 'glass') fillRect(buffer, box, WHITE, 0.72);
  if (spec.panel === 'blue') fillRect(buffer, box, BRAND_NIGHT, 0.84);
}

function drawAccent(buffer: PixelBuffer, spec: LayoutSpec, accent: readonly number[]) {
  if (spec.accent === 'bar') fillRect(buffer, { x: spec.textBox.x, y: spec.textBox.y - 58, width: 150, height: 12 }, accent);
  if (spec.accent === 'rule') fillRect(buffer, { x: spec.textBox.x, y: spec.textBox.y - 34, width: spec.textBox.width * 0.62, height: 5 }, accent, 0.8);
  if (spec.accent === 'frame') strokeRect(buffer, spec.visualBox, accent, 10, 0.55);
  if (spec.accent === 'dot') fillCircle(buffer, spec.textBox.x + spec.textBox.width / 2, spec.textBox.y - 50, 12, accent, 0.85);
}

function focusFor(layout: SocialVisualLayout): [number, number] {
  if (layout === 'EDITORIAL_LEFT') return [0.68, 0.48];
  if (layout === 'SPLIT_VISUAL') return [0.72, 0.5];
  if (layout === 'FULL_BLEED_VISUAL') return [0.5, 0.48];
  if (layout === 'MINIMAL_OBJECT') return [0.58, 0.42];
  return [0.5, 0.5];
}

function validateBackgroundDimensions(background: GeneratedSocialBackground) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(background.mimeType)) {
    throw new SocialImageValidationError('Format background provider invalide.', undefined, 'invalid_background_format');
  }
  if (background.width < 640 || background.height < 640 || background.width > 4096 || background.height > 4096) {
    throw new SocialImageValidationError('Dimensions background provider invalides.', undefined, 'invalid_background_dimensions');
  }
  if (background.mimeType !== 'image/png') {
    throw new SocialImageValidationError('Le renderer final requiert un background PNG decodable.', undefined, 'background_requires_png');
  }
}

export class SocialImagePromptBuilder {
  build(input: SocialImagePromptInput): SocialImagePrompt {
    const prompt = [
      buildRezo360MarketingContext(),
      `FORMAT: portrait Instagram 4:5, provider target ${SOCIAL_PROVIDER_IMAGE_WIDTH}x${SOCIAL_PROVIDER_IMAGE_HEIGHT}, final render ${input.width}x${input.height}.`,
      `LAYOUT_FAMILY: ${input.layout}.`,
      `AUDIENCE: ${input.post.audience ?? 'entreprises de terrain'}.`,
      `OBJECTIVE: ${input.post.objective ?? 'notoriete et visites qualifiees'}.`,
      `VISUAL_CONCEPT: ${input.post.visualConcept}.`,
      'Create the background, scene, material, object composition or abstract campaign visual only.',
      'Do not generate the main headline text, captions, logo, watermark, fake app screen, fake dashboard, fake invoice, fake planning UI or fake REZO360 product interface.',
      'Leave deliberate negative space where the renderer can place typography. Premium editorial social ad, sober, professional, human, field-service credible, not a generic AI SaaS ad.',
      'If people are present, make them realistic field professionals with coherent tools and PPE.',
    ].join('\n');
    const negativePrompt = [
      'main text',
      'misspelled typography',
      'invented REZO360 logo',
      'watermark',
      'fake product interface',
      'fictional dashboard',
      'generic floating phone',
      'incoherent PPE',
      'deformed hands',
      'corporate stock pose',
      'futuristic SaaS glow',
    ].join(', ');
    return {
      prompt,
      negativePrompt,
      layout: input.layout,
      promptChars: prompt.length + negativePrompt.length,
      providerSize: `${SOCIAL_PROVIDER_IMAGE_WIDTH}x${SOCIAL_PROVIDER_IMAGE_HEIGHT}`,
      outputFormat: OUTPUT_FORMAT,
    };
  }
}

export class SocialLayoutEngine {
  select(post: SocialImagePostContext, recentLayouts: SocialVisualLayout[] = []): SocialVisualLayout {
    const text = `${post.visualConcept} ${post.objective ?? ''} ${post.audience ?? ''}`.toLowerCase();
    const candidates: SocialVisualLayout[] = [];
    if (/terrain|chantier|intervention|technicien|camion|equipe/.test(text)) candidates.push('FULL_BLEED_VISUAL', 'SPLIT_VISUAL');
    if (/document|papier|administratif|facture|devis|compte rendu/.test(text)) candidates.push('MINIMAL_OBJECT', 'EDITORIAL_LEFT');
    if (/question|curiosite|interaction|whatsapp|encore/.test(text)) candidates.push('TYPOGRAPHIC_HERO', 'EDITORIAL_CENTER');
    if (/vision|marque|notoriete|centralisation/.test(text)) candidates.push('ABSTRACT_CAMPAIGN', 'EDITORIAL_CENTER');
    candidates.push(SOCIAL_VISUAL_LAYOUTS[(post.slotIndex - 1) % SOCIAL_VISUAL_LAYOUTS.length]!);
    candidates.push(...SOCIAL_VISUAL_LAYOUTS);

    for (const candidate of candidates) {
      const lastTwo = recentLayouts.slice(-2);
      if (!lastTwo.includes(candidate)) return candidate;
    }
    return candidates[0]!;
  }
}

function paletteFor(layout: SocialVisualLayout, slotIndex: number): GeneratedSocialBackground['palette'] {
  const palettes: GeneratedSocialBackground['palette'][] = [
    { base: [246, 248, 252], accent: BRAND_BLUE, ink: INK },
    { base: [250, 250, 248], accent: [39, 45, 58], ink: [16, 20, 28] },
    { base: [241, 247, 246], accent: [16, 99, 132], ink: [18, 34, 38] },
    { base: [248, 246, 242], accent: [148, 91, 62], ink: [24, 24, 24] },
  ];
  if (layout === 'ABSTRACT_CAMPAIGN') return { base: [245, 248, 255], accent: BRAND_BLUE, ink: BRAND_NIGHT };
  if (layout === 'FULL_BLEED_VISUAL') return { base: [52, 62, 75], accent: BRAND_BLUE, ink: WHITE };
  return palettes[(slotIndex - 1) % palettes.length]!;
}

export class MockImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'mock';

  constructor(readonly model = DEFAULT_SOCIAL_IMAGE_MODEL) {}

  generateBackground(input: SocialImageGenerationInput) {
    const started = Date.now();
    const palette = paletteFor(input.prompt.layout, input.post.slotIndex);
    const background = makeMockBackground(SOCIAL_PROVIDER_IMAGE_WIDTH, SOCIAL_PROVIDER_IMAGE_HEIGHT, palette, input.prompt.layout);
    return Promise.resolve({
      background: {
        bytes: encodePngFromPixels(background),
        mimeType: 'image/png' as const,
        width: SOCIAL_PROVIDER_IMAGE_WIDTH,
        height: SOCIAL_PROVIDER_IMAGE_HEIGHT,
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

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly id = 'openai';
  readonly model: string;

  constructor(
    private readonly options: {
      apiKey: string;
      model?: string;
      quality?: SocialImageQuality;
      timeoutMs?: number;
      fetcher?: Fetcher;
    },
  ) {
    this.model = options.model?.trim() || DEFAULT_OPENAI_SOCIAL_IMAGE_MODEL;
  }

  async generateBackground(input: SocialImageGenerationInput) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? SOCIAL_IMAGE_PROVIDER_TIMEOUT_MS);
    const fetcher = this.options.fetcher ?? fetch;
    try {
      const response = await fetcher('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          prompt: input.prompt.prompt,
          size: input.prompt.providerSize,
          quality: this.options.quality ?? DEFAULT_SOCIAL_IMAGE_QUALITY,
          output_format: input.prompt.outputFormat,
          background: 'opaque',
          n: 1,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        data?: Array<{ b64_json?: string | null; revised_prompt?: string | null }>;
        error?: { message?: string; code?: string; type?: string };
      };

      if (!response.ok) {
        const code = payload.error?.code ?? payload.error?.type ?? 'provider_error';
        if (response.status === 429) throw new SocialImageProviderError('OpenAI image rate limit.', 'rate_limit');
        if (response.status >= 500) throw new SocialImageProviderError('OpenAI image server error.', 'server_error');
        if (/policy|safety|refus/i.test(code)) throw new SocialImageProviderError('OpenAI image prompt refused.', 'prompt_refused');
        throw new SocialImageProviderError('OpenAI image request failed.', code);
      }

      const b64 = payload.data?.[0]?.b64_json;
      if (!b64 || b64.length > 30_000_000) {
        throw new SocialImageProviderError('OpenAI image response invalid.', 'invalid_response');
      }
      const bytes = Uint8Array.from(atob(b64), (char) => char.charCodeAt(0));
      const decoded = await decodePng(bytes);
      const palette = averagePalette(decoded, BRAND_BLUE);
      return {
        background: {
          bytes,
          mimeType: 'image/png' as const,
          width: decoded.width,
          height: decoded.height,
          palette,
          promptSummary: payload.data?.[0]?.revised_prompt ?? input.prompt.prompt,
        },
        usage: {
          generationCount: 1,
          promptChars: input.prompt.promptChars,
          estimatedCost: null,
          latencyMs: Date.now() - started,
        },
        provider: this.id,
        model: this.model,
      };
    } catch (error) {
      if (error instanceof SocialImageProviderError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new SocialImageProviderError('OpenAI image timeout.', 'timeout');
      }
      throw new SocialImageProviderError('OpenAI image provider unavailable.', 'provider_error');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class SocialVisualRenderer {
  async render(input: {
    post: SocialImagePostContext;
    background: GeneratedSocialBackground;
    layout: SocialVisualLayout;
  }): Promise<SocialRenderedImage> {
    const started = Date.now();
    validateBackgroundDimensions(input.background);
    const decoded = await decodePng(input.background.bytes);
    const [focusX, focusY] = focusFor(input.layout);
    const { buffer, crop } = resizeCover(decoded, SOCIAL_FINAL_IMAGE_WIDTH, SOCIAL_FINAL_IMAGE_HEIGHT, focusX, focusY);
    const spec = layoutSpec(input.layout);
    const fit = fitText(input.post.visualText, spec);
    if (fit.overflow) {
      throw new SocialImageValidationError(
        'Texte visuel trop long pour une creation lisible.',
        undefined,
        'text_overflow',
      );
    }

    applyOverlay(buffer, spec);
    drawPanel(buffer, spec);
    drawAccent(buffer, spec, input.background.palette.accent);
    drawTextBlock(buffer, fit.lines, spec.textBox, fit, spec.alignment, spec.textColor);
    const logoBox = logoBoxFor(spec.logoPlacement);
    drawLogo(buffer, logoBox, spec.textColor === WHITE ? WHITE : BRAND_NIGHT);

    const bytes = encodePngFromPixels(buffer);
    return {
      bytes,
      mimeType: 'image/png',
      width: SOCIAL_FINAL_IMAGE_WIDTH,
      height: SOCIAL_FINAL_IMAGE_HEIGHT,
      altText: `Visuel REZO360 - ${input.post.visualText}`.slice(0, 180),
      originalFilename: `rezo360-social-${input.post.slotIndex}.png`,
      promptSummary: input.background.promptSummary,
      render: {
        layout: input.layout,
        fontFamily: input.layout === 'TYPOGRAPHIC_HERO' ? 'IBM Plex Sans Variable' : 'Nunito',
        fontSize: fit.fontSize,
        minFontSize: SOCIAL_IMAGE_MIN_READABLE_FONT_SIZE,
        lineHeight: fit.lineHeight,
        lineCount: fit.lines.length,
        attempts: fit.attempts,
        textBox: spec.textBox,
        visualBox: spec.visualBox,
        logoBox,
        safeZoneOk: isInsideSafeZone(spec.textBox) && isInsideSafeZone(logoBox),
        contrastRatio: Number(contrastRatio(spec.panel === 'blue' ? BRAND_NIGHT : WHITE, spec.textColor).toFixed(2)),
        crop,
        renderMs: Date.now() - started,
        fileSizeBytes: bytes.byteLength,
      },
    };
  }
}

function isInsideSafeZone(box: Box) {
  const margin = 48;
  return (
    box.x >= margin &&
    box.y >= margin &&
    box.x + box.width <= SOCIAL_FINAL_IMAGE_WIDTH - margin &&
    box.y + box.height <= SOCIAL_FINAL_IMAGE_HEIGHT - margin
  );
}

export class VisualQualityCheck {
  validate(image: SocialRenderedImage): SocialRenderedImage {
    if (image.width !== SOCIAL_FINAL_IMAGE_WIDTH || image.height !== SOCIAL_FINAL_IMAGE_HEIGHT) {
      throw new SocialImageValidationError('Dimensions finales Instagram invalides.', undefined, 'final_dimensions');
    }
    if (image.mimeType !== 'image/png') throw new SocialImageValidationError('Format final invalide.', undefined, 'final_format');
    if (!PNG_SIGNATURE.every((byte, index) => image.bytes[index] === byte)) {
      throw new SocialImageValidationError('Fichier final corrompu.', undefined, 'final_corrupt');
    }
    if (image.bytes.byteLength === 0 || image.bytes.byteLength > 10 * 1024 * 1024) {
      throw new SocialImageValidationError('Taille du fichier final invalide.', undefined, 'final_size');
    }
    if (!image.render.safeZoneOk || image.render.lineCount > 4) {
      throw new SocialImageValidationError('Texte hors zone de securite.', undefined, 'safe_zone');
    }
    if (image.render.fontSize < SOCIAL_IMAGE_MIN_READABLE_FONT_SIZE) {
      throw new SocialImageValidationError('Typographie trop petite.', undefined, 'font_too_small');
    }
    if (image.render.contrastRatio < 4.5) {
      throw new SocialImageValidationError('Contraste insuffisant pour le texte.', undefined, 'contrast');
    }
    if (!isInsideSafeZone(image.render.logoBox)) {
      throw new SocialImageValidationError('Logo hors zone autorisee.', undefined, 'logo_zone');
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
  try {
    validateBackgroundDimensions(background.background);
  } catch (error) {
    if (error instanceof SocialImageValidationError) {
      throw new SocialImageValidationError(error.message, {
        usage: background.usage,
        provider: background.provider,
        model: background.model,
      }, error.code);
    }
    throw error;
  }

  const rendered = new VisualQualityCheck().validate(
    await new SocialVisualRenderer().render({ post: input.post, background: background.background, layout }),
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
  openaiApiKey?: string | null;
  quality?: string | null;
}): ImageGenerationProvider | null {
  const provider = env.provider?.trim().toLowerCase();
  if (!provider) return null;

  if (provider === 'mock') {
    if (env.allowMock?.trim().toLowerCase() !== 'true') return null;
    return new MockImageGenerationProvider(env.model?.trim() || DEFAULT_SOCIAL_IMAGE_MODEL);
  }

  if (provider === 'openai') {
    const apiKey = env.openaiApiKey?.trim();
    if (!apiKey) return null;
    const quality = env.quality?.trim() as SocialImageQuality | undefined;
    return new OpenAIImageGenerationProvider({
      apiKey,
      model: env.model?.trim() || DEFAULT_OPENAI_SOCIAL_IMAGE_MODEL,
      quality: quality || DEFAULT_SOCIAL_IMAGE_QUALITY,
    });
  }

  throw new SocialImageProviderError('Social image provider non supporte.', 'unsupported_provider');
}
