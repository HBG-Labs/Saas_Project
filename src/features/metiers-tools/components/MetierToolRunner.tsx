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
import type { MetierToolDefinition, ReliabilityLevel } from '../types';

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
    const obj: Record<string, any> = {};
    for (const f of tool.fields) {
      obj[f.id] = f.defaultValue;
    }
    return obj;
  }, [tool]);

  const { has } = useUserEntitlements();
  const isProUnlocked = has('pro_tools');
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [inputs, setInputs] = useState<Record<string, any>>(initialInputs);
  const [copied, signalerCopied] = useEphemeralFlag();
  const { addHistoryEntry } = useMetierHistory();

  // Réinitialiser si l'outil change
  useEffect(() => {
    setInputs(initialInputs);
  }, [initialInputs]);

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
    if (isProUnlocked && output.primaryResult && output.primaryResult !== '0' && output.status !== 'danger') {
      const timer = setTimeout(() => {
        addHistoryEntry({
          tradeSlug: tool.tradeSlug,
          toolSlug: tool.slug,
          toolTitle: tool.title,
          result: output.primaryResult,
          summary: output.details.map((d) => `${d.label}: ${d.value}`).slice(0, 3).join(' • '),
        });
      }, 1000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [tool, output, addHistoryEntry, isProUnlocked]);

  const handleInputChange = (fieldId: string, value: any) => {
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

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      signalerCopied();
    });
  };

  const reliability = getReliabilityBadge(tool.reliabilityLevel);

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* BANDEAU DE FIABILITÉ & NORME DE RÉFÉRENCE                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface border border-border text-xs shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-2xs', reliability.bgClass)}>
            <ShieldCheck className="size-3.5" />
            <span>{reliability.label}</span>
          </span>

          {tool.standardReference && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground text-2xs bg-surface-raised px-2.5 py-1 rounded-lg border border-border/80">
              <BookOpen className="size-3 text-primary" />
              <span className="font-semibold text-foreground/90">Norme :</span>
              <span>{tool.standardReference}</span>
            </span>
          )}
        </div>

        <p className="text-3xs text-muted-foreground italic">
          {reliability.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* COLONNE GAUCHE (7 cols) : FORMULAIRE DE SAISIE                */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 sm:p-5 rounded-2xl border-border bg-surface shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
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
                className="gap-1.5 text-xs cursor-pointer h-8"
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
                        className="block text-xs font-semibold text-foreground"
                      >
                        {field.label}
                      </label>
                      <div className="relative">
                        <SelectField
                          id={field.id}
                          value={String(val)}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className={cn(
                            'w-full h-10 px-3 rounded-xl bg-surface border border-border text-foreground text-xs font-medium',
                            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
                            'transition-colors cursor-pointer',
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
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-raised border border-border"
                    >
                      <div>
                        <span className="text-xs font-semibold text-foreground">{field.label}</span>
                        {field.helpText && (
                          <p className="text-3xs text-muted-foreground mt-0.5">{field.helpText}</p>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(val)}
                          onChange={(e) => handleInputChange(field.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                    </div>
                  );
                }

                return (
                  <div key={field.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={field.id}
                        className="block text-xs font-semibold text-foreground"
                      >
                        {field.label}
                      </label>
                      {field.unit && (
                        <span className="text-3xs font-mono font-bold text-muted-foreground bg-surface-raised px-1.5 py-0.2 rounded border border-border">
                          {field.unit}
                        </span>
                      )}
                    </div>

                    <Input
                      id={field.id}
                      label={field.label}
                      hideLabel
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={val}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder={field.placeholder}
                      onChange={(e) =>
                        handleInputChange(
                          field.id,
                          field.type === 'number' ? e.target.valueAsNumber || e.target.value : e.target.value,
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
          {((tool.assumptions && tool.assumptions.length > 0) || (tool.limits && tool.limits.length > 0)) && (
            <Card className="p-4 sm:p-5 rounded-2xl border-border bg-surface shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-2">
                <CheckCircle2 className="size-3.5 text-primary" />
                <span>Hypothèses de calcul & Limites d’application</span>
              </h3>

              {tool.assumptions && tool.assumptions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-3xs font-bold uppercase tracking-wider text-foreground/80">
                    Hypothèses retenues :
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                    {tool.assumptions.map((ass, i) => (
                      <li key={i} className="leading-relaxed">
                        {ass}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tool.limits && tool.limits.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <span className="text-3xs font-bold uppercase tracking-wider text-warning flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    <span>Limites d’utilisation :</span>
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
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
        <div className="lg:col-span-5 space-y-4">
          {/* Encart Résultat Principal */}
          <Card
            className={cn(
              'p-5 rounded-2xl border shadow-xs relative overflow-hidden transition-all duration-200',
              !isProUnlocked
                ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-surface to-surface-raised'
                : output.status === 'danger'
                  ? 'border-error/50 bg-error/5'
                  : output.status === 'warning'
                    ? 'border-warning/50 bg-warning/5'
                    : 'border-primary/40 bg-gradient-to-br from-primary/10 via-surface to-surface-raised',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-2xs font-extrabold uppercase tracking-wider text-primary">
                {output.primaryLabel ?? 'Résultat principal'}
              </span>
              {!isProUnlocked ? (
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-gradient-to-r from-primary/10 via-primary/10 to-primary/10 px-2.5 py-1 text-3xs font-bold text-primary dark:text-primary hover:bg-primary/20 hover:border-primary/50 shadow-2xs transition-all cursor-pointer"
                  title="Débloquer l'export et la copie avec les forfaits Pro"
                >
                  <Sparkles className="size-3 text-primary" />
                  <span>Débloquer (Pro)</span>
                </button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySummary}
                  className="h-7 px-2 text-3xs font-semibold gap-1 cursor-pointer bg-surface/80 hover:bg-surface"
                  title="Copier le résumé complet"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-success" />
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
              <div className="my-3 rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/10 via-surface/95 to-surface p-4 text-center shadow-xs backdrop-blur-xs space-y-3">
                <div className="mx-auto flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/20 border border-primary/30 text-primary shadow-2xs">
                  <Sparkles className="size-4.5 text-primary animate-pulse" />
                </div>

                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-3xs font-black tracking-wider uppercase text-primary dark:text-primary">
                    <Lock className="size-2.5" />
                    <span>Calculateur Certifié Pro</span>
                  </div>
                  <h4 className="text-xs font-bold text-foreground">
                    Résultat normé et fiches de calcul verrouillés
                  </h4>
                  <p className="text-3xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Débloquez l’accès illimité aux 36 moteurs de calcul, aux exports PDF officiels et à l'historique d'équipe.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary to-primary p-[1px] shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/35 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-2 rounded-[11px] bg-gradient-to-r from-primary via-primary to-primary px-3.5 py-2.5 text-xs font-bold text-white transition-all group-hover:brightness-105">
                    <Sparkles className="size-3.5 text-primary group-hover:rotate-12 transition-transform" />
                    <span>Débloquer l’accès Pro</span>
                    <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase text-primary border border-white/10">
                      Dès 39 €/m
                    </span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="my-2">
                <div className="text-2xl sm:text-3xl font-mono font-black text-foreground tracking-tight">
                  {output.primaryResult}
                </div>
                {output.primaryUnit && (
                  <p className="text-xs font-semibold text-muted-foreground mt-1">
                    {output.primaryUnit}
                  </p>
                )}
              </div>
            )}

            {isProUnlocked && output.statusMessage && (
              <div
                className={cn(
                  'mt-3 p-2.5 rounded-xl text-xs font-medium flex items-start gap-2',
                  output.status === 'danger'
                    ? 'bg-error/10 text-error border border-error/20'
                    : 'bg-warning/10 text-warning-foreground border border-warning/20',
                )}
              >
                <HelpCircle className="size-4 shrink-0 mt-0.5" />
                <span>{output.statusMessage}</span>
              </div>
            )}
          </Card>

          {/* Détails du calcul */}
          {output.details && output.details.length > 0 && (
            <Card className="p-4 sm:p-5 rounded-2xl border-border bg-surface shadow-xs space-y-2.5 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Détails & Grandeurs calculées
                </h3>
                {!isProUnlocked && (
                  <span className="inline-flex items-center gap-1 text-3xs font-bold text-primary dark:text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/25">
                    <Lock className="size-2.5" />
                    <span>Inclus en Pro</span>
                  </span>
                )}
              </div>

              <div className={cn("divide-y divide-border/60", !isProUnlocked && "blur-[2.5px] select-none pointer-events-none opacity-50")}>
                {output.details.map((row, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between py-2 text-xs gap-2',
                      row.highlight && 'font-bold',
                    )}
                  >
                    <span className="text-muted-foreground truncate">{row.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'font-mono text-foreground',
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
                <div className="absolute inset-x-0 bottom-0 top-10 flex flex-col items-center justify-center p-4 bg-surface/70 backdrop-blur-[2px]">
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-primary/15 to-primary/15 px-3.5 py-2 text-xs font-bold text-primary dark:text-primary shadow-sm hover:border-primary/60 hover:bg-primary/25 transition-all cursor-pointer backdrop-blur-xs"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Débloquer les grandeurs détaillées (Pro)</span>
                  </button>
                </div>
              )}
            </Card>
          )}

          {/* Formule & Explication Technique */}
          {output.formulaExplanation && (
            <Card className="p-4 rounded-2xl border-border bg-surface-raised/60 shadow-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Info className="size-3.5 text-primary" />
                <span>Formule & Référence mathématique</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed bg-surface p-2.5 rounded-lg border border-border/80">
                {output.formulaExplanation}
              </p>
            </Card>
          )}

          {/* Conseils de terrain */}
          {output.advice && output.advice.length > 0 && (
            <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-warning">
                <Lightbulb className="size-4 shrink-0" />
                <span>Conseils de mise en œuvre</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
                {output.advice.map((adv, idx) => (
                  <li key={idx} className="leading-snug">
                    {adv}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Avertissement réglementaire & non-surpromesse */}
          <div className="p-3.5 rounded-2xl bg-surface-raised border border-border text-3xs text-muted-foreground space-y-1 leading-relaxed">
            <div className="flex items-center gap-1 font-bold text-foreground/90">
              <AlertTriangle className="size-3 text-warning" />
              <span>Avertissement & Règle de l’art</span>
            </div>
            <p>
              Ce calculateur fournit une estimation technique d’aide au dimensionnement basée sur les normes en vigueur et les paramètres saisis. Il ne se substitue pas à une étude d’exécution réalisée par un bureau d’études certifié ni aux préconisations spécifiques des fabricants.
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
