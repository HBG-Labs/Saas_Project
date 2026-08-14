import { BookOpen, Calculator, Check, Key, HelpCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export function ScientificCalculatorDocsModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
      >
        <BookOpen className="size-4" />
        <span>Guide & Documentation complet</span>
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Guide & Documentation Technique — Calculatrice Scientifique"
        description="Manuel d'utilisation complet, guide des raccourcis clavier, fonctions mathématiques et règles d'angles."
      >
        <div className="space-y-6 text-xs text-foreground max-h-[75vh] overflow-y-auto pr-1">
          {/* Section 1 : Prise en main & Afficheur Bi-ligne */}
          <section className="space-y-2 border-b border-border/40 pb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Calculator className="size-4 text-primary" />
              1. Afficheur Bi-ligne Cockpit & Saisie Continue
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              La calculatrice dispose d&apos;un écran bi-ligne à pré-évaluation continue. La ligne supérieure affiche l&apos;expression complète saisie, tandis que la ligne inférieure calcule le résultat en temps réel.
            </p>
            <div className="bg-surface-sunken rounded-xl p-3 border border-border/60 space-y-1 font-mono text-2xs">
              <div className="text-subtle-foreground">Expression : sin(45) + log(1000)</div>
              <div className="text-primary font-bold text-xs">= 3.70710678</div>
            </div>
            <p className="text-muted-foreground leading-relaxed text-2xs">
              💡 <strong>Astuce :</strong> Lorsque vous tapez un opérateur intermédiaire (`12 +`), le pré-calcul nettoie automatiquement l&apos;opérateur pendant afin d&apos;éviter de flasher un message d&apos;erreur rouge. L&apos;évaluation stricte et le stockage dans l&apos;historique s&apos;exécutent lors de la pression sur `=`.
            </p>
          </section>

          {/* Section 2 : DEG vs RAD */}
          <section className="space-y-2 border-b border-border/40 pb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              2. Modes d&apos;Angles : DEG (Degrés) vs RAD (Radians)
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Le basculeur d&apos;angles modifie le comportement des fonctions trigonométriques (`sin`, `cos`, `tan`, `asin`, `acos`, `atan`) :
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-2xs">
              <div className="bg-surface rounded-lg p-3 border border-border/60 space-y-1">
                <Badge variant="primary" className="text-2xs mb-1">Mode DEG (Degrés)</Badge>
                <p className="text-muted-foreground">Angles mesurés de 0° à 360° (défaut terrain).</p>
                <div className="font-mono text-foreground font-bold">sin(90) = 1</div>
                <div className="font-mono text-foreground font-bold">cos(60) = 0.5</div>
              </div>
              <div className="bg-surface rounded-lg p-3 border border-border/60 space-y-1">
                <Badge variant="neutral" className="text-2xs mb-1">Mode RAD (Radians)</Badge>
                <p className="text-muted-foreground">Angles mesurés de 0 à 2π (analyse théorique).</p>
                <div className="font-mono text-foreground font-bold">sin(π / 2) = 1</div>
                <div className="font-mono text-foreground font-bold">cos(π) = -1</div>
              </div>
            </div>
          </section>

          {/* Section 3 : Tableau des Raccourcis Clavier Physique */}
          <section className="space-y-2 border-b border-border/40 pb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Key className="size-4 text-primary" />
              3. Tableau des Raccourcis Clavier Physique NATIVE
            </h3>
            <div className="bg-surface border-border/60 scroll-x rounded-xl border">
              <table className="w-full text-left text-2xs">
                <thead className="bg-surface-sunken border-b border-border/40 font-semibold text-foreground">
                  <tr>
                    <th className="p-2">Touche Clavier</th>
                    <th className="p-2">Action / Fonction</th>
                    <th className="p-2">Exemple</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="p-2 text-primary font-bold">0 - 9 et .</td>
                    <td className="p-2 text-muted-foreground font-sans">Saisie des chiffres et décimales</td>
                    <td className="p-2">3.14</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">+ - * /</td>
                    <td className="p-2 text-muted-foreground font-sans">Opérateurs arithmétiques</td>
                    <td className="p-2">12 * 4</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">P ou p</td>
                    <td className="p-2 text-muted-foreground font-sans">Insère la constante Pi (π)</td>
                    <td className="p-2">2 * π</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">E ou e</td>
                    <td className="p-2 text-muted-foreground font-sans">Insère la constante Euler (e)</td>
                    <td className="p-2">e^2</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">^ % !</td>
                    <td className="p-2 text-muted-foreground font-sans">Puissance, Pourcentage, Factorielle</td>
                    <td className="p-2">2^3, 5!, 50%</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">Entrée ou =</td>
                    <td className="p-2 text-muted-foreground font-sans">Exécute et sauvegarde le calcul</td>
                    <td className="p-2">Résultat + Historique</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">Retour arrière</td>
                    <td className="p-2 text-muted-foreground font-sans">Efface le dernier token ou fonction</td>
                    <td className="p-2">Supprime &apos;sin(&apos;</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-primary font-bold">Échap (Esc)</td>
                    <td className="p-2 text-muted-foreground font-sans">Efface tout (AC)</td>
                    <td className="p-2">Réinitialisation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4 : Constantes Physiques */}
          <section className="space-y-2 border-b border-border/40 pb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" />
              4. Constantes Physiques et d&apos;Ingénierie
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-2xs">
              <div className="bg-surface-sunken p-2.5 rounded-lg border border-border/60">
                <span className="text-subtle-foreground block font-sans">Pi (π)</span>
                <span className="text-foreground font-bold">3.14159265...</span>
              </div>
              <div className="bg-surface-sunken p-2.5 rounded-lg border border-border/60">
                <span className="text-subtle-foreground block font-sans">Euler (e)</span>
                <span className="text-foreground font-bold">2.71828182...</span>
              </div>
              <div className="bg-surface-sunken p-2.5 rounded-lg border border-border/60">
                <span className="text-subtle-foreground block font-sans">Vitesse lumière (c)</span>
                <span className="text-foreground font-bold">299 792 458 m/s</span>
              </div>
            </div>
          </section>

          {/* Section 5 : Historique & Quotas Tarifaires */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Check className="size-4 text-success" />
              5. Journal d&apos;Historique & Quotas Tarifaires
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Le journal d&apos;historique conserve vos calculs d&apos;une session à l&apos;autre :
            </p>
            <ul className="list-disc list-inside text-2xs text-muted-foreground space-y-1">
              <li><strong>Formule Gratuite :</strong> Conservation des 10 derniers calculs.</li>
              <li><strong>Formules Pro & Équipe :</strong> Historique illimité + exportation au format CSV.</li>
            </ul>
          </section>

          <div className="pt-2 flex justify-end">
            <Button size="sm" onClick={() => setOpen(false)}>
              Fermer le manuel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
