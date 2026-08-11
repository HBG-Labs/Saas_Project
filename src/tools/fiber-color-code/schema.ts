import { z } from 'zod';

export const COLOR_STANDARDS = ['orange_ft', 'tia_598', 'din_0888'] as const;
export type ColorStandard = (typeof COLOR_STANDARDS)[number];

export const MODULE_TYPES = [6, 12] as const;
export type ModuleType = (typeof MODULE_TYPES)[number];

export const CAPACITIES_MODULO_6 = [6, 12, 18, 24, 36, 48, 60, 72, 96, 144, 288, 432, 576, 720, 864, 1152] as const;
export type CapacityModulo6 = (typeof CAPACITIES_MODULO_6)[number];

export const CAPACITIES_MODULO_12 = [12, 24, 36, 48, 72, 96, 144, 288, 432, 576, 720, 864, 1152] as const;
export type CapacityModulo12 = (typeof CAPACITIES_MODULO_12)[number];

export const CABLE_CAPACITIES = [
  ...new Set([...CAPACITIES_MODULO_6, ...CAPACITIES_MODULO_12]),
].sort((a, b) => a - b);
export type CableCapacity = number;

export const fiberColorCodeSchema = z.object({
  fiberNumber: z.number().int().min(1, 'Numéro de fibre invalide').max(1152, 'Capacité maximale 1152 FO'),
  standard: z.enum(COLOR_STANDARDS).default('orange_ft'),
  capacity: z.number().int().default(144),
  moduleType: z.union([z.literal(6), z.literal(12)]).default(12),
});

export type FiberColorCodeInputs = z.infer<typeof fiberColorCodeSchema>;
