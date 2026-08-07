import { z } from 'zod';

export const fiberAttenuationSchema = z.object({
  wavelength: z.enum(['1310', '1550']),
  distanceKm: z.number().min(0.01, 'La distance doit être supérieure à 0').max(200, 'Distance maximale 200 km'),
  splicesCount: z.number().int().min(0, 'Le nombre d’épissures ne peut pas être négatif').max(500),
  spliceLossDb: z.number().min(0).max(2, 'Atténuation d’épissure trop élevée'),
  connectorsCount: z.number().int().min(0, 'Le nombre de connecteurs ne peut pas être négatif').max(100),
  connectorLossDb: z.number().min(0).max(3, 'Atténuation de connecteur trop élevée'),
  safetyMarginDb: z.number().min(0).max(10),
});

export type FiberAttenuationInputs = z.infer<typeof fiberAttenuationSchema>;
