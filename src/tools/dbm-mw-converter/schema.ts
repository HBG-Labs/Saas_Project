import { z } from 'zod';

export const dbmMwConverterSchema = z.object({
  mode: z.enum(['dbm_to_mw', 'mw_to_dbm']),
  value: z.number(),
  impedanceOhms: z.number().min(1).max(1000),
});

export type DbmMwConverterInputs = z.infer<typeof dbmMwConverterSchema>;
