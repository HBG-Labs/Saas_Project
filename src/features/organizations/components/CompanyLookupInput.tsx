import { Building2, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

import { Input, type InputProps } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

import {
  searchFrenchCompanies,
  type FrenchCompanyCandidate,
} from '../api/company-directory.api';

type LookupMode = 'name' | 'siret';

interface CompanyLookupInputProps
  extends Omit<InputProps, 'onChange' | 'value' | 'defaultValue' | 'trailingSlot'> {
  mode: LookupMode;
  value: string;
  onValueChange: (value: string) => void;
  onCompanySelect: (company: FrenchCompanyCandidate) => void;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function isSearchable(value: string, mode: LookupMode): boolean {
  if (mode === 'name') return value.trim().length >= 3;
  const identifier = onlyDigits(value);
  return identifier.length === 9 || identifier.length === 14;
}

export function CompanyLookupInput({
  mode,
  value,
  onValueChange,
  onCompanySelect,
  className,
  onBlur,
  ...inputProps
}: CompanyLookupInputProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<FrenchCompanyCandidate[]>([]);

  const query = mode === 'siret' ? onlyDigits(value) : value.trim();
  const searchable = isSearchable(value, mode);

  useEffect(() => {
    if (!open || !searchable) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => {
        setStatus('loading');
        void searchFrenchCompanies(query, controller.signal)
          .then((companies) => {
            setResults(companies);
            setStatus('success');
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setResults([]);
            setStatus('error');
          });
      },
      mode === 'name' ? 450 : 150,
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mode, open, query, searchable]);

  function handleValueChange(nextValue: string) {
    onValueChange(nextValue);
    const canSearch = isSearchable(nextValue, mode);
    setOpen(canSearch);
    if (!canSearch) {
      setResults([]);
      setStatus('idle');
    }
  }

  function selectCompany(company: FrenchCompanyCandidate) {
    setOpen(false);
    setStatus('idle');
    onCompanySelect(company);
  }

  const showPanel = open && searchable;

  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Input
        {...inputProps}
        className={className}
        value={value}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={showPanel ? listId : undefined}
        aria-expanded={showPanel}
        autoComplete="off"
        onBlur={onBlur}
        onChange={(event) => handleValueChange(event.target.value)}
        trailingSlot={
          status === 'loading' ? (
            <LoaderCircle className="text-primary size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="text-subtle-foreground size-4" aria-hidden="true" />
          )
        }
      />

      {showPanel ? (
        <div
          id={listId}
          className="border-border bg-surface shadow-overlay absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border p-1"
        >
          {status === 'loading' ? (
            <p role="status" className="text-muted-foreground px-3 py-3 text-sm">
              Recherche dans l’annuaire officiel…
            </p>
          ) : null}

          {status === 'error' ? (
            <p role="status" className="text-muted-foreground px-3 py-3 text-sm">
              Recherche momentanément indisponible. La saisie manuelle reste possible.
            </p>
          ) : null}

          {status === 'success' && results.length === 0 ? (
            <p role="status" className="text-muted-foreground px-3 py-3 text-sm">
              Aucune entreprise active trouvée.
            </p>
          ) : null}

          {status === 'success' && results.length > 0 ? (
            <div role="listbox" aria-label="Entreprises trouvées">
              {results.map((company) => {
                const location = [company.postalCode, company.city].filter(Boolean).join(' ');
                return (
                  <button
                    key={company.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className={cn(
                      'hover:bg-surface-hover focus-visible:bg-surface-hover flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left outline-none',
                    )}
                    onClick={() => selectCompany(company)}
                  >
                    <span className="bg-primary-subtle text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                      <Building2 className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-sm font-semibold">
                        {company.name}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        SIRET {company.siret}
                        {location ? ` · ${location}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
