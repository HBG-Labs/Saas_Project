import { AlertTriangle, ArrowDownLeft, ShoppingCart } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { StockConsumable } from '../types/stock.types';

interface StockAlertsBannerProps {
  lowStockArticles: StockConsumable[];
  onOrder: (article: StockConsumable) => void;
  onMovement: (article: StockConsumable) => void;
}

export function StockAlertsBanner({
  lowStockArticles,
  onOrder,
  onMovement,
}: StockAlertsBannerProps) {
  if (lowStockArticles.length === 0) return null;

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 dark:bg-warning/10 p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <AlertTriangle className="size-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {lowStockArticles.length}{' '}
              {lowStockArticles.length > 1 ? 'articles sous le seuil critique' : 'article sous le seuil critique'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Passez commande auprès de vos fournisseurs ou déclarez une entrée directe en stock.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-1">
        {lowStockArticles.map((article) => (
          <div
            key={article.id}
            className="flex flex-col justify-between gap-2.5 rounded-xl border border-warning/20 bg-surface/80 p-3 shadow-2xs backdrop-blur-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="font-mono text-3xs font-bold text-muted-foreground uppercase">
                  {article.reference}
                </span>
                <Badge variant="warning" className="text-3xs py-0 px-1.5">
                  Reste : {article.quantityInStock} {article.unit}
                </Badge>
              </div>
              <p className="text-xs font-semibold text-foreground truncate" title={article.name}>
                {article.name}
              </p>
              <p className="text-3xs text-subtle-foreground mt-0.5">
                Seuil min. : {article.minThreshold} {article.unit} • {article.location}
              </p>
            </div>

            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/40">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMovement(article)}
                className="h-7 text-2xs px-2 font-medium text-muted-foreground hover:text-foreground cursor-pointer gap-1"
                title="Déclarer une entrée / mouvement direct"
              >
                <ArrowDownLeft className="size-3 text-success" />
                <span>Mouvement</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => onOrder(article)}
                className="h-7 text-2xs px-2.5 font-bold border-warning/40 bg-warning/10 hover:bg-warning/20 text-warning hover:text-warning cursor-pointer gap-1 shadow-2xs"
                title="Créer un bon de commande dans le volet Achats"
              >
                <ShoppingCart className="size-3" />
                <span>Commander</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
