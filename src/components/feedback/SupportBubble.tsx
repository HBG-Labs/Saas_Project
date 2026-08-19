import {
  CheckCircle2,
  FileText,
  Headset,
  HelpCircle,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  X,
} from 'lucide-react';
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
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
        files,
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
    setFiles([]);
    setIsSuccess(false);
    setNotifieEnEchec(false);
    setErreur(null);
  };

  return (
    <>
      {/* ------------------- BULLE FLOTTANTE BOUTON D'AIDE */}
      <div className="fixed bottom-6 right-6 z-40 max-md:bottom-20 max-md:right-4">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fermer l'aide et le support" : "Ouvrir le support et l'aide"}
          className={cn(
            'group relative flex size-12 sm:size-13 items-center justify-center rounded-full',
            'bg-primary text-primary-foreground shadow-lg transition-all duration-300',
            'hover:scale-105 hover:shadow-xl hover:bg-primary-hover active:scale-95',
            'focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none cursor-pointer',
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
                <span className="relative inline-flex size-3.5 rounded-full border-2 border-surface bg-emerald-500" />
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
            'fixed bottom-20 right-6 z-50 max-md:bottom-34 max-md:right-4',
            'flex w-[min(23rem,92vw)] max-h-[85vh] flex-col overflow-hidden',
            'rounded-2xl border border-border/80 bg-surface/98 backdrop-blur-xl shadow-modal',
            'animate-in fade-in-0 zoom-in-95 duration-200',
          )}
        >
          {/* Header de la bulle */}
          <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Headset className="size-4" />
              </div>
              <div>
                <h3 id="support-dialog-title" className="text-xs font-bold text-foreground">
                  Centre d&apos;Assistance
                </h3>
                <div className="flex items-center gap-1.5 text-3xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>Équipe technique disponible</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
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
                  <h4 className="text-sm font-bold text-foreground">
                    {notifieEnEchec ? 'Message enregistré' : 'Message envoyé avec succès'}
                  </h4>
                  <p className="text-2xs text-muted-foreground leading-relaxed px-2">
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
                <div className="pt-2 flex gap-2 justify-center">
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
                    className="border-error-border bg-error-subtle text-foreground rounded-xl border px-3 py-2 text-2xs leading-relaxed"
                  >
                    {erreur}
                  </p>
                ) : null}
                {/* Champ Nom */}
                <div className="space-y-1">
                  <label htmlFor="support-name" className="block text-2xs font-semibold text-foreground">
                    Nom & Prénom
                  </label>
                  <Input
                    id="support-name"
                    type="text"
                    required
                    placeholder="Votre nom"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>

                {/* Champ Email */}
                <div className="space-y-1">
                  <label htmlFor="support-email" className="block text-2xs font-semibold text-foreground">
                    Adresse e-mail
                  </label>
                  <Input
                    id="support-email"
                    type="email"
                    required
                    placeholder="nom@entreprise.fr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>

                {/* Champ Téléphone */}
                <div className="space-y-1">
                  <label htmlFor="support-phone" className="block text-2xs font-semibold text-foreground">
                    Numéro de téléphone
                  </label>
                  <Input
                    id="support-phone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-8.5 text-xs rounded-xl"
                  />
                </div>

                {/* Champ Message */}
                <div className="space-y-1">
                  <label htmlFor="support-message" className="block text-2xs font-semibold text-foreground">
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
                      'w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground',
                      'focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none transition-colors',
                    )}
                  />
                </div>

                {/* Zone Pièces Jointes */}
                <div className="space-y-1.5">
                  <span className="block text-2xs font-semibold text-foreground">
                    Pièces jointes
                  </span>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    aria-label="Sélectionner des fichiers joints"
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/90',
                      'bg-surface-subtle/60 py-2.5 px-3 text-2xs font-medium text-muted-foreground transition-colors',
                      'hover:border-primary/50 hover:bg-surface-hover hover:text-foreground cursor-pointer',
                    )}
                  >
                    <Paperclip className="size-3.5 text-primary" />
                    <span>Ajouter un fichier à partir de l&apos;appareil</span>
                  </button>

                  {/* Liste des fichiers attachés */}
                  {files.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised px-2.5 py-1 text-3xs"
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <FileText className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate text-foreground font-medium">{file.name}</span>
                            <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} Ko)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="text-muted-foreground hover:text-rose-500 transition-colors p-0.5 cursor-pointer"
                            aria-label={`Supprimer ${file.name}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Bouton d'envoi */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gap-2 rounded-xl text-xs font-semibold h-9"
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
