import { CheckCircle2, Headset, HelpCircle, Send, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/features/auth';
import { submitSupportRequest } from '@/features/support';
import { cn } from '@/lib/cn';

import { OPEN_SUPPORT_EVENT } from './support-dialog-events';

const STORAGE_KEY = 'rezo360_support_bubble_pos';

/** Côté de la pastille, et marge minimale avec les bords. */
const TAILLE_BULLE = 44;
const MARGE = 12;

/**
 * Hauteur réservée à l'en-tête, dans laquelle la bulle ne descend jamais.
 *
 * L'en-tête est collant : sans cette réserve, une bulle ramenée vers le haut
 * vient se poser sur le logo et la navigation — c'est le symptôme qui a fait
 * remonter le défaut.
 */
const ZONE_EN_TETE = 72;

/**
 * Ramène la bulle dans l'écran.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE SEULE FONCTION
 *
 * Ce calcul existait en TROIS exemplaires — pendant le glisser, au
 * redimensionnement, et… nulle part au montage. C'est précisément l'exemplaire
 * manquant qui a produit le défaut : la position relue depuis `localStorage`
 * était appliquée telle quelle.
 *
 * Mesuré : une position enregistrée sur un écran de bureau ({x:1240, y:700})
 * plaçait la bulle à `left:1240 / top:700` dans une fenêtre de 375x667 — soit
 * entièrement hors champ. Le bouton d'aide devenait INJOIGNABLE, sans aucun
 * moyen de le récupérer, puisque le seul recadrage écoutait un événement
 * `resize` qui ne se produisait pas.
 * ─────────────────────────────────────────────────────────────────────────────
 */
function contraindreDansEcran(pos: { x: number; y: number }): { x: number; y: number } {
  if (typeof window === 'undefined') return pos;

  // `Math.max` en dernier : sur une fenêtre plus étroite que la bulle, la borne
  // haute passerait sous la borne basse et `Math.min` seul renverrait un
  // négatif.
  const xMax = Math.max(MARGE, window.innerWidth - TAILLE_BULLE - MARGE);
  const yMax = Math.max(ZONE_EN_TETE, window.innerHeight - TAILLE_BULLE - MARGE);

  return {
    x: Math.min(Math.max(MARGE, pos.x), xMax),
    y: Math.min(Math.max(ZONE_EN_TETE, pos.y), yMax),
  };
}

export function SupportBubble() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  /** Vrai quand la demande est enregistrée mais que la notification n'est pas partie. */
  const [notifieEnEchec, setNotifieEnEchec] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Position personnalisée de la bulle
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          // Le recadrage AU MONTAGE, celui qui manquait. Une position venue
          // d'un plus grand écran n'a aucune raison d'être encore valable ici.
          return contraindreDansEcran(parsed);
        }
      }
    } catch {
      // ignore
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragInfoRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
  }>({ startX: 0, startY: 0, origX: 0, origY: 0, hasMoved: false });

  // Recalibrer la position lors d'un redimensionnement d'écran
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => (prev ? contraindreDansEcran(prev) : null));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(OPEN_SUPPORT_EVENT, open);
    return () => window.removeEventListener(OPEN_SUPPORT_EVENT, open);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    dragInfoRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      hasMoved: false,
    };
    setIsDragging(true);
    if (typeof buttonRef.current.setPointerCapture === 'function') {
      try {
        buttonRef.current.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragInfoRef.current.hasMoved = true;
    }

    if (dragInfoRef.current.hasMoved) {
      setPosition(
        contraindreDansEcran({
          x: dragInfoRef.current.origX + dx,
          y: dragInfoRef.current.origY + dy,
        }),
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (typeof buttonRef.current?.releasePointerCapture === 'function') {
      try {
        buttonRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (dragInfoRef.current.hasMoved) {
      if (position) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof buttonRef.current?.releasePointerCapture === 'function') {
      try {
        buttonRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Le navigateur peut avoir libéré la capture avant cet événement.
      }
    }
    setIsDragging(false);
    dragInfoRef.current.hasMoved = false;
  };

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Un glisser se termine lui aussi par un `click`. Le laisser parvenir au
    // déclencheur Radix ouvrirait le formulaire à chaque déplacement.
    if (!dragInfoRef.current.hasMoved) return;
    e.preventDefault();
    dragInfoRef.current.hasMoved = false;
  };

  /**
   * Envoi RÉEL.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setErreur(null);
    setIsSubmitting(true);

    try {
      const resultat = await submitSupportRequest({
        name: name.trim(),
        email: email.trim(),
        phone,
        message,
        userId: user?.id ?? null,
      });

      setNotifieEnEchec(!resultat.notified);
      setIsSuccess(true);
    } catch (thrown) {
      setErreur(
        thrown instanceof Error
          ? thrown.message
          : "Votre demande n'a pas pu être envoyée. Réessayez, ou écrivez à contact@rezo360.fr.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setMessage('');
    setIsSuccess(false);
    setNotifieEnEchec(false);
    setErreur(null);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      {/* ------------------- BULLE FLOTTANTE BOUTON D'AIDE */}
      <div
        style={position ? { left: `${position.x}px`, top: `${position.y}px` } : undefined}
        className={cn(
          'fixed z-40 hidden touch-none select-none md:block',
          !position && 'right-6 bottom-6 max-md:right-4 max-md:bottom-20',
        )}
      >
        <Dialog.Trigger asChild>
          <button
            ref={buttonRef}
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClick={handleTriggerClick}
            aria-label={isOpen ? "Fermer l'aide et le support" : "Ouvrir le support et l'aide"}
            title="Besoin d'aide ? (Glisser-déposer pour déplacer)"
            className={cn(
              'support-bubble-btn group size-touch relative flex items-center justify-center rounded-full',
              'bg-primary text-primary-foreground shadow-md transition-all duration-200',
              'hover:bg-primary-hover hover:scale-105',
              'focus-visible:ring-primary/40 focus-visible:ring-4 focus-visible:outline-none',
              isDragging
                ? 'ring-primary/40 scale-110 cursor-grabbing shadow-xl ring-2'
                : 'cursor-grab active:scale-105',
            )}
          >
            {isOpen ? (
              <X
                className="size-4.5 transition-transform duration-200 group-hover:rotate-90 sm:size-5"
                aria-hidden="true"
              />
            ) : (
              <>
                <HelpCircle
                  className="size-4.5 transition-transform duration-200 group-hover:scale-110 sm:size-5"
                  aria-hidden="true"
                />
                <span
                  className="absolute -top-0.5 -right-0.5 flex size-2.5 sm:size-3"
                  aria-hidden="true"
                >
                  <span className="bg-success absolute inline-flex size-full animate-ping rounded-full opacity-75" />
                  <span className="border-surface bg-success border-1.5 relative inline-flex size-full rounded-full" />
                </span>
              </>
            )}
          </button>
        </Dialog.Trigger>
      </div>

      {/* ------------------- POPUP / CARTE FLOTTANTE D'ASSISTANCE */}
      <Dialog.Portal>
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus();
          }}
          style={
            position && typeof window !== 'undefined'
              ? {
                  left: `${Math.max(12, Math.min(position.x - 280, window.innerWidth - 360))}px`,
                  top: `${Math.max(12, Math.min(position.y - 440, window.innerHeight - 520))}px`,
                }
              : undefined
          }
          className={cn(
            'fixed z-50',
            !position && 'right-6 bottom-20 max-md:right-4 max-md:bottom-32',
            'flex max-h-[85vh] w-[min(22rem,92vw)] flex-col overflow-hidden',
            'border-border/80 bg-surface/98 shadow-modal rounded-2xl border backdrop-blur-xl',
            'animate-in fade-in-0 zoom-in-95 duration-200',
          )}
        >
          {/* Header de la bulle */}
          <div className="border-border bg-surface-subtle flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-xl">
                <Headset className="size-4" />
              </div>
              <div>
                <Dialog.Title className="text-foreground text-xs font-bold">
                  Centre d&apos;Assistance
                </Dialog.Title>
                <Dialog.Description asChild>
                  <div className="text-3xs text-muted-foreground flex items-center gap-1.5">
                    <span className="bg-success size-1.5 rounded-full" aria-hidden="true" />
                    <span>Équipe technique disponible</span>
                  </div>
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground size-touch flex cursor-pointer items-center justify-center rounded-lg transition-colors sm:size-8"
                aria-label="Fermer la boîte de support"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Contenu : Formulaire ou Succès */}
          <div className="flex-1 overflow-y-auto p-4">
            {isSuccess ? (
              <div className="space-y-4 py-6 text-center">
                {/* Deux succès distincts, et il faut les distinguer : la demande
                    est enregistrée dans les deux cas, mais dans l'un elle nous
                    a été signalée et dans l'autre non. Annoncer « transmise »
                    quand la notification a échoué serait retomber dans le
                    travers qu'on corrige. */}
                <div
                  className={cn(
                    'mx-auto flex size-12 items-center justify-center rounded-full',
                    notifieEnEchec
                      ? 'bg-warning/10 text-warning'
                      : 'bg-success-subtle text-success',
                  )}
                >
                  <CheckCircle2 className="size-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-foreground text-sm font-bold">
                    {notifieEnEchec ? 'Message enregistré' : 'Message envoyé avec succès'}
                  </h4>
                  <p className="text-2xs text-muted-foreground px-2 leading-relaxed">
                    {notifieEnEchec ? (
                      <>
                        Votre demande est bien conservée et ne sera pas perdue, mais notre
                        notification n’a pas pu partir. Si c’est urgent, écrivez-nous directement à{' '}
                        <strong className="text-foreground">contact@rezo360.fr</strong>.
                      </>
                    ) : (
                      <>
                        Votre demande a bien été transmise à nos équipes techniques. Nous vous
                        répondrons par e-mail dans les plus brefs délais.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="rounded-xl text-xs"
                  >
                    Nouveau message
                  </Button>
                  <Dialog.Close asChild>
                    <Button type="button" size="sm" className="rounded-xl text-xs">
                      Fermer
                    </Button>
                  </Dialog.Close>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  void handleSubmit(e);
                }}
                className="space-y-3"
              >
                {/* Le refus laisse le formulaire INTACT : faire retaper son
                    message à quelqu'un qui écrivait déjà pour se plaindre
                    achèverait de l'exaspérer. */}
                {erreur !== null ? (
                  <p
                    role="alert"
                    className="border-error-border bg-error-subtle text-foreground text-2xs rounded-xl border px-3 py-2 leading-relaxed"
                  >
                    {erreur}
                  </p>
                ) : null}
                <Input
                  id="support-name"
                  label="Nom & Prénom"
                  type="text"
                  required
                  placeholder="Votre nom"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl text-xs"
                />

                <Input
                  id="support-email"
                  label="Adresse e-mail"
                  type="email"
                  required
                  placeholder="nom@entreprise.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl text-xs"
                />

                <Input
                  id="support-phone"
                  label="Numéro de téléphone"
                  type="tel"
                  placeholder="06 12 34 56 78"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl text-xs"
                />

                <Textarea
                  id="support-message"
                  label="Comment pouvons-nous vous aider ?"
                  required
                  rows={3}
                  placeholder="Décrivez votre question, problème ou suggestion…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="resize-none rounded-xl text-xs"
                />

                {/* Bouton d'envoi */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    loadingLabel="Envoi de la demande en cours"
                    leadingIcon={<Send className="size-3.5" aria-hidden="true" />}
                    className="w-full rounded-xl text-xs font-semibold"
                  >
                    {isSubmitting ? 'Envoi en cours…' : 'Envoyer'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
