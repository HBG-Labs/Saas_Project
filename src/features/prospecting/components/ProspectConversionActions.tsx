import { Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { ProspectStatus } from '@/types/database';

import { usePlatformAdmin } from '../hooks/usePlatformAdmin';
import { useConvertProspectToClient, useOrganizationSearch, useUpdateProspectStatus } from '../hooks/useProspecting';

/**
 * §22 du cahier des charges — conversion prospect → essai → client.
 *
 * « Passer en essai » est un simple changement de statut. « Convertir en
 * client » exige de choisir la VRAIE organisation REZO360 que ce prospect
 * est devenu : jamais de lien automatique, jamais deviné — l'administrateur
 * choisit explicitement dans une liste qui exclut déjà les organisations
 * liées à un autre prospect (garde posée en base, pas seulement ici).
 */
export function ProspectConversionActions({ siren, status }: { siren: string; status: ProspectStatus }) {
  const updateStatus = useUpdateProspectStatus(siren);
  const convert = useConvertProspectToClient(siren);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const { can } = usePlatformAdmin();
  const canManage = can('prospecting.manage');
  const { data: results, isPending } = useOrganizationSearch(query, canManage && modalOpen);

  if (status === 'converti') return null;
  if (!canManage) return null;

  const closeModal = () => {
    setModalOpen(false);
    setQuery('');
    setSelectedOrgId(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== 'essai' && (
        <Button size="sm" variant="secondary" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate('essai')}>
          Passer en essai
        </Button>
      )}

      <Button size="sm" variant="primary" onClick={() => setModalOpen(true)}>
        Convertir en client
      </Button>

      <Modal
        open={modalOpen}
        onOpenChange={(open) => (open ? setModalOpen(true) : closeModal())}
        title="Convertir en client REZO360"
        description="Choisissez l'organisation que cette entreprise a créée sur REZO360. L'historique, la source et le score du prospect sont conservés ; les relances en attente sont automatiquement arrêtées."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button
              variant="primary"
              disabled={selectedOrgId === null || convert.isPending}
              onClick={() => {
                if (selectedOrgId === null) return;
                convert.mutate(selectedOrgId, { onSuccess: closeModal });
              }}
            >
              Confirmer la conversion
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Rechercher une organisation"
            hideLabel
            placeholder="Nom, raison sociale ou SIREN/SIRET…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedOrgId(null);
            }}
            leadingIcon={<Search aria-hidden="true" />}
          />

          {isPending ? (
            <p className="text-muted-foreground text-xs">Recherche…</p>
          ) : !results || results.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Aucune organisation active disponible. Elle doit d’abord avoir créé son compte REZO360.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {results.map((org) => (
                <li key={org.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      selectedOrgId === org.id
                        ? 'border-primary bg-primary-subtle'
                        : 'border-border/70 hover:bg-surface-hover'
                    }`}
                  >
                    <p className="text-foreground font-semibold">{org.name}</p>
                    {(org.legal_name || org.registration_number) && (
                      <p className="text-muted-foreground text-3xs mt-0.5">
                        {[org.legal_name, org.registration_number].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}
