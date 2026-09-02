import { useRef, useState, useEffect, useCallback, type PointerEvent } from 'react';
import { Check, Eraser, Pen, Palette } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export interface SignaturePadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string | undefined;
  description?: string | undefined;
  defaultSignerName?: string | undefined;
  signerRoleLabel?: string | undefined;
  onSaveSignature: (data: { signatureDataUrl: string; signerName: string }) => void;
}

const INK_COLORS = [
  { id: 'blue', label: 'Bleu stylo', value: '#1e40af', dotBg: 'bg-blue-600' },
  { id: 'black', label: 'Noir', value: '#0f172a', dotBg: 'bg-slate-900' },
] as const;

export function SignaturePadModal({
  open,
  onOpenChange,
  title = 'Signature électronique',
  description = 'Signez directement sur l’écran tactile ou à la souris pour valider l’intervention.',
  defaultSignerName = '',
  signerRoleLabel = 'Nom du signataire',
  onSaveSignature,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [inkColor]);

  // Réinitialisation à l'OUVERTURE, ajustée au rendu plutôt que dans l'effet :
  // un `setState` synchrone dans un effet fait apparaître la modale un instant
  // avec la signature précédente avant de l'effacer.
  const [wasOpen, setWasOpen] = useState(open);
  if (open && !wasOpen) {
    setWasOpen(true);
    setSignerName(defaultSignerName);
    setHasDrawn(false);
    setError(null);
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    // Double trigger to ensure dimensions are computed after modal animation
    const rAf = requestAnimationFrame(() => {
      initCanvas();
    });
    const timer = setTimeout(initCanvas, 120);

    return () => {
      cancelAnimationFrame(rAf);
      clearTimeout(timer);
    };
  }, [open, defaultSignerName, initCanvas]);

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
    setError(null);
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (!hasDrawn) {
      setError('Veuillez apposer une signature avant de valider.');
      return;
    }
    if (!signerName.trim()) {
      setError('Veuillez renseigner le nom complet du signataire.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureDataUrl = canvas.toDataURL('image/png');
    onSaveSignature({
      signatureDataUrl,
      signerName: signerName.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="space-y-4">
        {/* Champ Nom du signataire */}
        <Input
          label={signerRoleLabel}
          placeholder="Ex: M. Dupont / Client"
          value={signerName}
          onChange={(e) => {
            setSignerName(e.target.value);
            if (error) setError(null);
          }}
          required
        />

        {/* Zone de signature Canvas */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-1.5">
              <Pen className="size-3.5 text-primary" />
              Apposer votre signature ci-dessous :
            </span>

            <div className="flex items-center gap-3">
              {/* Choix de la couleur d'encre */}
              <div className="flex items-center gap-1.5 bg-surface-sunken/80 px-2 py-0.5 rounded-md border border-border">
                <Palette className="size-3 text-muted-foreground" />
                {INK_COLORS.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => {
                      setInkColor(color.value);
                      const canvas = canvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) ctx.strokeStyle = color.value;
                      }
                    }}
                    title={color.label}
                    className={`size-3.5 rounded-full transition-transform cursor-pointer ${color.dotBg} ${
                      inkColor === color.value ? 'ring-2 ring-primary ring-offset-1 scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Eraser className="size-3" />
                Effacer
              </button>
            </div>
          </div>

          {/* Surface de signature type bloc-papier blanc haute visibilité */}
          <div
            ref={containerRef}
            /* Zone de signature en noir sur blanc, quel que soit le thème : le tracé
             part tel quel dans le PDF du compte rendu, où il doit rester lisible
             sur papier. Ce ne sont donc pas des jetons oubliés. */
            className="relative h-48 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white text-slate-900 touch-none overflow-hidden shadow-inner select-none"
            style={{ touchAction: 'none' }}
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="w-full h-full cursor-crosshair block relative z-10 touch-none"
              style={{ touchAction: 'none' }}
            />

            {/* Ligne repère de signature discrète */}
            <div className="absolute bottom-6 inset-x-6 border-b border-slate-200 pointer-events-none flex items-center justify-between text-slate-300 font-mono">
              <span>✕ Signer sur la ligne</span>
              <span>Document sécurisé</span>
            </div>

            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 font-medium select-none z-0">
                ✍️ Tracez votre signature au doigt ou au stylet ici
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-error text-xs font-semibold">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Annuler
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            className="text-xs gap-1.5"
          >
            <Check className="size-3.5" />
            Valider et signer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
