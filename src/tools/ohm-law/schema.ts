import { z } from 'zod';

export const TARGET_VARIABLES = ['U', 'I', 'R'] as const;
export type TargetVariable = (typeof TARGET_VARIABLES)[number];

export const VOLTAGE_UNITS = ['mV', 'V', 'kV'] as const;
export type VoltageUnit = (typeof VOLTAGE_UNITS)[number];

export const CURRENT_UNITS = ['mA', 'A', 'kA'] as const;
export type CurrentUnit = (typeof CURRENT_UNITS)[number];

export const RESISTANCE_UNITS = ['mΩ', 'Ω', 'kΩ', 'MΩ'] as const;
export type ResistanceUnit = (typeof RESISTANCE_UNITS)[number];

export const VOLTAGE_FACTORS: Record<VoltageUnit, number> = {
  mV: 1e-3,
  V: 1,
  kV: 1e3,
};

export const CURRENT_FACTORS: Record<CurrentUnit, number> = {
  mA: 1e-3,
  A: 1,
  kA: 1e3,
};

export const RESISTANCE_FACTORS: Record<ResistanceUnit, number> = {
  mΩ: 1e-3,
  'Ω': 1,
  kΩ: 1e3,
  MΩ: 1e6,
};

export const ohmLawInputsSchema = z.object({
  target: z.enum(TARGET_VARIABLES).default('U'),
  voltage: z.number().optional(),
  voltageUnit: z.enum(VOLTAGE_UNITS).default('V'),
  current: z.number().optional(),
  currentUnit: z.enum(CURRENT_UNITS).default('A'),
  resistance: z.number().optional(),
  resistanceUnit: z.enum(RESISTANCE_UNITS).default('Ω'),
});

export type OhmLawInputs = z.infer<typeof ohmLawInputsSchema>;
