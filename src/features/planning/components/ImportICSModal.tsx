import { useState, useRef } from 'react';
import { Dialog } from 'radix-ui';
import { Upload, Calendar, CheckCircle2, AlertCircle, X, FileText, User } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { memberDisplayName } from '@/features/organizations';
import type { MemberWithProfile } from '@/types/domain';

import { parseICS, type ParsedICSEvent } from '../utils/ical';

/**
 * Importer un agenda, c'est CRÉER DES MISSIONS.
 *
 * Il n'existe pas de table d'événements où déposer un fichier iCalendar : le
 * calendrier compose des missions, des congés et des fériés. La version
 * précédente ajoutait les lignes importées à un tableau en mémoire — elles
 * disparaissaient au rechargement, ce qui est la pire issue possible pour un
 * import : l'utilisateur croit son planning repris.
 *
 * Chaque VEVENT devient donc une mission réelle, affectée à l'intervenant
 * choisi. L'aperçu avant validation prend tout son sens : ces lignes vont être
 * écrites.
 */
export interface ImportSubmission {
  events: readonly ParsedICSEvent[];
  assignedMemberId: string | null;
  sourceName: string;
}

interface ImportICSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: readonly MemberWithProfile[];
  submitting: boolean;
  onImport: (submission: ImportSubmission) => void;
}

export function ImportICSModal({
  open,
  onOpenChange,
  members,
  submitting,
  onImport,
}: ImportICSModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedICSEvent[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ics') && !file.name.endsWith('.ical')) {
      setErrorMsg('Veuillez sélectionner un fichier au format iCalendar (.ics ou .ical).');
      return;
    }

    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const events = parseICS(content);
        if (events.length === 0) {
          setErrorMsg('Aucun événement détecté dans ce fichier iCalendar.');
        } else {
          setParsedEvents(events);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    onImport({
      events: parsedEvents,
      assignedMemberId: selectedMemberId === '' ? null : selectedMemberId,
      sourceName: fileName ?? 'fichier .ics',
    });
  };

  const handleClose = () => {
    setParsedEvents([]);
    setFileName(null);
    setErrorMsg(null);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto bg-surface rounded-2xl border border-border p-5 sm:p-6 shadow-2xl z-50 focus:outline-hidden space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <Upload className="size-4.5" />
              </div>
              <div>
                <Dialog.Title className="text-sm font-extrabold text-foreground">
                  Importer un calendrier iCal (.ics)
                </Dialog.Title>
                <p className="text-xs text-muted-foreground">
                  Outlook, Google Calendar, Apple Calendar
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={handleClose}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-subtle flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Upload Area */}
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,.ical"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-6 text-center transition-all bg-surface-subtle/40 hover:bg-primary/5 cursor-pointer flex flex-col items-center gap-2"
            >
              <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  {fileName ? fileName : 'Cliquez pour sélectionner votre fichier .ics'}
                </p>
                <p className="text-3xs text-muted-foreground mt-0.5">
                  Format standard iCalendar exporté depuis votre messagerie ou agenda
                </p>
              </div>
            </button>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Parsed Events Preview */}
          {parsedEvents.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>Événements détectés</span>
                  <Badge variant="primary" className="text-3xs">
                    {parsedEvents.length}
                  </Badge>
                </h4>
              </div>

              {/* Intervenant assigné par défaut */}
              <div className="space-y-1.5">
                <label
                  htmlFor="tech-assign-select"
                  className="text-3xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1"
                >
                  <User className="size-3 text-primary" />
                  <span>Assigner ces missions à :</span>
                </label>
                <select
                  id="tech-assign-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
                >
                  <option value="">À affecter plus tard</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {memberDisplayName(member)}
                    </option>
                  ))}
                </select>
                <p className="text-3xs text-muted-foreground">
                  Chaque événement deviendra une mission planifiée à sa date.
                </p>
              </div>

              {/* Event preview list */}
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1 divide-y divide-border/60">
                {parsedEvents.map((evt) => (
                  <div key={evt.id} className="pt-2 first:pt-0 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">{evt.title}</span>
                      <span className="font-mono text-3xs font-bold text-primary shrink-0 flex items-center gap-1">
                        <Calendar className="size-2.5" />
                        {evt.date}
                      </span>
                    </div>
                    {evt.details && (
                      <p className="text-3xs text-muted-foreground truncate mt-0.5">
                        {evt.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button size="sm" variant="outline" onClick={handleClose} className="text-xs h-8">
              Annuler
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={parsedEvents.length === 0 || submitting}
              onClick={handleConfirmImport}
              className="text-xs h-8 gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              <span>
                {submitting
                  ? 'Création…'
                  : `Créer ${parsedEvents.length > 0 ? String(parsedEvents.length) : ''} mission${parsedEvents.length > 1 ? 's' : ''}`}
              </span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
