import { z } from 'zod';

export const rfCalculatorsSchema = z.object({
  module: z.enum([
    'wavelength',
    'fspl',
    'attenuator',
    'link_budget',
    'resonance',
    'swr',
    'rho',
    'return_loss',
    'mismatch',
    'radiated_power',
    'transmission_line',
    'eirp',
    'fresnel',
  ]),
});

export type RfCalculatorsInputs = z.infer<typeof rfCalculatorsSchema>;
