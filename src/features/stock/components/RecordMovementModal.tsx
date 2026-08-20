import { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type {
  StockConsumable,
  StockMovementInput,
  StockMovementType,
} from '../types/stock.types';

interface RecordMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: StockMovementInput) => Promise<unknown> | void;
  consumables: StockConsumable[];
  initialConsumable?: StockConsumable | null | undefined;
  initialType?: StockMovementType | undefined;
}

export function RecordMovementModal({
  isOpen,
  onClose,
  onSubmit,
  consumables,
  initialConsumable,
  initialType = 'in',
}: RecordMovementModalProps) {
  const [selectedConsumableId, setSelectedConsumableId] = useState<string>(
    initialConsumable?.id ?? consumables[0]?.id ?? '',
  );
  const [type, setType] = useState<StockMovementType>(initialType);
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<string>('');
  const [technicianName, setTechnicianName] = useState<string>('');
  const [interventionRef, setInterventionRef] = useState<string>('');
  const [locationFrom, setLocationFrom] = useState<string>('');
  const [locationTo, setLocationTo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialConsumable) {
      setSelectedConsumableId(initialConsumable.id);
      setLocationFrom(initialConsumable.location);
    } else if (consumables.length > 0 && !selectedConsumableId) {
      const first = consumables[0];
      if (first) {
        setSelectedConsumableId(first.id);
        setLocationFrom(first.location);
      }
    }
    setType(initialType);
    setQuantity(1);
    setReason('');
    setTechnicianName('');
    setInterventionRef('');
    setLocationTo('');
    setError(null);
  }, [initialConsumable, initialType, isOpen, consumables]);

  const selectedConsumable = consumables.find((c) => c.id === selectedConsumableId);

  // Calcul du stock projeté
  const currentStock = selectedConsumable?.quantityInStock ?? 0;
  let projectedStock = currentStock;
  const numQty = Number(quantity) || 0;

  if (type === 'in') {
    projectedStock = currentStock + numQty;
  } else if (type === 'out') {
    projectedStock = Math.max(0, currentStock - numQty);
  } else if (type === 'adjustment') {
    projectedStock = numQty;
  }

  const handleConsumableChange = (id: string) => {
    setSelectedConsumableId(id);
    const item = consumables.find((c) => c.id === id);
    if (item) {
      setLocationFrom(item.location);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConsumableId) {
      setError('Veuillez sélectionner un article.');
      return;
    }
    if (quantity <= 0 && type !== 'adjustment') {
      setError('La quantité doit être supérieure à zéro.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        consumableId: selectedConsumableId,
        type,
        quantity: numQty,
        reason: reason.trim() || getDefaultReason(type),
        technicianName: technicianName.trim() || undefined,
        interventionRef: interventionRef.trim() || undefined,
        locationFrom: locationFrom.trim() || undefined,
        locationTo: locationTo.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement du mouvement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  function getDefaultReason(t: StockMovementType): string {
    switch (t) {
      case 'in':
        return 'Réception marchandise / Réapprovisionnement';
      case 'out':
        return 'Consommation intervention chantier';
      case 'transfer':
        return 'Transfert vers véhicule technicien';
      case 'adjustment':
        return 'Régularisation inventaire physique';
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Déclarer un mouvement de stock"
      description="Enregistrez une entrée, une sortie sur chantier ou un transfert vers un technicien."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3 text-xs text-error">
            {error}
          </div>
        )}

        {/* Choix du type de mouvement (Boutons Onglets) */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Type d’opération *
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setType('in')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                type === 'in'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowDownLeft className="size-4 mb-1" />
              <span>Entrée (BL)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('out')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                type === 'out'
                  ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowUpRight className="size-4 mb-1" />
              <span>Sortie (Chantier)</span>
            </button>

            <button
              type="button"
              onClick={() => setType('transfer')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                type === 'transfer'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <ArrowRight className="size-4 mb-1" />
              <span>Transfert Véhicule</span>
            </button>

            <button
              type="button"
              onClick={() => setType('adjustment')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                type === 'adjustment'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500'
                  : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              <RefreshCw className="size-4 mb-1" />
              <span>Inventaire</span>
            </button>
          </div>
        </div>

        {/* Sélection de l'article */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Article concerné *
          </label>
          {consumables.length === 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
              Aucun article enregistré dans le stock. Veuillez d'abord ajouter un article.
            </div>
          ) : (
            <select
              value={selectedConsumableId}
              onChange={(e) => handleConsumableChange(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              required
            >
              {consumables.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.reference}] {c.name} — En stock : {c.quantityInStock} {c.unit}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quantité & Simulation visuelle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {type === 'adjustment' ? 'Nouveau stock réel compté *' : 'Quantité du mouvement *'}
            </label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={
                  selectedConsumable?.unit === 'm' ||
                  selectedConsumable?.unit === 'kg' ||
                  selectedConsumable?.unit === 'litre'
                    ? '0.1'
                    : '1'
                }
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
              {selectedConsumable && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-bold text-muted-foreground uppercase">
                  {selectedConsumable.unit}
                </span>
              )}
            </div>
          </div>

          {/* Badge de simulation du nouveau stock */}
          {selectedConsumable && (
            <div className="rounded-xl border border-border bg-surface-raised p-2.5">
              <p className="text-3xs font-semibold text-muted-foreground uppercase">Impact sur le stock</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  Actuel : <strong className="text-foreground">{currentStock}</strong>
                </span>
                <span className="text-xs text-muted-foreground">→</span>
                <span className="text-xs font-bold text-primary">
                  Nouveau : {projectedStock} {selectedConsumable.unit}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Motif / Référence */}
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Motif / Justificatif
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={getDefaultReason(type)}
          />
        </div>

        {/* Champs conditionnels selon le type */}
        {(type === 'out' || type === 'transfer') && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Technicien / Bénéficiaire
              </label>
              <Input
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Ex: Thomas Martin"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {type === 'out' ? 'Réf. Intervention / Dossier' : 'Véhicule de destination'}
              </label>
              <Input
                value={type === 'out' ? interventionRef : locationTo}
                onChange={(e) =>
                  type === 'out' ? setInterventionRef(e.target.value) : setLocationTo(e.target.value)
                }
                placeholder={type === 'out' ? 'Ex: INT-2026-081' : 'Ex: Renault Trafic AB-123-CD'}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || consumables.length === 0}
          >
            {isSubmitting ? 'Enregistrement…' : 'Valider le mouvement'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
