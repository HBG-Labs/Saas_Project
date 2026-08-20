import type { ComponentType, LazyExoticComponent } from 'react';

export type ToolCategory = 'universal' | 'general' | 'electrical' | 'fiber-optics' | 'telecom' | 'networking' | 'mechanical' | 'hydraulics' | 'construction';

export interface UniversalToolDefinition {
  id: string;
  slug: string;
  name: string;
  title: string;
  category: 'universal';
  description: string;
  keywords: readonly string[];
  icon: string;
  order: number;
  Component: LazyExoticComponent<ComponentType> | ComponentType;
}

export interface CalculationHistoryEntry {
  id: string;
  toolSlug: string;
  toolName: string;
  summary: string;
  inputs: Record<string, string | number>;
  result: string;
  timestamp: number;
}
