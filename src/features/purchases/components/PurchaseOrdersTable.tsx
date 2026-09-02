import {
  Calendar,
  Edit2,
  Eye,
  PackageCheck,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
          (i) =>
            i.reference.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        );

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSupplier =
        supplierFilter === 'all' || order.supplierName === supplierFilter;

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

  return (
    <Card className="border-border bg-surface shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="p-3 sm:p-4 border-b border-border space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par référence, fournisseur, article, chantier…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-xl border border-border bg-surface-raised pl-9 pr-4 text-xs text-foreground placeholder:text-subtle-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Toutes les dates</option>
              <option value="this_month">Ce mois-ci</option>
              <option value="last_month">Mois dernier</option>
              <option value="custom_month">Mois précis…</option>
              <option value="this_year">Cette année</option>
            </select>

            {periodFilter === 'custom_month' && (
              <input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="h-9 rounded-xl border border-border bg-surface-raised px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none cursor-pointer"
              />
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillons</option>
              <option value="sent">Envoyées / En attente</option>
              <option value="partially_received">Partiellement reçues</option>
              <option value="received">Reçues & Soldées</option>
              <option value="cancelled">Annulées</option>
            </select>

            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-surface-raised px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Tous fournisseurs</option>
              {uniqueSuppliers.map((sup) => (
                <option key={sup} value={sup}>
                  {sup}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tableau compact sans slider horizontal */}
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-border bg-surface-raised/50 text-muted-foreground text-3xs font-bold uppercase tracking-wider">
            <th className="py-2.5 px-3 sm:px-4">Commande &amp; Dates</th>
            <th className="py-2.5 px-3">Fournisseur &amp; Chantier</th>
            <th className="py-2.5 px-3 hidden md:table-cell">Articles &amp; Réception</th>
            <th className="py-2.5 px-3 text-right">Montant HT</th>
            <th className="py-2.5 px-3 text-center">Statut</th>
            <th className="py-2.5 px-3 sm:px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filteredOrders.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-10 text-center text-muted-foreground">
                <p className="text-sm font-semibold">Aucun bon de commande trouvé</p>
                <p className="text-2xs text-subtle-foreground mt-1">
                  Créez une nouvelle commande fournisseur ou modifiez vos critères de recherche.
                </p>
              </td>
            </tr>
          ) : (
            filteredOrders.map((order) => {
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
                  className="hover:bg-surface-hover/50 transition-colors group"
                >
                  {/* 1. Commande & Dates */}
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-xs font-bold text-foreground bg-surface-raised px-1.5 py-0.5 rounded border border-border">
                        {order.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-3xs text-subtle-foreground">
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
                  <td className="py-3 px-3">
                    <p className="font-semibold text-foreground text-xs leading-snug">
                      {order.supplierName}
                    </p>
                    {order.missionRef ? (
                      <span className="inline-block font-mono text-3xs text-primary bg-primary/10 px-1 py-0.5 rounded mt-0.5">
                        Chantier : {order.missionRef}
                      </span>
                    ) : (
                      <span className="text-3xs text-muted-foreground">Réapprovisionnement Stock</span>
                    )}
                  </td>

                  {/* 3. Articles & Progression */}
                  <td className="py-3 px-3 hidden md:table-cell">
                    <p className="text-xs text-foreground font-medium">
                      {order.items.length} référence{order.items.length > 1 ? 's' : ''} ({totalItemsCount} unités)
                    </p>
                    {order.status !== 'draft' && order.status !== 'cancelled' && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-24 rounded-full bg-surface-raised overflow-hidden border border-border">
                          <div
                            className={`h-full transition-all ${
                              progressPct === 100 ? 'bg-success' : 'bg-warning'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-3xs font-mono font-semibold text-subtle-foreground">
                          {totalReceivedCount}/{totalItemsCount} ({progressPct}%)
                        </span>
                      </div>
                    )}
                  </td>

                  {/* 4. Montant HT */}
                  <td className="py-3 px-3 text-right">
                    <p className="font-bold text-foreground text-xs">
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
                  <td className="py-3 px-3 text-center">
                    <Badge
                      variant={PURCHASE_STATUS_VARIANTS[order.status]}
                      className="text-3xs py-0.5 px-2 font-semibold"
                    >
                      {PURCHASE_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>

                  {/* 6. Actions */}
                  <td className="py-3 px-3 sm:px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Voir / Imprimer */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onView(order)}
                        title="Voir le Bon de Commande / Imprimer"
                        className="size-6.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
                          className="size-6.5 p-0 text-primary hover:bg-primary/10 cursor-pointer"
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
                          className="size-6.5 p-0 text-success hover:bg-success/10 cursor-pointer"
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
                          className="size-6.5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                      )}

                      {/* Supprimer */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (
                            confirm(
                              `Êtes-vous sûr de vouloir supprimer la commande « ${order.reference} » ?`,
                            )
                          ) {
                            onDelete(order.id);
                          }
                        }}
                        title="Supprimer la commande"
                        className="size-6.5 p-0 text-muted-foreground hover:text-error cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Card>
  );
}
