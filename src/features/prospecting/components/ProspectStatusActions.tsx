import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import type { ProspectStatus } from '@/types/database';

import { MANUAL_PROSPECT_STATUSES } from '../api/prospecting.api';
import { useSuppressProspect, useUpdateProspectStatus } from '../hooks/useProspecting';
import { usePlatformAdmin } from '../hooks/usePlatformAdmin';
import { PROSPECT_STATUS_LABELS } from '../lib/prospect-display';
import { ManageOnlyNotice } from './ManageOnlyNotice';

/**
 * §19 du cahier des charges — actions commerciales, à l'exception de :
 * « Copier le message »/« Modifier le brouillon » (Phase 8, aucun brouillon
 * n'existe encore) et « Passer en essai »/« Convertir en client » (Phase 9 :
 * relient le prospect à une organisation/client réel, une opération plus
 * lourde que ce simple changement de statut).
 *
 * Progression strictement MANUELLE (§9) : aucun bouton n'est désactivé selon
 * le statut courant — l'utilisateur décide, l'écran ne verrouille pas un
 * parcours.
 *
 * Exception : un prospect déjà CONVERTI (Phase 9) n'affiche plus ces actions
 * — un client REZO360 ne se « refuse » ni ne s'« ignore » plus depuis cet
 * écran, sa relation commerciale se gère désormais dans son organisation.
 */
export function ProspectStatusActions({ siren, status }: { siren: string; status: ProspectStatus }) {
  const updateStatus = useUpdateProspectStatus(siren);
  const suppress = useSuppressProspect(siren);
  const [suppressOpen, setSuppressOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { can } = usePlatformAdmin();

  if (status === 'converti') return null;
  if (!can('prospecting.manage')) return <ManageOnlyNotice />;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {MANUAL_PROSPECT_STATUSES.filter((candidate) => candidate !== status).map((candidate) => (
        <Button
          key={candidate}
          size="sm"
          variant={candidate === 'refuse' || candidate === 'ignore' ? 'outline' : 'secondary'}
          disabled={updateStatus.isPending}
          onClick={() => updateStatus.mutate(candidate)}
        >
          {PROSPECT_STATUS_LABELS[candidate]}
        </Button>
      ))}

      {status !== 'ne_plus_contacter' && (
        <Button size="sm" variant="danger-outline" onClick={() => setSuppressOpen(true)}>
          Ne plus contacter
        </Button>
      )}

      <Modal
        open={suppressOpen}
        onOpenChange={setSuppressOpen}
        title="Ne plus jamais contacter cette entreprise"
        description="Cette opposition est appliquée en base et survit à toute resynchronisation future — même une nouvelle détection ne réactivera jamais ce prospect."
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setSuppressOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="danger"
              disabled={suppress.isPending}
              onClick={() => {
                suppress.mutate(reason.trim() || null, {
                  onSuccess: () => {
                    setSuppressOpen(false);
                    setReason('');
                  },
                });
              }}
            >
              Confirmer l’opposition
            </Button>
          </div>
        }
      >
        <Textarea
          label="Motif (optionnel)"
          placeholder="Ex. : demande explicite de l’entreprise le 16/09"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
      </Modal>
    </div>
  );
}
