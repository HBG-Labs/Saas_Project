import { z } from 'zod';

export const ohmLawPowerSchema = z.object({
  phaseType: z.enum(['single', 'three']),
  voltageVolts: z.number().min(1, 'Tension minimale 1V').max(1000, 'Tension maximale 1000V'),
  currentAmps: z.number().min(0.1, 'Courant minimal 0.1A').max(2000),
  cosPhi: z.number().min(0.1).max(1.0),
  cableLengthMeters: z.number().min(1).max(500),
  cableSectionMm2: z.number().min(1.5).max(300),
});

export type OhmLawPowerInputs = z.infer<typeof ohmLawPowerSchema>;
