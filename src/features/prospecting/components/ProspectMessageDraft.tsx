import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';

import { buildProspectMessageDraft } from '../lib/message-draft';
import { useMessageTemplate } from '../hooks/useProspecting';

/**
 * §17-19 du cahier des charges : un brouillon PRÉPARÉ, jamais envoyé. « Copier
 * le message » et « Modifier le brouillon » sont les deux seules actions —
 * il n'existe et n'existera aucun bouton « envoyer » dans ce module (§25).
 */
export function ProspectMessageDraft({
  sectorId,
  createdOn,
  commune,
}: {
  sectorId: string | null;
  createdOn: string | null;
  commune: string | null;
}) {
  const { data: template, isPending } = useMessageTemplate(sectorId ?? undefined);
  // `null` = pas encore touché par la personne : le brouillon affiché est
  // alors DÉDUIT du gabarit à chaque rendu, jamais mémorisé par un effet —
  // dès qu'elle tape, `editedDraft` prend le relais et n'est plus jamais
  // écrasé par un rechargement du gabarit.
  const [editedDraft, setEditedDraft] = useState<string | null>(null);
  const [copied, signalerCopied] = useEphemeralFlag();

  const generatedDraft = template ? buildProspectMessageDraft({ createdOn, commune, template }) : '';
  const draft = editedDraft ?? generatedDraft;
  const edited = editedDraft !== null;

  if (sectorId === null) {
    return (
      <p className="text-muted-foreground text-xs">
        Aucun brouillon disponible : ce prospect n’a pas de secteur reconnu.
      </p>
    );
  }

  if (isPending) {
    return <p className="text-muted-foreground text-xs">Chargement de l’argumentaire…</p>;
  }

  if (!template) {
    return (
      <p className="text-muted-foreground text-xs">
        Aucun brouillon disponible : ce secteur n’a pas encore d’argumentaire configuré.
      </p>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      signalerCopied();
    } catch {
      // Ignore l'échec de copie : le texte reste visible et sélectionnable.
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        label="Brouillon de message"
        hideLabel
        value={draft}
        onChange={(e) => setEditedDraft(e.target.value)}
        rows={8}
        className="font-mono text-2xs"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void handleCopy()}>
          {copied ? <Check className="text-success" aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copié' : 'Copier le message'}
        </Button>
        {edited && (
          <Button size="sm" variant="ghost" onClick={() => setEditedDraft(null)}>
            Revenir au brouillon d’origine
          </Button>
        )}
      </div>
      <p className="text-subtle-foreground text-3xs">
        Ce brouillon n’est jamais envoyé automatiquement — copiez-le et envoyez-le vous-même, par le
        canal de votre choix.
      </p>
    </div>
  );
}
