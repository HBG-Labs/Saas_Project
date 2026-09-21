import { SelectField } from '@/components/ui/SelectField';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  HelpCircle,
  Info,
  Lightbulb,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ProToolUpgradeModal, useUserEntitlements } from '@/features/billing';
import { cn } from '@/lib/cn';
import { useEphemeralFlag } from '@/lib/use-ephemeral-flag';
import { useMetierHistory } from '../hooks/useMetierHistory';
import type { MetierInputValue, MetierToolDefinition, ReliabilityLevel } from '../types';

interface MetierToolRunnerProps {
  tool: MetierToolDefinition;
}

function getReliabilityBadge(level: ReliabilityLevel) {
  switch (level) {
    case 'simple':
      return {
        label: '🟢 Calcul direct',
        description: 'Calcul mathématique et physique direct',
        badgeVariant: 'success' as const,
        bgClass: 'bg-success/10 text-success border-success/20',
      };
    case 'indicative':
      return {
        label: '🟠 Calcul technique indicatif',
        description: 'Résultat dépendant d’hypothèses de chantier',
        badgeVariant: 'warning' as const,
        bgClass: 'bg-warning/10 text-warning border-warning/20',
      };
    case 'pro_validation':
      return {
        label: '🔴 Dimensionnement (Validation BE requise)',
        description: 'Étude d’avant-projet nécessitant validation bureau d’études / BE certifié',
        badgeVariant: 'error' as const,
        bgClass: 'bg-error/10 text-error border-error/20',
      };
  }
}

