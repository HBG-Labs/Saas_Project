import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { Calendar, Edit2, Eye, Package, PackageCheck, Search, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import {
  PURCHASE_STATUS_LABELS,
  PURCHASE_STATUS_VARIANTS,
  type PurchaseOrder,
} from '../types/purchases.types';

interface PurchaseOrdersTableProps {
  orders: PurchaseOrder[];
  onView: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onDelete: (id: string) => void;
  onReceive: (order: PurchaseOrder) => void;
  onSend?: ((order: PurchaseOrder) => void) | undefined;
}

export function PurchaseOrdersTable({
  orders,
  onView,
  onEdit,
  onDelete,
  onReceive,
  onSend,
}: PurchaseOrdersTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [customMonth, setCustomMonth] = useState<string>(
    new Date().toISOString().slice(0, 7), // YYYY-MM
  );
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);

  const uniqueSuppliers = useMemo(() => {
    const names = new Set(orders.map((o) => o.supplierName));
    return Array.from(names);
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    return orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        order.reference.toLowerCase().includes(q) ||
        order.supplierName.toLowerCase().includes(q) ||
        (order.missionRef && order.missionRef.toLowerCase().includes(q)) ||
        order.items.some(
          (i) => i.reference.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
        );

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSupplier = supplierFilter === 'all' || order.supplierName === supplierFilter;

      let matchesPeriod = true;
      if (periodFilter !== 'all') {
        const d = new Date(order.orderDate);
        if (periodFilter === 'this_month') {
          matchesPeriod = d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        } else if (periodFilter === 'last_month') {
          matchesPeriod = d.getFullYear() === prevYear && d.getMonth() === prevMonth;
        } else if (periodFilter === 'custom_month' && customMonth) {
          const [yStr, mStr] = customMonth.split('-');
          matchesPeriod = d.getFullYear() === Number(yStr) && d.getMonth() === Number(mStr) - 1;
        } else if (periodFilter === 'this_year') {
          matchesPeriod = d.getFullYear() === currentYear;
        }
      }

      return matchesSearch && matchesStatus && matchesSupplier && matchesPeriod;
    });
  }, [orders, search, statusFilter, supplierFilter, periodFilter, customMonth]);

  const renderMobileOrder = (order: PurchaseOrder) => {
    const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantityOrdered, 0);
    const totalReceivedCount = order.items.reduce((sum, item) => sum + item.quantityReceived, 0);
    const progressPct =
      totalItemsCount > 0 ? Math.round((totalReceivedCount / totalItemsCount) * 100) : 0;

    return (
      <article key={order.id} className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="bg-surface-sunken border-border text-foreground text-3xs inline-flex rounded-md border px-1.5 py-0.5 font-mono font-bold">
              {order.reference}
            </span>
            <h3 className="text-foreground mt-1.5 truncate text-sm font-bold">
              {order.supplierName}
            </h3>
            <p className="text-muted-foreground text-3xs mt-0.5 inline-flex items-center gap-1">
              <Calendar className="size-3.5" aria-hidden="true" />
              {new Date(order.orderDate).toLocaleDateString('fr-FR')}
              {order.expectedDeliveryDate
                ? ` · Livraison ${new Date(order.expectedDeliveryDate).toLocaleDateString('fr-FR')}`
                : ''}
            </p>
          </div>
          <Badge
            variant={PURCHASE_STATUS_VARIANTS[order.status]}
            className="text-3xs shrink-0 px-2 py-1 font-semibold"
          >
            {PURCHASE_STATUS_LABELS[order.status]}
          </Badge>
        </div>

        <div className="bg-surface-sunken/45 border-border/70 grid grid-cols-[1fr_auto] gap-3 rounded-xl border p-3">
          <div className="min-w-0">
            <p className="text-muted-foreground text-3xs inline-flex items-center gap-1.5">
              <Package className="size-3.5" aria-hidden="true" />
              {order.items.length} référence{order.items.length > 1 ? 's' : ''} · {totalItemsCount}{' '}
              unité{totalItemsCount !== 1 ? 's' : ''}
            </p>
            {order.status !== 'draft' && order.status !== 'cancelled' ? (
              <div className="mt-2 flex items-center gap-2">
                <div className="bg-surface-raised border-border h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border">
                  <div
                    className={`h-full ${progressPct === 100 ? 'bg-success' : 'bg-warning'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-3xs shrink-0 font-mono font-semibold">
                  {progressPct}% reçu
                </span>
              </div>
            ) : null}
            <p className="text-muted-foreground text-3xs mt-2 truncate">
              {order.missionRef ? `Chantier : ${order.missionRef}` : 'Réapprovisionnement du stock'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-foreground font-mono text-sm font-bold">
              {order.subtotalEur.toLocaleString('fr-FR', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
            <p className="text-muted-foreground text-3xs mt-0.5">HT</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView(order)}
            className="min-h-touch flex-1 gap-1.5"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Voir le bon
          </Button>
          {order.status === 'draft' && onSend ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onSend(order)}
              aria-label={`Transmettre la commande ${order.reference}`}
              className="text-primary min-h-touch min-w-touch p-0"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {order.status !== 'received' && order.status !== 'cancelled' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onReceive(order)}
              aria-label={`Réceptionner la commande ${order.reference}`}
              className="text-success min-h-touch min-w-touch p-0"
            >
              <PackageCheck className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          {order.status === 'draft' || order.status === 'sent' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(order)}
              aria-label={`Modifier la commande ${order.reference}`}
              className="min-h-touch min-w-touch p-0"
            >
              <Edit2 className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOrderToDelete(order)}
            aria-label={`Supprimer la commande ${order.reference}`}
            className="text-muted-foreground hover:text-error min-h-touch min-w-touch p-0"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    );
  };

  return (
    <Card className="border-border/80 bg-surface overflow-hidden shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="border-border space-y-3 border-b p-3 sm:p-4">
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <Input
              label="Rechercher une commande fournisseur"
              hideLabel
              placeholder="Rechercher par référence, fournisseur, article, chantier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Search aria-hidden="true" />}
              className="bg-surface-raised"
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <SelectField
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              aria-label="Filtrer les commandes par période"
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 flex-1 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9 sm:flex-none"
            >
              <option value="all">Toutes les dates</option>
              <option value="this_month">Ce mois-ci</option>
              <option value="last_month">Mois dernier</option>
              <option value="custom_month">Mois précis…</option>
              <option value="this_year">Cette année</option>
            </SelectField>

            {periodFilter === 'custom_month' && (
              <Input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                aria-label="Choisir le mois des commandes"
                className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 flex-1 cursor-pointer rounded-xl border px-2 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9 sm:flex-none"
              />
            )}

            <SelectField
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer les commandes par statut"
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 flex-1 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9 sm:flex-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillons</option>
              <option value="sent">Envoyées / En attente</option>
              <option value="partially_received">Partiellement reçues</option>
              <option value="received">Reçues & Soldées</option>
              <option value="cancelled">Annulées</option>
            </SelectField>

            <SelectField
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label="Filtrer les commandes par fournisseur"
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 flex-1 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9 sm:flex-none"
            >
              <option value="all">Tous fournisseurs</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
        <p className="text-muted-foreground text-3xs" aria-live="polite">
          {filteredOrders.length} commande{filteredOrders.length !== 1 ? 's' : ''} affichée
          {filteredOrders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-muted-foreground px-4 py-10 text-center">
          <p className="text-sm font-semibold">Aucun bon de commande trouvé</p>
          <p className="text-2xs text-subtle-foreground mx-auto mt-1 max-w-md">
            Créez une nouvelle commande fournisseur ou modifiez vos critères de recherche.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-border divide-y md:hidden">
            {filteredOrders.map(renderMobileOrder)}
          </div>
          <div className="hidden w-full overflow-x-auto md:block">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-border bg-surface-raised/50 text-3xs text-muted-foreground border-b font-bold tracking-wider uppercase">
                  <th className="px-3 py-2.5 sm:px-4">Commande &amp; Dates</th>
                  <th className="px-3 py-2.5">Fournisseur &amp; Chantier</th>
                  <th className="hidden px-3 py-2.5 md:table-cell">Articles &amp; Réception</th>
                  <th className="px-3 py-2.5 text-right">Montant HT</th>
                  <th className="px-3 py-2.5 text-center">Statut</th>
                  <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {filteredOrders.map((order) => {
                  const totalItemsCount = order.items.reduce(
                    (sum, i) => sum + i.quantityOrdered,
                    0,
                  );
                  const totalReceivedCount = order.items.reduce(
                    (sum, i) => sum + i.quantityReceived,
                    0,
                  );
                  const progressPct =
                    totalItemsCount > 0
                      ? Math.round((totalReceivedCount / totalItemsCount) * 100)
                      : 0;

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-hover/50 group transition-colors"
                    >
                      {/* 1. Commande & Dates */}
                      <td className="px-3 py-3 sm:px-4">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          <span className="text-foreground bg-surface-raised border-border rounded border px-1.5 py-0.5 font-mono text-xs font-bold">
                            {order.reference}
                          </span>
                        </div>
                        <div className="text-3xs text-subtle-foreground flex items-center gap-1">
                          <Calendar className="size-3" />
                          <span>{new Date(order.orderDate).toLocaleDateString('fr-FR')}</span>
                          {order.expectedDeliveryDate && (
                            <span>
                              • Prévue :{' '}
                              {new Date(order.expectedDeliveryDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Fournisseur & Chantier */}
                      <td className="px-3 py-3">
                        <p className="text-foreground text-xs leading-snug font-semibold">
                          {order.supplierName}
                        </p>
                        {order.missionRef ? (
                          <span className="text-3xs text-primary bg-primary/10 mt-0.5 inline-block rounded px-1 py-0.5 font-mono">
                            Chantier : {order.missionRef}
                          </span>
                        ) : (
                          <span className="text-3xs text-muted-foreground">
                            Réapprovisionnement Stock
                          </span>
                        )}
                      </td>

                      {/* 3. Articles & Progression */}
                      <td className="hidden px-3 py-3 md:table-cell">
                        <p className="text-foreground text-xs font-medium">
                          {order.items.length} référence{order.items.length > 1 ? 's' : ''} (
                          {totalItemsCount} unités)
                        </p>
                        {order.status !== 'draft' && order.status !== 'cancelled' && (
                          <div className="mt-1 flex items-center gap-2">
                            <div className="bg-surface-raised border-border h-1.5 w-24 overflow-hidden rounded-full border">
                              <div
                                className={`h-full transition-all ${
                                  progressPct === 100 ? 'bg-success' : 'bg-warning'
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                            <span className="text-3xs text-subtle-foreground font-mono font-semibold">
                              {totalReceivedCount}/{totalItemsCount} ({progressPct}%)
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 4. Montant HT */}
                      <td className="px-3 py-3 text-right">
                        <p className="text-foreground text-xs font-bold">
                          {order.subtotalEur.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </p>
                        <p className="text-3xs text-subtle-foreground">
                          TTC :{' '}
                          {order.totalEur.toLocaleString('fr-FR', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </p>
                      </td>

                      {/* 5. Statut */}
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant={PURCHASE_STATUS_VARIANTS[order.status]}
                          className="text-3xs px-2 py-0.5 font-semibold"
                        >
                          {PURCHASE_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>

                      {/* 6. Actions */}
                      <td className="px-3 py-3 text-right sm:px-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Voir / Imprimer */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onView(order)}
                            title="Voir le Bon de Commande / Imprimer"
                            aria-label={`Voir la commande ${order.reference}`}
                            className="text-muted-foreground hover:text-foreground size-6.5 cursor-pointer p-0"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          {/* Transmettre / Marquer comme envoyée (si brouillon) */}
                          {order.status === 'draft' && onSend && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onSend(order)}
                              title="Marquer comme transmise au fournisseur"
                              aria-label={`Transmettre la commande ${order.reference}`}
                              className="text-primary hover:bg-primary/10 size-6.5 cursor-pointer p-0"
                            >
                              <Send className="size-3.5" />
                            </Button>
                          )}

                          {/* Réceptionner (si envoyée ou partiellement reçue) */}
                          {order.status !== 'received' && order.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onReceive(order)}
                              title="Pointage du Bon de Livraison (BL) / Réceptionner"
                              aria-label={`Réceptionner la commande ${order.reference}`}
                              className="text-success hover:bg-success/10 size-6.5 cursor-pointer p-0"
                            >
                              <PackageCheck className="size-3.5" />
                            </Button>
                          )}

                          {/* Modifier (si brouillon ou envoyée) */}
                          {(order.status === 'draft' || order.status === 'sent') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onEdit(order)}
                              title="Modifier la commande"
                              aria-label={`Modifier la commande ${order.reference}`}
                              className="text-muted-foreground hover:text-foreground size-6.5 cursor-pointer p-0"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                          )}

                          {/* Supprimer */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setOrderToDelete(order)}
                            title="Supprimer la commande"
                            aria-label={`Supprimer la commande ${order.reference}`}
                            className="text-muted-foreground hover:text-error size-6.5 cursor-pointer p-0"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={orderToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setOrderToDelete(null);
        }}
        title="Supprimer la commande"
        description={
          orderToDelete
            ? `« ${orderToDelete.reference} » sera supprimée définitivement.`
            : 'Confirmez la suppression de cette commande.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setOrderToDelete(null)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (orderToDelete) {
                  onDelete(orderToDelete.id);
                  setOrderToDelete(null);
                }
              }}
              className="w-full sm:w-auto"
            >
              Supprimer définitivement
            </Button>
          </div>
        }
      >
        <p className="text-muted-foreground text-sm">
          Cette action est irréversible. Les informations de suivi associées à ce bon de commande ne
          seront plus accessibles.
        </p>
      </Modal>
    </Card>
  );
}
