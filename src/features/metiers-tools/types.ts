export type TradeSlug =
  | 'btp'
  | 'plomberie'
  | 'electricite'
  | 'espaces-verts'
  | 'fibre-optique'
  | 'reseaux';

export type ReliabilityLevel = 'simple' | 'indicative' | 'pro_validation';
/**
 * Les calculateurs restent défensifs face à des données restaurées d'une
 * ancienne session ou reçues d'une source externe.
 */
export type MetierInputValue = string | number | boolean | null | undefined;

export interface TradeDefinition {
  slug: TradeSlug;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  icon: string;
  badgeColor: string;
  gradient?: string;
  accentColor?: string;
  toolsCount: number;
  toolSlugs?: string[];
}

export interface MetierToolField {
  id: string;
  label: string;
  type: 'number' | 'select' | 'text' | 'boolean';
  defaultValue: NonNullable<MetierInputValue>;
  options?: { value: string; label: string }[];
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helpText?: string;
}

export interface MetierResultRow {
  label: string;
  value: string;
  highlight?: boolean;
  badge?: string;
  badgeVariant?: 'neutral' | 'primary' | 'success' | 'warning' | 'error';
}

export interface MetierCalculationOutput {
  primaryResult: string;
  primaryUnit?: string | undefined;
  primaryLabel?: string | undefined;
  status?: 'ok' | 'warning' | 'danger' | undefined;
  statusMessage?: string | undefined;
  details: MetierResultRow[];
  formulaExplanation?: string | undefined;
  standardReference?: string | undefined;
  assumptions?: string[] | undefined;
  limits?: string[] | undefined;
  advice?: string[] | undefined;
  disclaimer?: string | undefined;
  raw?: Record<string, unknown> | undefined;
}

export interface MetierToolDefinition {
  slug: string;
  tradeSlug: TradeSlug;
  title: string;
  shortDescription?: string;
  description: string;
  icon: string;
  tags: string[];
  reliabilityLevel: ReliabilityLevel;
  standardReference?: string;
  assumptions?: string[];
  limits?: string[];
  disclaimer?: string;
  fields: MetierToolField[];
  compute: (inputs: Record<string, MetierInputValue>) => MetierCalculationOutput;
}
