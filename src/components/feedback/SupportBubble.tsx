import { CheckCircle2, Headset, HelpCircle, Loader2, Send, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth';
import { submitSupportRequest } from '@/features/support';
import { cn } from '@/lib/cn';

const STORAGE_KEY = 'rezo360_support_bubble_pos';

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
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Position personnalisée de la bulle
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { x: number; y: number };
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
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

  // Fermer avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Recalibrer la position lors d'un redimensionnement d'écran
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const btnSize = 44;
        const clampedX = Math.max(12, Math.min(prev.x, window.innerWidth - btnSize - 12));
        const clampedY = Math.max(12, Math.min(prev.y, window.innerHeight - btnSize - 12));
        return { x: clampedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    buttonRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragInfoRef.current.startX;
    const dy = e.clientY - dragInfoRef.current.startY;

    if (!dragInfoRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      dragInfoRef.current.hasMoved = true;
    }

    if (dragInfoRef.current.hasMoved) {
      const btnSize = 44;
      const newX = Math.max(
        12,
        Math.min(dragInfoRef.current.origX + dx, window.innerWidth - btnSize - 12),
      );
      const newY = Math.max(
        12,
        Math.min(dragInfoRef.current.origY + dy, window.innerHeight - btnSize - 12),
      );

      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isDragging) return;
    setIsDragging(false);

    try {
      buttonRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (dragInfoRef.current.hasMoved) {
      if (position) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    } else {
      setIsOpen((prev) => !prev);
    }
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
    <>
      {/* ------------------- BULLE FLOTTANTE BOUTON D'AIDE */}
      <div
        style={
          position
            ? { left: `${position.x}px`, top: `${position.y}px` }
            : undefined
        }
        className={cn(
          'fixed z-40 select-none touch-none',
          !position && 'right-6 bottom-6 max-md:right-4 max-md:bottom-20',
        )}
      >
        <button
          ref={buttonRef}
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fermer l'aide et le support" : "Ouvrir le support et l'aide"}
          title="Besoin d'aide ? (Glisser-déposer pour déplacer)"
          className={cn(
            'group relative flex size-9.5 sm:size-10 items-center justify-center rounded-full',
            'bg-primary text-primary-foreground shadow-md transition-all duration-200',
            'hover:bg-primary-hover hover:scale-105',
            'focus-visible:ring-primary/40 focus-visible:ring-4 focus-visible:outline-none',
            isDragging ? 'cursor-grabbing scale-110 shadow-xl ring-2 ring-primary/40' : 'cursor-grab active:scale-105',
          )}
        >
          {isOpen ? (
            <X className="size-4.5 sm:size-5 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <HelpCircle className="size-4.5 sm:size-5 transition-transform duration-200 group-hover:scale-110" />
              {/* Badge d'état en ligne */}
              <span className="absolute -top-0.5 -right-0.5 flex size-2.5 sm:size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="border-surface relative inline-flex size-full rounded-full border-1.5 bg-emerald-500" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* ------------------- POPUP / CARTE FLOTTANTE D'ASSISTANCE */}
      {isOpen ? (
        <div
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-dialog-title"
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
                <h3 id="support-dialog-title" className="text-foreground text-xs font-bold">
                  Centre d&apos;Assistance
                </h3>
                <div className="text-3xs text-muted-foreground flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Équipe technique disponible</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:bg-surface-hover hover:text-foreground cursor-pointer rounded-lg p-1 transition-colors"
              aria-label="Fermer la boîte de support"
            >
              <X className="size-4" />
            </button>
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
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Fermer
                  </Button>
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
                {/* Champ Nom */}
                <div className="space-y-1">
                  <label
                    htmlFor="support-name"
                    className="text-2xs text-foreground block font-semibold"
                  >
                    Nom & Prénom
                  </label>
                  <Input
                    id="support-name"
                    type="text"
                    required
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8.5 rounded-xl text-xs"
                  />
                </div>

                {/* Champ Email */}
                <div className="space-y-1">
                  <label
                    htmlFor="support-email"
                    className="text-2xs text-foreground block font-semibold"
                  >
                    Adresse e-mail
                  </label>
                  <Input
                    id="support-email"
                    type="email"
                    required
                    placeholder="nom@entreprise.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-8.5 rounded-xl text-xs"
                  />
                </div>

                {/* Champ Téléphone */}
                <div className="space-y-1">
                  <label
                    htmlFor="support-phone"
                    className="text-2xs text-foreground block font-semibold"
                  >
                    Numéro de téléphone
                  </label>
                  <Input
                    id="support-phone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-8.5 rounded-xl text-xs"
                  />
                </div>

                {/* Champ Message */}
                <div className="space-y-1">
                  <label
                    htmlFor="support-message"
                    className="text-2xs text-foreground block font-semibold"
                  >
                    Comment pouvons-nous vous aider ?
                  </label>
                  <textarea
                    id="support-message"
                    required
                    rows={3}
                    placeholder="Décrivez votre question, problème ou suggestion…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={cn(
                      'border-border bg-surface text-foreground placeholder:text-muted-foreground w-full rounded-xl border px-3 py-2 text-xs',
                      'focus:border-primary focus:ring-primary/20 resize-none transition-colors focus:ring-2 focus:outline-none',
                    )}
                  />
                </div>

                {/* Bouton d'envoi */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 w-full gap-2 rounded-xl text-xs font-semibold"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Envoi en cours…</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        <span>Envoyer</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
