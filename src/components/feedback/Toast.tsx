import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Toast as RadixToast } from 'radix-ui';
import { useCallback, useMemo, useState, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { ToastContext, type ToastApi, type ToastTon } from './toast-context';

interface ToastMessage {
  id: number;
  ton: ToastTon;
  titre: string;
  detail?: string;
}

const TONS: Record<ToastTon, { icone: typeof CheckCircle2; classe: string; duree: number }> = {
  // Une erreur reste deux fois plus longtemps : on la lit, parfois on la note.
  success: { icone: CheckCircle2, classe: 'text-success', duree: 4000 },
  error: { icone: XCircle, classe: 'text-error', duree: 8000 },
  warning: { icone: AlertTriangle, classe: 'text-warning', duree: 6000 },
  info: { icone: Info, classe: 'text-primary', duree: 4000 },
};

/**
 * Notifications éphémères.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE COMPOSANT MANQUAIT
 *
 * Le produit n'avait aucun moyen d'annoncer le résultat d'une action qui se
 * termine ailleurs qu'à l'endroit du clic. Les erreurs de formulaire ont
 * `FormError`, utilisé dans 34 fichiers ; les confirmations de copie sont
 * inscrites dans le bouton lui-même. Mais « la mission a été créée » après une
 * navigation, ou « l'envoi a échoué » depuis un traitement de fond, n'avaient
 * nulle part où s'afficher.
 *
 * CE QU'IL NE FAUT PAS LUI FAIRE DIRE
 *
 * Pas les erreurs de saisie : elles appartiennent au champ fautif, pas à un
 * coin de l'écran — `FormError` reste la bonne réponse. Pas les confirmations
 * de copie : « Copié » écrit dans le bouton qu'on vient de presser se lit là
 * où l'œil se trouve déjà.
 *
 * Construit sur Radix Toast : région `aria-live` correcte, fermeture au
 * balayage, échappement clavier et mise en file d'attente sont fournis. Les
 * réimplémenter correctement représente plusieurs centaines de lignes et se
 * révèle presque toujours partiellement faux.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const pousser = useCallback((ton: ToastTon, titre: string, detail?: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), ton, titre, ...(detail === undefined ? {} : { detail }) },
    ]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      succes: (titre, detail) => pousser('success', titre, detail),
      erreur: (titre, detail) => pousser('error', titre, detail),
      avertissement: (titre, detail) => pousser('warning', titre, detail),
      info: (titre, detail) => pousser('info', titre, detail),
    }),
    [pousser],
  );

  const retirer = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="right">
        {children}

        {messages.map((m) => {
          const { icone: Icone, classe, duree } = TONS[m.ton];
          return (
            <RadixToast.Root
              key={m.id}
              duration={duree}
              onOpenChange={(ouvert) => {
                if (!ouvert) retirer(m.id);
              }}
              className={cn(
                'border-border bg-surface-raised shadow-modal flex items-start gap-3 rounded-xl border p-4',
                'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-bottom',
                'data-[swipe=end]:animate-out data-[swipe=end]:fade-out',
              )}
            >
              <Icone className={cn('mt-0.5 size-5 shrink-0', classe)} aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <RadixToast.Title className="text-foreground text-sm font-semibold">
                  {m.titre}
                </RadixToast.Title>
                {m.detail !== undefined ? (
                  <RadixToast.Description className="text-muted-foreground mt-0.5 text-sm leading-snug">
                    {m.detail}
                  </RadixToast.Description>
                ) : null}
              </div>

              <RadixToast.Close
                aria-label="Fermer la notification"
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground -mt-1 -mr-1 flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors sm:size-8"
              >
                <X className="size-4" aria-hidden="true" />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}

        {/*
          En bas sur téléphone, en bas à droite à partir de `sm`.

          Au-dessus de la navigation basse (`safe-bottom` + sa hauteur) : une
          notification qui recouvrirait les destinations principales masquerait
          la sortie au moment même où l'on veut partir.
        */}
        <RadixToast.Viewport className="safe-bottom fixed bottom-16 left-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