export function MetierToolRunner({ tool }: MetierToolRunnerProps) {
  // 1. Initialisation de l'état des champs à partir des valeurs par défaut
  const initialInputs = useMemo(() => {
    const obj: Record<string, MetierInputValue> = {};
    for (const f of tool.fields) {
      obj[f.id] = f.defaultValue;
    }
    return obj;
  }, [tool]);

  const { has } = useUserEntitlements();
  const isProUnlocked = has('pro_tools');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [inputs, setInputs] = useState<Record<string, MetierInputValue>>(initialInputs);
  const [inputToolSlug, setInputToolSlug] = useState(tool.slug);
  const [copied, signalerCopied] = useEphemeralFlag();
  const { addHistoryEntry } = useMetierHistory();

  // Réinitialiser pendant le rendu si l'outil change, sans peindre un résultat
  // calculé avec les valeurs de l'outil précédent.
  if (inputToolSlug !== tool.slug) {
    setInputToolSlug(tool.slug);
    setInputs(initialInputs);
  }

  // 2. Calcul dynamique en direct (uniquement si débloqué ou pour preview)
  const output = useMemo(() => {
    try {
      return tool.compute(inputs);
    } catch {
      return {
        primaryResult: '0',
        primaryLabel: 'Résultat',
        status: 'danger' as const,
        statusMessage: 'Erreur dans les paramètres saisis',
        details: [{ label: 'Erreur', value: 'Veuillez vérifier les valeurs saisies' }],
      };
    }
  }, [tool, inputs]);

  // 3. Sauvegarde automatique dans l'historique quand le calcul est stabilisé (utilisateurs Pro)
  useEffect(() => {
    if (
      isProUnlocked &&
      output.primaryResult &&
      output.primaryResult !== '0' &&
      output.status !== 'danger'
    ) {
      const timer = setTimeout(() => {
        addHistoryEntry({
          tradeSlug: tool.tradeSlug,
          toolSlug: tool.slug,
          toolTitle: tool.title,
          result: output.primaryResult,
          summary: output.details
            .map((d) => `${d.label}: ${d.value}`)
            .slice(0, 3)
            .join(' • '),
        });
      }, 1000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [tool, output, addHistoryEntry, isProUnlocked]);

  const handleInputChange = (fieldId: string, value: MetierInputValue) => {
    setInputs((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleReset = () => {
    setInputs(initialInputs);
  };

  const handleCopySummary = () => {
    if (!isProUnlocked) {
      setUpgradeModalOpen(true);
      return;
    }

    const lines = [
      `=== ${tool.title.toUpperCase()} ===`,
      `Résultat : ${output.primaryResult} ${output.primaryUnit ? `(${output.primaryUnit})` : ''}`,
      `Niveau de fiabilité : ${getReliabilityBadge(tool.reliabilityLevel).label}`,
      tool.standardReference ? `Norme de référence : ${tool.standardReference}` : '',
      '',
      '--- Paramètres saisis ---',
      ...tool.fields.map((f) => {
        const val = inputs[f.id];
        const optLabel = f.options?.find((o) => o.value === String(val))?.label;
        return `• ${f.label} : ${optLabel ?? val} ${f.unit ?? ''}`;
      }),
      '',
      '--- Détails du calcul ---',
      ...output.details.map((d) => `• ${d.label} : ${d.value}`),
      '',
      '--- Avertissement ---',
      'Calcul indicatif d’aide au dimensionnement. Doit être validé selon les règles de l’art et caractéristiques réelles du site.',
      `Généré via REZO360 Outils Métiers — ${new Date().toLocaleDateString('fr-FR')}`,
    ].filter(Boolean);

    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      signalerCopied();
    });
  };

  const reliability = getReliabilityBadge(tool.reliabilityLevel);

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* BANDEAU DE FIABILITÉ & NORME DE RÉFÉRENCE                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border-border flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              'text-2xs inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-bold',
              reliability.bgClass,
            )}
          >
            <ShieldCheck className="size-3.5" />
            <span>{reliability.label}</span>
          </span>

          {tool.standardReference && (
            <span className="text-muted-foreground text-2xs bg-surface-raised border-border/80 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1">
              <BookOpen className="text-primary size-3" />
              <span className="text-foreground/90 font-semibold">Norme :</span>
              <span>{tool.standardReference}</span>
            </span>
          )}
        </div>

        <p className="text-3xs text-muted-foreground italic">{reliability.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* COLONNE GAUCHE (7 cols) : FORMULAIRE DE SAISIE                */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="border-border bg-surface space-y-4 rounded-2xl p-4 shadow-xs sm:p-5">
            <div className="border-border flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-foreground text-sm font-bold tracking-wider uppercase">
                  Paramètres d’entrée
                </h2>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  Modifiez les valeurs ci-dessous pour recalculer instantanément
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="h-8 cursor-pointer gap-1.5 text-xs"
                title="Réinitialiser aux valeurs par défaut"
              >
                <RotateCcw className="size-3.5" />
                <span>Réinitialiser</span>
              </Button>
            </div>

            <div className="space-y-3.5">
              {tool.fields.map((field) => {
                const val = inputs[field.id] ?? field.defaultValue;

                if (field.type === 'select') {
                  return (
                    <div key={field.id} className="space-y-1">
                      <label
                        htmlFor={field.id}
                        className="text-foreground block text-xs font-semibold"
                      >
                        {field.label}
                      </label>
                      <div className="relative">
                        <SelectField
                          id={field.id}
                          value={String(val)}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className={cn(
                            'bg-surface border-border text-foreground h-10 w-full rounded-xl border px-3 text-xs font-medium',
                            'focus:ring-primary/40 focus:border-primary focus:ring-2 focus:outline-none',
                            'cursor-pointer transition-colors',
                          )}
                        >
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                      {field.helpText && (
                        <p className="text-3xs text-muted-foreground flex items-center gap-1">
                          <Info className="size-3 shrink-0" />
                          <span>{field.helpText}</span>
                        </p>
                      )}
                    </div>
                  );
                }

                if (field.type === 'boolean') {
                  return (
                    <div
                      key={field.id}
                      className="bg-surface-raised border-border flex items-center justify-between rounded-xl border p-3"
                    >
                      <div>
                        <span className="text-foreground text-xs font-semibold">{field.label}</span>
                        {field.helpText && (
                          <p className="text-3xs text-muted-foreground mt-0.5">{field.helpText}</p>
                        )}
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <span className="sr-only">{field.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleInputChange(field.id, e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="bg-border peer after:border-border peer-checked:bg-primary h-6 w-10 rounded-full peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                      </label>
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={field.id}
                        className="text-foreground block text-xs font-semibold"
                      >
                        {field.label}
                      </label>
                      {field.unit && (
                        <span className="text-3xs text-muted-foreground bg-surface-raised py-0.2 border-border rounded border px-1.5 font-mono font-bold">
                          {field.unit}
                        </span>
                      )}
                    </div>

                    <Input
                      id={field.id}
                      label={field.label}
                      hideLabel
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={String(val)}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        handleInputChange(
                          field.id,
                          field.type === 'number'
                            ? e.target.valueAsNumber || e.target.value
                            : e.target.value,
                        )
                      }
                      className="font-mono text-xs"
                    />
                    {field.helpText && (
                      <p className="text-3xs text-muted-foreground flex items-center gap-1">
                        <Info className="size-3 shrink-0" />
                        <span>{field.helpText}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Hypothèses & Limites Techniques */}
          {((tool.assumptions && tool.assumptions.length > 0) ||
            (tool.limits && tool.limits.length > 0)) && (
            <Card className="border-border bg-surface space-y-3 rounded-2xl p-4 shadow-xs sm:p-5">
              <h3 className="text-muted-foreground border-border flex items-center gap-1.5 border-b pb-2 text-xs font-bold tracking-wider uppercase">
                <CheckCircle2 className="text-primary size-3.5" />
                <span>Hypothèses de calcul & Limites d’application</span>
              </h3>

              {tool.assumptions && tool.assumptions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-3xs text-foreground/80 font-bold tracking-wider uppercase">
                    Hypothèses retenues :
                  </span>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                    {tool.assumptions.map((ass, i) => (
                      <li key={i} className="leading-relaxed">
                        {ass}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tool.limits && tool.limits.length > 0 && (
                <div className="border-border/50 space-y-1.5 border-t pt-2">
                  <span className="text-3xs text-warning flex items-center gap-1 font-bold tracking-wider uppercase">
                    <AlertTriangle className="size-3" />
                    <span>Limites d’utilisation :</span>
                  </span>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                    {tool.limits.map((lim, i) => (
                      <li key={i} className="leading-relaxed">
                        {lim}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* COLONNE DROITE (5 cols) : RÉSULTATS, DÉTAILS & CONSEILS       */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-5">
          {/* Encart Résultat Principal */}
          <Card
            className={cn(
              'relative overflow-hidden rounded-lg border p-5 transition-colors duration-200',
              !isProUnlocked
                ? 'border-primary/40 bg-primary-subtle'
                : output.status === 'danger'
                  ? 'border-error/50 bg-error/5'
                  : output.status === 'warning'
                    ? 'border-warning/50 bg-warning/5'
                    : 'border-primary/40 bg-primary-subtle',
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-2xs text-primary font-extrabold tracking-wider uppercase">
                {output.primaryLabel ?? 'Résultat principal'}
              </span>
              {!isProUnlocked ? (
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="border-primary/30 bg-surface text-primary hover:bg-surface-hover text-3xs inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 font-bold transition-colors"
                  title="Débloquer l'export et la copie avec les forfaits Pro"
                >
                  <Sparkles className="text-primary size-3" />
                  <span>Débloquer (Pro)</span>
                </button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="text-3xs bg-surface/80 hover:bg-surface h-7 cursor-pointer gap-1 px-2 font-semibold"
                  title="Copier le résumé complet"
                >
                  {copied ? (
                    <>
                      <Check className="text-success size-3" />
                      <span className="text-success font-bold">Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copier</span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {!isProUnlocked ? (
              <div className="border-primary/30 bg-surface my-3 space-y-3 rounded-lg border p-4 text-center">
                <div className="bg-primary-subtle border-primary/30 text-primary mx-auto flex size-9 items-center justify-center rounded-lg border">
                  <Sparkles className="text-primary size-4.5" />
                </div>

                <div className="space-y-1">
                  <div className="bg-primary-subtle border-primary/30 text-primary text-3xs inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-bold tracking-wider uppercase">
                    <Lock className="size-2.5" />
                    <span>Calculateur Certifié Pro</span>
                  </div>
                  <h4 className="text-foreground text-xs font-bold">
                    Résultat normé et fiches de calcul verrouillés
                  </h4>
                  <p className="text-3xs text-muted-foreground mx-auto max-w-xs leading-relaxed">
                    Débloquez l’accès illimité aux 36 moteurs de calcul, aux exports PDF officiels
                    et à l'historique d'équipe.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition-colors"
                >
                  <Sparkles className="size-3.5" />
                  <span>Débloquer l’accès Pro</span>
                  <span className="bg-primary-foreground/15 border-primary-foreground/20 text-3xs rounded-md border px-1.5 py-0.5 font-bold tracking-wider uppercase">
                    Dès 39 €/m
                  </span>
                </button>
              </div>
            ) : (
              <div className="my-2">
                <div className="text-foreground font-mono text-2xl font-black tracking-tight sm:text-3xl">
                  {output.primaryResult}
                </div>
                {output.primaryUnit && (
                  <p className="text-muted-foreground mt-1 text-xs font-semibold">
                    {output.primaryUnit}
                  </p>
                )}
              </div>
            )}

            {isProUnlocked && output.statusMessage && (
              <div
                className={cn(
                  'mt-3 flex items-start gap-2 rounded-xl p-2.5 text-xs font-medium',
                  output.status === 'danger'
                    ? 'bg-error/10 text-error border-error/20 border'
                    : 'bg-warning/10 text-warning-foreground border-warning/20 border',
                )}
              >
                <HelpCircle className="mt-0.5 size-4 shrink-0" />
                <span>{output.statusMessage}</span>
              </div>
            )}
          </Card>

          {/* Détails du calcul */}
          {output.details && output.details.length > 0 && (
            <Card className="border-border bg-surface relative space-y-2.5 overflow-hidden rounded-lg p-4 shadow-none sm:p-5">
              <div className="border-border flex items-center justify-between border-b pb-2">
                <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                  Détails & Grandeurs calculées
                </h3>
                {!isProUnlocked && (
                  <span className="text-3xs text-primary dark:text-primary bg-primary/10 border-primary/25 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold">
                    <Lock className="size-2.5" />
                    <span>Inclus en Pro</span>
                  </span>
                )}
              </div>

              <div
                className={cn(
                  'divide-border/60 divide-y',
                  !isProUnlocked && 'pointer-events-none opacity-50 blur-[2.5px] select-none',
                )}
              >
                {output.details.map((row, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between gap-2 py-2 text-xs',
                      row.highlight && 'font-bold',
                    )}
                  >
                    <span className="text-muted-foreground truncate">{row.label}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span
                        className={cn(
                          'text-foreground font-mono',
                          row.highlight && 'text-primary font-extrabold',
                        )}
                      >
                        {row.value}
                      </span>
                      {row.badge && (
                        <Badge
                          variant={row.badgeVariant ?? 'neutral'}
                          className="text-3xs px-1.5 py-0"
                        >
                          {row.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isProUnlocked && (
                <div className="bg-surface/70 absolute inset-x-0 top-10 bottom-0 flex flex-col items-center justify-center p-4 backdrop-blur-[2px]">
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="border-primary/40 bg-surface text-primary hover:border-primary/60 hover:bg-surface-hover inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold transition-colors"
                  >
                    <Sparkles className="text-primary size-3.5" />
                    <span>Débloquer les grandeurs détaillées (Pro)</span>
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Formule & Explication Technique */}
          {output.formulaExplanation && (
            <Card className="border-border bg-surface-raised/60 space-y-1.5 rounded-lg p-4 shadow-none">
              <div className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                <Info className="text-primary size-3.5" />
                <span>Formule & Référence mathématique</span>
              </div>
              <p className="text-muted-foreground bg-surface border-border/80 rounded-lg border p-2.5 font-mono text-xs leading-relaxed">
                {output.formulaExplanation}
              </p>
            </Card>
          )}

          {/* Conseils de terrain */}
          {output.advice && output.advice.length > 0 && (
            <div className="bg-warning/10 border-warning/20 space-y-1.5 rounded-lg border p-4 text-xs">
              <div className="text-warning flex items-center gap-1.5 font-bold">
                <Lightbulb className="size-4 shrink-0" />
                <span>Conseils de mise en œuvre</span>
              </div>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
                {output.advice.map((adv, idx) => (
                  <li key={idx} className="leading-snug">
                    {adv}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Avertissement réglementaire & non-surpromesse */}
          <div className="bg-surface-raised border-border text-3xs text-muted-foreground space-y-1 rounded-2xl border p-3.5 leading-relaxed">
            <div className="text-foreground/90 flex items-center gap-1 font-bold">
              <AlertTriangle className="text-warning size-3" />
              <span>Avertissement & Règle de l’art</span>
            </div>
            <p>
              Ce calculateur fournit une estimation technique d’aide au dimensionnement basée sur
              les normes en vigueur et les paramètres saisis. Il ne se substitue pas à une étude
              d’exécution réalisée par un bureau d’études certifié ni aux préconisations spécifiques
              des fabricants.
            </p>
          </div>
        </div>
      </div>

      {/* Modale de montée en gamme pour débloquer les calculateurs métiers */}
      <ProToolUpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        toolName={tool.title}
        tradeName={tool.tradeSlug}
      />
    </div>
  );
}
