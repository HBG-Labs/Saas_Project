import {
  Building,
  Download,
  Mail,
  MapPin,
  Phone,
  Printer,
} from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCurrentOrganization } from '@/features/organizations';
import { exportToCsv } from '@/lib/csv-export';

import {
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VARIANTS,
  type PurchaseOrder,
} from '../types/purchases.types';

interface PurchaseOrderViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
}

export function PurchaseOrderViewModal({
  isOpen,
  onClose,
  order,
}: PurchaseOrderViewModalProps) {
  const { organization } = useCurrentOrganization();

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    exportToCsv(
      `bon-de-commande-${order.reference}`,
      [
        { header: 'Référence Article', accessor: (i) => i.reference },
        { header: 'Désignation', accessor: (i) => i.description },
        { header: 'Quantité Commandée', accessor: (i) => i.quantityOrdered },
        { header: 'Quantité Reçue', accessor: (i) => i.quantityReceived },
        { header: 'Unité', accessor: (i) => i.unit },
        { header: 'Prix Unitaire HT (€)', accessor: (i) => i.unitPriceEur.toFixed(2) },
        { header: 'Total Ligne HT (€)', accessor: (i) => i.totalEur.toFixed(2) },
      ],
      order.items,
    );
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="xl"
      title={`Bon de Commande — ${order.reference}`}
      description="Document officiel de commande à destination de votre fournisseur."
    >
      <div className="space-y-6 pt-1 max-h-[80vh] overflow-y-auto pr-1 print:p-0">
        {/* Barre d'action supérieure */}
        <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <Badge
              variant={PURCHASE_STATUS_VARIANTS[order.status]}
              className="text-xs py-1 px-2.5 font-bold"
            >
              {PURCHASE_STATUS_LABELS[order.status]}
            </Badge>
            {order.missionRef && (
              <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md font-semibold">
                Chantier : {order.missionRef}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1 text-xs cursor-pointer"
            >
              <Download className="size-3.5" />
              <span>Export CSV</span>
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="gap-1 text-xs cursor-pointer"
            >
              <Printer className="size-3.5" />
              <span>Imprimer / PDF</span>
            </Button>
          </div>
        </div>

        {/* Fiche Bon de Commande (Style Document Pro) */}
        <div className="bg-surface rounded-2xl border border-border p-5 sm:p-6 space-y-6 shadow-xs">
          {/* En-tête : Émetteur & Destinataire */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b border-border pb-5">
            {/* Émetteur (Votre entreprise) */}
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-foreground font-bold text-sm mb-1">
                <Building className="size-4 text-primary" />
                <span>{organization?.name || 'Rezo360 Services'}</span>
              </div>
              <p className="text-muted-foreground">Société d’Ingénierie &amp; Travaux Techniques</p>
              <p className="text-subtle-foreground text-3xs">TVA Intracommunautaire : FR89123456789</p>
              <p className="text-subtle-foreground text-3xs">SIRET : 891 234 567 00012</p>
            </div>

            {/* Fournisseur (Destinataire) */}
            <div className="rounded-xl border border-border bg-surface-raised/60 p-3.5 space-y-1 text-xs">
              <span className="text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                Fournisseur Destinataire :
              </span>
              <p className="text-foreground font-bold text-sm">{order.supplierName}</p>
              {order.supplierAddress && (
                <p className="text-muted-foreground flex items-center gap-1 text-3xs">
                  <MapPin className="size-3 shrink-0" />
                  <span>{order.supplierAddress}</span>
                </p>
              )}
              {order.supplierEmail && (
                <p className="text-muted-foreground flex items-center gap-1 text-3xs">
                  <Mail className="size-3 shrink-0" />
                  <span>{order.supplierEmail}</span>
                </p>
              )}
              {order.supplierPhone && (
                <p className="text-muted-foreground flex items-center gap-1 text-3xs">
                  <Phone className="size-3 shrink-0" />
                  <span>{order.supplierPhone}</span>
                </p>
              )}
            </div>
          </div>

          {/* Dates & Référence */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-raised/40 p-3 rounded-xl border border-border text-xs">
            <div>
              <p className="text-3xs font-bold text-muted-foreground uppercase">N° Commande</p>
              <p className="font-mono font-bold text-foreground text-sm">{order.reference}</p>
            </div>
            <div>
              <p className="text-3xs font-bold text-muted-foreground uppercase">Date d'émission</p>
              <p className="font-medium text-foreground">
                {new Date(order.orderDate).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div>
              <p className="text-3xs font-bold text-muted-foreground uppercase">Livraison souhaitée</p>
              <p className="font-medium text-foreground">
                {order.expectedDeliveryDate
                  ? new Date(order.expectedDeliveryDate).toLocaleDateString('fr-FR')
                  : 'Dès que possible'}
              </p>
            </div>
          </div>

          {/* Tableau des lignes de commande */}
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-raised/80 text-muted-foreground text-3xs font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Réf.</th>
                  <th className="py-2.5 px-3">Désignation</th>
                  <th className="py-2.5 px-3 text-center">Quantité</th>
                  <th className="py-2.5 px-3 text-right">P.U. HT</th>
                  <th className="py-2.5 px-3 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {order.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-surface-hover/30">
                    <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                      {item.reference}
                    </td>
                    <td className="py-2.5 px-3 text-foreground font-medium">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {item.quantityOrdered} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                      {item.unitPriceEur.toFixed(2)} €
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                      {item.totalEur.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totaux & Récapitulatif */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
            <div className="max-w-md text-xs text-muted-foreground space-y-1">
              {order.notes && (
                <div>
                  <p className="font-bold text-foreground text-3xs uppercase">
                    Instructions &amp; Remarques :
                  </p>
                  <p className="text-3xs italic bg-surface-raised p-2 rounded-lg border border-border mt-0.5">
                    {order.notes}
                  </p>
                </div>
              )}
              {order.deliveryNotes && (
                <div>
                  <p className="font-bold text-foreground text-3xs uppercase">
                    Pointage de livraison :
                  </p>
                  <p className="text-3xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2 rounded-lg border border-emerald-500/20 mt-0.5">
                    {order.deliveryNotes}
                  </p>
                </div>
              )}
            </div>

            <div className="w-full sm:w-64 rounded-xl border border-border bg-surface-raised/80 p-3.5 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Total HT :</span>
                <span className="font-semibold text-foreground">
                  {order.subtotalEur.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>TVA ({(order.taxRate * 100).toFixed(0)} %) :</span>
                <span>
                  {order.taxEur.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-foreground pt-2 border-t border-border">
                <span>Total TTC :</span>
                <span className="text-primary font-mono text-base">
                  {order.totalEur.toLocaleString('fr-FR', {
                    style: 'currency',
                    currency: 'EUR',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2 print:hidden">
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
