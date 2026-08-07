import { z } from 'zod';

export const COLOR_STANDARDS = ['orange_ft', 'tia_598', 'din_0888'] as const;
export type ColorStandard = (typeof COLOR_STANDARDS)[number];

export const CABLE_CAPACITIES = [6, 12, 24, 48, 72, 96, 144, 288, 432, 576, 720, 864, 1152, 1728, 3456] as const;
export type CableCapacity = (typeof CABLE_CAPACITIES)[number];

export const fiberColorCodeSchema = z.object({
  fiberNumber: z.number().int().min(1, 'Numéro de fibre invalide').max(3456, 'Capacité maximale 3456 FO'),
  standard: z.enum(COLOR_STANDARDS).default('orange_ft'),
  capacity: z.number().int().default(144),
});

export type FiberColorCodeInputs = z.infer<typeof fiberColorCodeSchema>;
