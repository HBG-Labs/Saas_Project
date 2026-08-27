import { ArrowRight, Bookmark, Calculator, FileSpreadsheet, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { ROUTES } from '@/config/routes';

export function ProblemSection() {
  return (
    <section className="relative border-t border-border/60 bg-surface-sunken/40 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
            Ne perdez plus votre temps entre de multiples outils dispersés
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base sm:text-lg">
            Sur le terrain ou en bureau d&apos;études, l&apos;imprécision et la dispersion des outils de calcul réduisent l&apos;efficacité. REZO360 rassemble tout au même endroit.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {/* L'ancienne méthode */}
          <div className="bg-surface border-error/20 shadow-raised relative rounded-2xl border p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="bg-error/10 text-error flex size-9 items-center justify-center rounded-lg">
                <XCircle className="size-5" />
              </span>
              <div>
                <h3 className="text-foreground font-semibold text-lg">L&apos;ancienne méthode dispersée</h3>
                <p className="text-subtle-foreground text-xs">Perte de temps et risques d&apos;erreur de saisie</p>
              </div>
            </div>

            <ul className="mt-6 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <FileSpreadsheet className="size-5 text-error/80 shrink-0 mt-0.5" />
                <span>Fichiers Excel personnalisés non à jour ou modifiés accidentellement</span>
              </li>
              <li className="flex items-start gap-3">
                <Calculator className="size-5 text-error/80 shrink-0 mt-0.5" />
                <span>Calculatrices physiques sans historique ni possibilité d&apos;exporter les rapports</span>
              </li>
              <li className="flex items-start gap-3">
                <Bookmark className="size-5 text-error/80 shrink-0 mt-0.5" />
                <span>Dizaines de favoris de navigateurs dispersés et parfois inaccessibles hors-ligne</span>
              </li>
              <li className="flex items-start gap-3">
                <FileText className="size-5 text-error/80 shrink-0 mt-0.5" />
                <span>Prise de notes sur papier avec risque de perte des mesures de recette</span>
              </li>
            </ul>
          </div>

          {/* L'espace REZO360 */}
          <div className="bg-surface border-glow glow-cyan shadow-modal relative rounded-2xl border border-primary/30 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="bg-success/10 text-success flex size-9 items-center justify-center rounded-lg">
                <CheckCircle className="size-5" />
              </span>
              <div>
                <h3 className="text-foreground font-semibold text-lg">L&apos;espace unifié REZO360</h3>
                <p className="text-subtle-foreground text-xs">Précision, rapidité et traçabilité immédiates</p>
              </div>
            </div>

            <ul className="mt-6 space-y-4 text-sm text-foreground font-medium">
              <li className="flex items-start gap-3">
                <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <span>Formules rigoureusement conformes aux normes (ITU, IEEE, UTE C 15-105)</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <span>Recherche universelle instantanée via <strong>⌘K</strong> disponible partout</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <span>Historique de vos calculs et favoris synchronisés sur mobile et desktop</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="size-5 text-primary shrink-0 mt-0.5" />
                <span>Exportation propre des résultats pour intégration dans vos PV de recette</span>
              </li>
            </ul>

            <div className="mt-8 pt-4 border-t border-border/50 flex justify-end">
              <Link
                to={ROUTES.register}
                className="text-primary hover:text-primary-hover text-xs font-semibold flex items-center gap-1.5"
              >
                Passer à l&apos;espace unifié <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
