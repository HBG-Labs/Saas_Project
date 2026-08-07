import { z } from 'zod';

export const subnetCalculatorSchema = z.object({
  ipAddress: z
    .string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Adresse IPv4 invalide (ex: 192.168.1.0)'),
  cidr: z.number().int().min(8, 'Masque minimal /8').max(30, 'Masque maximal /30'),
});

export type SubnetCalculatorInputs = z.infer<typeof subnetCalculatorSchema>;
