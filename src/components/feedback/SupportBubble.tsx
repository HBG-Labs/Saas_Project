import { CheckCircle2, Headset, HelpCircle, Loader2, Send, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/features/auth';
import { submitSupportRequest } from '@/features/support';
import { cn } from '@/lib/cn';

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

  /**
   * Envoi RÉEL.
   *
   * La version précédente attendait neuf cents millisecondes puis affichait un
   * succès, sans rien transmettre : le message, le téléphone et les fichiers
   * étaient abandonnés en mémoire. Quelqu'un ayant un vrai problème écrivait,
   * lisait la confirmation, et attendait une réponse qui ne pouvait pas venir.
   *
   * Trois issues désormais, parce qu'il y en a trois : transmise, enregistrée
   * sans notification, ou refusée. En cas de refus la SAISIE EST CONSERVÉE —
   * faire retaper un message parce que le serveur a répondu 500 achèverait
   * d'exaspérer quelqu'un qui écrivait déjà pour se plaindre.
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
      <div className="fixed right-6 bottom-6 z-40 max-md:right-4 max-md:bottom-20">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fermer l'aide et le support" : "Ouvrir le support et l'aide"}
          className={cn(
            'group relative flex size-12 items-center justify-center rounded-full sm:size-13',
            'bg-primary text-primary-foreground shadow-lg transition-all duration-300',
            'hover:bg-primary-hover hover:scale-105 hover:shadow-xl active:scale-95',
            'focus-visible:ring-primary/40 cursor-pointer focus-visible:ring-4 focus-visible:outline-none',
          )}
        >
          {isOpen ? (
            <X className="size-6 transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <>
              <HelpCircle className="size-6 transition-transform duration-200 group-hover:scale-110" />
              {/* Badge d'état en ligne */}
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="border-surface relative inline-flex size-3.5 rounded-full border-2 bg-emerald-500" />
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
          className={cn(
            'fixed right-6 bottom-20 z-50 max-md:right-4 max-md:bottom-34',
            'flex max-h-[85vh] w-[min(23rem,92vw)] flex-col overflow-hidden',
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
