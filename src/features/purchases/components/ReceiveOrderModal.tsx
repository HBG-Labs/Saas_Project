import { Check, PackageCheck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';

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

export function ReceiveOrderModal({ isOpen, onClose, onSubmit, order }: ReceiveOrderModalProps) {
  // Prérempli avec le RESTE à recevoir : c'est le geste courant, et le
  // magasinier n'a qu'à corriger les écarts du bon de livraison.
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (order?.items ?? []).map((item) => [
        item.id,
        Math.max(0, item.quantityOrdered - item.quantityReceived),
      ]),
    ),
  );
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    L'état part directement des props : la modale n'est montée que lorsqu'elle
    est ouverte, donc React la remonte à chaque ouverture. La version précédente
    la laissait montée en permanence et recopiait les props dans l'état par un
    `useEffect` — un `setState` dans un effet, donc un rendu en cascade.
  */

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
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button
            type="submit"
            form="purchase-receipt-form"
            variant="primary"
            isLoading={isSubmitting}
            loadingLabel="Traitement de la réception"
            disabled={totalToReceiveNow <= 0}
            className="gap-1.5"
          >
            <PackageCheck className="size-4" aria-hidden="true" />
            <span>Valider la réception ({totalToReceiveNow} unités)</span>
          </Button>
        </>
      }
    >
      <form id="purchase-receipt-form" onSubmit={handleSubmit} className="space-y-5 pt-1">
        {error && (
          <div
            role="alert"
            className="border-error-border bg-error-subtle text-error rounded-xl border p-3 text-sm"
          >
            {error}
          </div>
        )}

        <div className="border-border bg-surface-raised flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-foreground text-xs font-semibold">
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
            className="min-h-touch w-full gap-1 sm:min-h-0 sm:w-auto"
          >
            <Check className="size-3.5" aria-hidden="true" />
            <span>Tout réceptionner</span>
          </Button>
        </div>

        <section role="group" aria-labelledby="pointage-articles-libelle" className="space-y-3">
          {/* Intitulé d'un tableau de saisie, pas d'un champ unique. */}
          <span
            id="pointage-articles-libelle"
            className="text-foreground block text-xs font-bold tracking-wider uppercase"
          >
            Pointage des articles livrés
          </span>

          <div className="border-border hidden overflow-hidden rounded-xl border sm:block">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-border bg-surface-raised/60 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
                  <th className="px-3 py-2.5">Réf. &amp; Article</th>
                  <th className="px-2 py-2.5 text-center">Commandé</th>
                  <th className="px-2 py-2.5 text-center">Déjà Reçu</th>
                  <th className="px-3 py-2.5 text-right">Reçu sur ce BL *</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {order.items.map((item) => {
                  const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                  const isFullyReceived = remaining === 0;
                  const currentInput = receivedQuantities[item.id] ?? 0;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isFullyReceived
                          ? 'bg-surface-raised/30 opacity-60'
                          : 'hover:bg-surface-hover/50'
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-3xs text-muted-foreground bg-surface-raised border-border rounded border px-1 py-0.5 font-mono font-bold">
                          {item.reference}
                        </span>
                        <p className="text-foreground mt-0.5 text-xs leading-snug font-semibold">
                          {item.description}
                        </p>
                      </td>

                      <td className="text-foreground px-2 py-2.5 text-center font-mono font-medium">
                        {item.quantityOrdered} {item.unit}
                      </td>

                      <td className="text-muted-foreground px-2 py-2.5 text-center font-mono font-semibold">
                        {item.quantityReceived} {item.unit}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <Input
                            aria-label={`Quantité reçue pour ${item.description}`}
                            type="number"
                            min={0}
                            max={remaining}
                            step="any"
                            value={currentInput}
                            onChange={(e) =>
                              handleQtyChange(item.id, remaining, Number(e.target.value))
                            }
                            disabled={isFullyReceived}
                            className="h-8 w-20 text-right font-mono font-bold"
                          />
                          <span className="text-3xs text-muted-foreground w-8 text-left font-semibold uppercase">
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

          <div className="space-y-3 sm:hidden">
            {order.items.map((item) => {
              const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
              const isFullyReceived = remaining === 0;
              const currentInput = receivedQuantities[item.id] ?? 0;

              return (
                <article
                  key={item.id}
                  className={`border-border bg-surface rounded-2xl border p-4 shadow-xs ${
                    isFullyReceived ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="border-border bg-surface-raised text-3xs text-muted-foreground rounded border px-1.5 py-0.5 font-mono font-semibold">
                        {item.reference}
                      </span>
                      <h4 className="text-foreground mt-1.5 text-sm leading-snug font-semibold">
                        {item.description}
                      </h4>
                    </div>
                    {isFullyReceived ? (
                      <span className="bg-success/10 text-3xs text-success shrink-0 rounded-full px-2 py-1 font-semibold">
                        Reçu
                      </span>
                    ) : null}
                  </div>

                  <dl className="bg-surface-sunken/45 my-4 grid grid-cols-2 gap-3 rounded-xl p-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Commandé</dt>
                      <dd className="text-foreground mt-0.5 font-semibold">
                        {item.quantityOrdered} {item.unit}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Déjà reçu</dt>
                      <dd className="text-foreground mt-0.5 font-semibold">
                        {item.quantityReceived} {item.unit}
                      </dd>
                    </div>
                  </dl>

                  <Input
                    label={`Reçu sur ce BL (${item.unit})`}
                    type="number"
                    min={0}
                    max={remaining}
                    step="any"
                    value={currentInput}
                    onChange={(e) => handleQtyChange(item.id, remaining, Number(e.target.value))}
                    disabled={isFullyReceived}
                    className="font-mono font-semibold"
                  />
                </article>
              );
            })}
          </div>
        </section>

        <Textarea
          id="receiveordermodal-n-bon-de-livraison-bl-remarques-de-recep"
          label="N° Bon de livraison (BL) / remarques de réception"
          value={deliveryNotes}
          onChange={(e) => setDeliveryNotes(e.target.value)}
          placeholder="Ex: BL-89402 — Colis intact, vérifié au quai"
          rows={3}
        />
      </form>
    </Modal>
  );
}
