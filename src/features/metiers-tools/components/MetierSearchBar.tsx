import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface MetierSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  resultsCount?: number | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

export function MetierSearchBar({
  query,
  onQueryChange,
  resultsCount,
  placeholder = 'Rechercher un outil métier (béton, pente, ohm, gazon, FO, IPv4, devis)...',
  className,
}: MetierSearchBarProps) {
  return (
    <div className={className}>
      <Input
        label="Recherche outils métiers"
        hideLabel
        placeholder={placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        leadingIcon={<Search className="size-4 text-muted-foreground" />}
        {...(query
          ? {
              trailingSlot: (
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  aria-label="Effacer la recherche"
                  className="text-subtle-foreground hover:text-foreground flex size-7 items-center justify-center rounded cursor-pointer"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ),
            }
          : {})}
      />
      {query && resultsCount !== undefined && (
        <p className="text-2xs text-muted-foreground mt-1.5 ml-1">
          {resultsCount} outil{resultsCount > 1 ? 's' : ''} trouvé{resultsCount > 1 ? 's' : ''} pour « {query} »
        </p>
      )}
    </div>
  );
}
