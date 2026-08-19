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

export function AiSuggestionChips({ suggestions, onSelect, disabled = false }: AiSuggestionChipsProps) {
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
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-surface-hover px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground shadow-2xs backdrop-blur-xs transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon className="size-3.5 text-subtle-foreground group-hover:text-primary transition-colors shrink-0" />
            <span className="truncate max-w-[260px] sm:max-w-xs">{suggestion.label}</span>
          </button>
        );
      })}
    </div>
  );
}
