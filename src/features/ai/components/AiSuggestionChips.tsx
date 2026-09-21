import { Calendar, ClipboardCheck, Sparkles, Wrench } from 'lucide-react';

import type { AiSuggestion } from '../types/ai.types';

interface AiSuggestionChipsProps {
  suggestions: readonly AiSuggestion[];
  onSelect: (suggestion: AiSuggestion) => void;
  disabled?: boolean;
}

const CATEGORY_ICONS = {
  interventions: ClipboardCheck,
  stock: Wrench,
  planning: Calendar,
  reports: Sparkles,
};

export function AiSuggestionChips({
  suggestions,
  onSelect,
  disabled = false,
}: AiSuggestionChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
      {suggestions.map((suggestion) => {
        const Icon = CATEGORY_ICONS[suggestion.category] ?? Sparkles;
        return (
          <button
            key={suggestion.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="group border-border bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground min-h-touch inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-2xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0"
          >
            <Icon className="text-subtle-foreground group-hover:text-primary size-3.5 shrink-0 transition-colors" />
            <span className="max-w-[260px] truncate sm:max-w-xs">{suggestion.label}</span>
          </button>
        );
      })}
    </div>
  );
}
