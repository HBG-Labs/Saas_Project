import { Check, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

import type { PurchaseOrder } from '../types/purchases.types';

interface ReceiveOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    orderId: string,
    receivedQuantities: Record<string, number>,
    deliveryNotes?: string,
  ) => Promise<unknown> | void;
  order: PurchaseOrder | null;
}

export function ReceiveOrderModal({
  isOpen,
  onClose,
  onSubmit,
  order,
}: ReceiveOrderModalProps) {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      // Par défaut, pré-remplir avec la quantité restante à recevoir
      const initial: Record<string, number> = {};
      order.items.forEach((item) => {
        const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
        initial[item.id] = remaining;
      });
      setReceivedQuantities(initial);
      setDeliveryNotes('');
    }
    setError(null);
  }, [order, isOpen]);

  if (!order) return null;

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const safeVal = Math.max(0, Math.min(maxQty, val));
    setReceivedQuantities((prev) => ({
      ...prev,
      [itemId]: safeVal,
    }));
  };

  const handleReceiveAll = () => {
    const updated: Record<string, number> = {};
    order.items.forEach((item) => {
      const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
      updated[item.id] = remaining;
    });
    setReceivedQuantities(updated);
  };

  const totalToReceiveNow = Object.values(receivedQuantities).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalToReceiveNow <= 0) {
      setError('Veuillez indiquer au moins un article reçu avec une quantité supérieure à 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit(order.id, receivedQuantities, deliveryNotes.trim() || undefined);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la validation de la réception.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={`Pointage BL & Réception — ${order.reference}`}
      description={`Validez les quantités livrées par ${order.supplierName}. Le stock sera automatiquement incrémenté.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="rounded-xl border border-error-border bg-error-subtle p-3 text-xs text-error">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between bg-surface-raised p-3 rounded-xl border border-border">
          <div>
            <p className="text-xs font-semibold text-foreground">
              Fournisseur : {order.supplierName}
            </p>
            <p className="text-3xs text-subtle-foreground">
              Date commande : {new Date(order.orderDate).toLocaleDateString('fr-FR')}
              {order.missionRef && ` • Chantier : ${order.missionRef}`}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReceiveAll}
            className="gap-1 text-2xs h-7 cursor-pointer"
          >
            <Check className="size-3" />
            <span>Tout réceptionner</span>
          </Button>
        </div>

        {/* Tableau des articles à réceptionner */}
        <div className="space-y-2">
          {/* Intitulé d'un tableau de saisie, pas d'un champ unique. */}
          <span
            id="pointage-articles-libelle"
            className="block text-xs font-bold text-foreground uppercase tracking-wider"
          >
            Pointage des articles livrés
          </span>

          <div
            role="group"
            aria-labelledby="pointage-articles-libelle"
            className="rounded-xl border border-border overflow-hidden"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised/60 text-muted-foreground text-3xs font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Réf. &amp; Article</th>
                  <th className="py-2.5 px-2 text-center">Commandé</th>
                  <th className="py-2.5 px-2 text-center">Déjà Reçu</th>
                  <th className="py-2.5 px-3 text-right">Reçu sur ce BL *</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  const isFullyReceived = remaining === 0;
                  const currentInput = receivedQuantities[item.id] ?? 0;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isFullyReceived ? 'bg-surface-raised/30 opacity-60' : 'hover:bg-surface-hover/50'
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-3xs font-bold text-muted-foreground bg-surface-raised px-1 py-0.5 rounded border border-border">
                          {item.reference}
                        </span>
                        <p className="font-semibold text-foreground text-xs leading-snug mt-0.5">
                          {item.description}
                        </p>
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono font-medium text-foreground">
                        {item.quantityOrdered} {item.unit}
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-muted-foreground">
                        {item.quantityReceived} {item.unit}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            min={0}
                            max={remaining}
                            step="any"
                            value={currentInput}
                            onChange={(e) =>
                              handleQtyChange(item.id, remaining, Number(e.target.value))
                            }
                            disabled={isFullyReceived}
                            className="w-20 text-right h-8 font-mono font-bold"
                          />
                          <span className="text-3xs text-muted-foreground uppercase font-semibold w-8 text-left">
                            {item.unit}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* N° BL / Remarques */}
        <div>
          <label htmlFor="receiveordermodal-n-bon-de-livraison-bl-remarques-de-recep" className="block text-xs font-semibold text-foreground mb-1">
            N° Bon de Livraison (BL) / Remarques de réception
          </label>
          <Input id="receiveordermodal-n-bon-de-livraison-bl-remarques-de-recep"
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            placeholder="Ex: BL-89402 — Colis intact, vérifié au quai"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || totalToReceiveNow <= 0}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
          >
            <PackageCheck className="size-4" />
            <span>
              {isSubmitting
                ? 'Traitement…'
                : `Valider la réception (${totalToReceiveNow} unités)`}
            </span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
