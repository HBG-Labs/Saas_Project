import { SelectField } from '@/components/ui/SelectField';
import { useState, useRef } from 'react';
import { Upload, Calendar, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
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

    setParsedEvents([]);
    setFileName(null);

    const normalizedName = file.name.toLowerCase();
    if (!normalizedName.endsWith('.ics') && !normalizedName.endsWith('.ical')) {
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
    reader.onerror = () => {
      setParsedEvents([]);
      setErrorMsg('Le fichier n’a pas pu être lu. Réessayez avec un autre export iCalendar.');
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
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
      title="Importer un calendrier iCal"
      description="Transformez les événements Outlook, Google Calendar ou Apple Calendar en missions."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={parsedEvents.length === 0}
            isLoading={submitting}
            loadingLabel="Création des missions"
            onClick={handleConfirmImport}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            <span>
              Créer {parsedEvents.length > 0 ? String(parsedEvents.length) : ''} mission
              {parsedEvents.length > 1 ? 's' : ''}
            </span>
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
          <div className="flex items-start gap-3">
            <div className="border-primary/20 bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl border">
              <Upload className="size-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-semibold">Fichier source</h3>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sélectionnez un export iCalendar au format .ics ou .ical.
              </p>
            </div>
          </div>

          <input
            id="ical-file"
            ref={fileInputRef}
            type="file"
            accept=".ics,.ical"
            aria-label="Fichier iCalendar"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border-border bg-surface-subtle/40 hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-ring/30 flex min-h-36 w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-[color,background-color,border-color] focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-full">
              <FileText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {fileName ? fileName : 'Cliquez pour sélectionner votre fichier .ics'}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Format standard iCalendar exporté depuis votre messagerie ou agenda
              </p>
            </div>
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="border-error/30 bg-error/10 text-error flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}
        </section>

        {/* Parsed Events Preview */}
        {parsedEvents.length > 0 && (
          <section className="border-border bg-surface-sunken/35 space-y-4 rounded-2xl border p-4 shadow-xs sm:p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                <span>Événements détectés</span>
                <Badge variant="primary">{parsedEvents.length}</Badge>
              </h3>
            </div>

            <SelectField
              id="tech-assign-select"
              label="Assigner ces missions à"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              hint="Chaque événement deviendra une mission planifiée à sa date."
            >
              <option value="">À affecter plus tard</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberDisplayName(member)}
                </option>
              ))}
            </SelectField>

            {/* Event preview list */}
            <div className="divide-border/60 border-border bg-surface max-h-52 divide-y overflow-y-auto rounded-xl border px-3">
              {parsedEvents.map((evt) => (
                <article key={evt.id} className="py-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground truncate font-semibold">{evt.title}</span>
                    <span className="text-3xs text-primary flex shrink-0 items-center gap-1 font-mono font-semibold">
                      <Calendar className="size-3" aria-hidden="true" />
                      {evt.date}
                    </span>
                  </div>
                  {evt.details && (
                    <p className="text-muted-foreground mt-1 truncate text-xs">{evt.details}</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
