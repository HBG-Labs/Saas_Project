import { z } from 'zod';

export const scientificCalculatorSchema = z.object({
  expression: z.string().min(1, 'L’expression ne peut pas être vide'),
  angleUnit: z.enum(['deg', 'rad']).default('deg'),
  memoryValue: z.number().default(0),
});

export type ScientificCalculatorInputs = z.infer<typeof scientificCalculatorSchema>;
