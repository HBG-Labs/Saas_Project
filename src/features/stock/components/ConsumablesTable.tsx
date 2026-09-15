import { SelectField } from '@/components/ui/SelectField';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Edit2,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { StockConsumable } from '../types/stock.types';

interface ConsumablesTableProps {
  consumables: StockConsumable[];
  onEdit: (item: StockConsumable) => void;
  onDelete: (id: string) => void;
  onQuickAdjust: (id: string, delta: number) => void;
  onRecordMovement: (item: StockConsumable, defaultType?: 'in' | 'out') => void;
  onOrder?: (item: StockConsumable) => void;
}

export function ConsumablesTable({
  consumables,
  onEdit,
  onDelete,
  onQuickAdjust,
  onRecordMovement,
  onOrder,
}: ConsumablesTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'ok'>('all');
  const [itemToDelete, setItemToDelete] = useState<StockConsumable | null>(null);

  const filteredItems = useMemo(() => {
    return consumables.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q));

      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

      const isLow = item.quantityInStock <= item.minThreshold;
      const matchesStatus =
        stockStatusFilter === 'all' ||
        (stockStatusFilter === 'low' && isLow) ||
        (stockStatusFilter === 'ok' && !isLow);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [consumables, search, categoryFilter, stockStatusFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set(consumables.map((c) => c.category));
    return Array.from(cats);
  }, [consumables]);

  return (
    <Card className="border-border/80 bg-surface overflow-x-auto shadow-xs">
      {/* Barre de recherche et filtres */}
      <div className="border-border space-y-3 border-b p-3 sm:p-4">
        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
          {/* Champ de recherche */}
          <div className="flex-1">
            <Input
              label="Rechercher un article en stock"
              hideLabel
              placeholder="Rechercher par référence, désignation, emplacement, fournisseur…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leadingIcon={<Search aria-hidden="true" />}
              className="bg-surface-raised"
            />
          </div>

          {/* Filtres déroulants */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <SelectField
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9"
            >
              <option value="all">Toutes catégories</option>
              {uniqueCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>

            <SelectField
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as 'all' | 'low' | 'ok')}
              aria-label="Filtrer par niveau de stock"
              className="border-border bg-surface-raised text-foreground focus:border-primary focus:ring-primary/25 h-11 min-w-0 rounded-xl border px-2.5 py-1 text-xs focus:ring-2 focus:outline-none sm:h-9"
            >
              <option value="all">Tous niveaux</option>
              <option value="low">Stock faible</option>
              <option value="ok">Stock suffisant</option>
            </SelectField>
          </div>
        </div>
        <p className="text-muted-foreground text-3xs" aria-live="polite">
          {filteredItems.length} article{filteredItems.length !== 1 ? 's' : ''} affiché
          {filteredItems.length !== 1 ? 's' : ''}
        </p>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-muted-foreground px-4 py-12 text-center md:hidden">
          <div className="bg-surface-sunken mx-auto flex size-11 items-center justify-center rounded-2xl">
            <Boxes className="size-5" aria-hidden="true" />
          </div>
          <p className="text-foreground mt-3 text-sm font-semibold">Aucun article trouvé</p>
          <p className="text-subtle-foreground mx-auto mt-1 max-w-sm text-xs">
            Modifiez vos filtres ou créez un nouvel article.
          </p>
        </div>
      ) : (
        <div className="divide-border divide-y md:hidden">
          {filteredItems.map((item) => {
            const isLow = item.quantityInStock <= item.minThreshold;
            const totalItemValue = item.quantityInStock * (item.unitPriceEur ?? 0);

            return (
              <article key={item.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="bg-surface-sunken border-border text-foreground text-3xs rounded-md border px-1.5 py-0.5 font-mono font-bold">
                        {item.reference}
                      </span>
                      <Badge variant="outline" className="text-3xs px-1.5 py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <h3 className="text-foreground mt-1.5 text-sm font-bold">{item.name}</h3>
                    <p className="text-muted-foreground text-3xs mt-0.5">
                      {item.location}
                      {item.supplier ? ` · ${item.supplier}` : ''}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-xl border px-3 py-2 text-right ${
                      isLow
                        ? 'border-warning/30 bg-warning/10 text-warning'
                        : 'border-success/20 bg-success/10 text-success'
                    }`}
                  >
                    <p className="font-mono text-lg leading-none font-extrabold">
                      {item.quantityInStock}
                    </p>
                    <p className="text-3xs mt-1 font-semibold">{item.unit}</p>
                  </div>
                </div>

                <div className="bg-surface-sunken/45 border-border/70 grid grid-cols-2 gap-3 rounded-xl border p-3">
                  <div>
                    <p className="text-muted-foreground text-3xs">Seuil d’alerte</p>
                    <p className="text-foreground mt-0.5 text-xs font-semibold">
                      {item.minThreshold} {item.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-3xs">Valeur HT</p>
                    <p className="text-foreground mt-0.5 text-xs font-semibold">
                      {item.unitPriceEur !== undefined ? `${totalItemValue.toFixed(2)} €` : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="bg-surface-raised border-border inline-flex items-center rounded-xl border p-0.5">
                    <button
                      type="button"
                      onClick={() => onQuickAdjust(item.id, -1)}
                      disabled={item.quantityInStock <= 0}
                      aria-label={`Retirer une unité de ${item.name}`}
                      className="text-muted-foreground hover:bg-surface-hover hover:text-foreground min-h-touch min-w-touch flex items-center justify-center rounded-lg disabled:opacity-30"
                    >
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="text-foreground min-w-8 text-center font-mono text-xs font-bold">
                      {item.quantityInStock}
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickAdjust(item.id, 1)}
                      aria-label={`Ajouter une unité à ${item.name}`}
                      className="text-muted-foreground hover:bg-surface-hover hover:text-foreground min-h-touch min-w-touch flex items-center justify-center rounded-lg"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRecordMovement(item, 'in')}
                      aria-label={`Déclarer une entrée pour ${item.name}`}
                      className="text-success min-h-touch min-w-touch p-0"
                    >
                      <ArrowDownLeft className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRecordMovement(item, 'out')}
                      aria-label={`Déclarer une sortie pour ${item.name}`}
                      className="text-error min-h-touch min-w-touch p-0"
                    >
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(item)}
                      aria-label={`Modifier ${item.name}`}
                      className="min-h-touch min-w-touch p-0"
                    >
                      <Edit2 className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setItemToDelete(item)}
                      aria-label={`Supprimer ${item.name}`}
                      className="text-muted-foreground hover:text-error min-h-touch min-w-touch p-0"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {onOrder ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOrder(item)}
                    className="min-h-touch border-warning/30 text-warning hover:bg-warning/10 w-full gap-2"
                  >
                    <ShoppingCart className="size-3.5" aria-hidden="true" />
                    Commander auprès du fournisseur
                  </Button>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* Tableau desktop */}
      <table className="hidden w-full min-w-[760px] border-collapse text-left text-xs md:table">
        <thead>
          <tr className="border-border bg-surface-raised/50 text-muted-foreground text-3xs border-b font-bold tracking-wider uppercase">
            <th className="px-3 py-2.5 sm:px-4">Article &amp; Réf.</th>
            <th className="px-3 py-2.5 text-center sm:text-left">Stock &amp; Seuil</th>
            <th className="hidden px-3 py-2.5 text-right md:table-cell">Valorisation HT</th>
            <th className="px-3 py-2.5 text-center">Ajustement</th>
            <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-muted-foreground py-10 text-center">
                <p className="text-sm font-semibold">Aucun article trouvé</p>
                <p className="text-2xs text-subtle-foreground mt-1">
                  Modifiez votre recherche ou créez un nouvel article.
                </p>
              </td>
            </tr>
          ) : (
            filteredItems.map((item) => {
              const isLow = item.quantityInStock <= item.minThreshold;
              const totalItemValue = item.quantityInStock * (item.unitPriceEur ?? 0);

              return (
                <tr key={item.id} className="hover:bg-surface-hover/50 group transition-colors">
                  {/* 1. Article, Réf, Catégorie & Emplacement */}
                  <td className="px-3 py-3 sm:px-4">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="bg-surface-raised border-border text-3xs text-foreground rounded-md border px-1.5 py-0.5 font-mono font-bold">
                        {item.reference}
                      </span>
                      <Badge variant="outline" className="text-3xs px-1.5 py-0">
                        {item.category}
                      </Badge>
                    </div>
                    <p className="text-foreground text-xs leading-snug font-semibold">
                      {item.name}
                    </p>
                    <div className="text-3xs text-subtle-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" />
                        {item.location}
                      </span>
                      {item.supplier && <span>• Fournisseur : {item.supplier}</span>}
                    </div>
                  </td>

                  {/* 2. Stock & Seuil */}
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-sm font-bold ${
                            isLow ? 'text-warning font-extrabold' : 'text-foreground'
                          }`}
                        >
                          {item.quantityInStock}
                        </span>
                        <span className="text-3xs text-muted-foreground font-semibold uppercase">
                          {item.unit}
                        </span>
                        {isLow && (
                          <span
                            title={`Sous le seuil d'alerte de ${item.minThreshold} ${item.unit}`}
                          >
                            <AlertTriangle className="text-warning size-3.5 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="text-3xs text-subtle-foreground">
                        Seuil min : {item.minThreshold} {item.unit}
                      </span>
                    </div>
                  </td>

                  {/* 3. Valorisation */}
                  <td className="hidden px-3 py-3 text-right md:table-cell">
                    <p className="text-foreground font-bold">
                      {item.unitPriceEur !== undefined ? `${totalItemValue.toFixed(2)} €` : '—'}
                    </p>
                    <p className="text-3xs text-subtle-foreground">
                      {item.unitPriceEur !== undefined
                        ? `${item.unitPriceEur.toFixed(2)} € / ${item.unit}`
                        : '—'}
                    </p>
                  </td>

                  {/* 4. Ajustement rapide */}
                  <td className="px-3 py-3 text-center">
                    <div className="bg-surface-raised border-border inline-flex items-center gap-0.5 rounded-lg border p-0.5">
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, -1)}
                        disabled={item.quantityInStock <= 0}
                        title="Consommer 1 (-1)"
                        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 sm:size-7"
                      >
                        <Minus className="size-2.5" />
                      </button>
                      <span className="text-2xs text-foreground px-1 font-mono font-semibold">
                        {item.quantityInStock}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickAdjust(item.id, 1)}
                        title="Ajouter 1 (+1)"
                        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-10 cursor-pointer items-center justify-center rounded-md transition-colors sm:size-7"
                      >
                        <Plus className="size-2.5" />
                      </button>
                    </div>
                  </td>

                  {/* 5. Actions */}
                  <td className="px-3 py-3 text-right sm:px-4">
                    <div className="flex items-center justify-end gap-1">
                      {onOrder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onOrder(item)}
                          title="Commander auprès du fournisseur"
                          className="text-warning hover:bg-warning/10 size-10 cursor-pointer p-0 sm:size-8"
                        >
                          <ShoppingCart className="size-3.5" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'in')}
                        title="Déclarer une entrée (BL)"
                        className="text-success hover:bg-success/10 size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <ArrowDownLeft className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRecordMovement(item, 'out')}
                        title="Déclarer une sortie chantier"
                        className="text-error hover:bg-error/10 size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(item)}
                        title="Modifier l'article"
                        aria-label={`Modifier ${item.name}`}
                        className="text-muted-foreground hover:text-foreground size-10 cursor-pointer p-0 sm:size-8"
                      >
                        <Edit2 className="size-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setItemToDelete(item)}
                        title="Supprimer l'article"
                        aria-label={`Supprimer ${item.name}`}
                        className="text-muted-foreground hover:text-error size-10 cursor-pointer p-0 sm:size-8"
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

      <Modal
        open={itemToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setItemToDelete(null);
        }}
        title="Supprimer l’article"
        description={
          itemToDelete
            ? `« ${itemToDelete.name} » sera retiré définitivement du stock.`
            : 'Confirmez la suppression de cet article.'
        }
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setItemToDelete(null)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (itemToDelete) {
                  onDelete(itemToDelete.id);
                  setItemToDelete(null);
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
          Cette action est irréversible. L’article et son niveau de stock ne seront plus visibles
          dans le parc de consommables.
        </p>
      </Modal>
    </Card>
  );
}
