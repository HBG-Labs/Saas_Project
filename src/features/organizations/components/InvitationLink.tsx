import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

import { buildInvitationUrl } from '../invitation-url';

/**
 * Lien d'invitation, à copier et transmettre.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS UN E-MAIL
 *
 * Rien n'envoie de courriel aujourd'hui : `inviteMember` insère une ligne avec
 * un jeton, et c'est tout. Afficher « Invitation envoyée » serait un mensonge —
 * l'invité n'aurait jamais son lien et attendrait indéfiniment.
 *
 * Le lien à copier est honnête et fonctionne immédiatement. L'envoi automatique
 * viendra avec une Edge Function ; il s'ajoutera à ce mécanisme plutôt qu'il ne
 * le remplacera, comme le font Linear ou Notion.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function InvitationLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = buildInvitationUrl(token);

  const copy = () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        // `writeText` échoue hors contexte sécurisé ou si la permission est
        // refusée. Le champ restant sélectionnable, la copie manuelle demeure
        // possible : inutile d'alarmer.
      });
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        readOnly
        value={url}
        aria-label="Lien d’invitation"
        onFocus={(event) => {
          event.target.select();
        }}
        className="bg-surface-sunken border-border-strong text-foreground focus-visible:border-primary focus-visible:ring-primary/20 h-11 min-w-0 flex-1 truncate rounded-lg border px-3 font-mono text-xs transition-[border-color,box-shadow] focus-visible:ring-2 focus-visible:outline-none sm:h-9"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={copy}
        className={
          copied
            ? 'border-success/40 bg-success/10 text-success w-full sm:w-auto'
            : 'w-full sm:w-auto'
        }
        aria-live="polite"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}
