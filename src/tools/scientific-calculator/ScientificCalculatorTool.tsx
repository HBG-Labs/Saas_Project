import {
  Calculator,
  Check,
  Copy,
  Delete,
  Download,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { HistoryUpgradeBanner, useCalculationHistory } from '@/features/history';

import { evaluateScientificExpression } from './compute';
import { ScientificCalculatorDocsModal } from './components/ScientificCalculatorDocsModal';

type CalculatorMobileMode = 'scientific' | 'standard';

export default function ScientificCalculatorTool() {
  const [expression, setExpression] = useState('');
  const [angleUnit, setAngleUnit] = useState<'deg' | 'rad'>('deg');
  const [memory, setMemory] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [mobileMode, setMobileMode] = useState<CalculatorMobileMode>('scientific');

  // Hook d'historique centralisé sensible aux abonnements
  const {
    entries: history,
    addEntry,
    clearHistory,
    exportCsv,
    userPlan,
    maxLimit,
    isLimitReached,
  } = useCalculationHistory('scientific-calculator');

  // Évaluation continue du résultat en temps réel
  const currentResult = useMemo(
    () => evaluateScientificExpression(expression, angleUnit),
    [expression, angleUnit],
  );

  const handleAppend = useCallback((val: string) => {
    setExpression((prev) => prev + val);
  }, []);

  const handleClear = useCallback(() => {
    setExpression('');
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => {
      if (!prev) return '';
      const functions = [
        'asin(',
        'acos(',
        'atan(',
        'sin(',
        'cos(',
        'tan(',
        'sqrt(',
        'log(',
        'ln(',
        'abs(',
        '1/(',
      ];
      for (const fn of functions) {
        if (prev.endsWith(fn)) {
          return prev.slice(0, -fn.length);
        }
      }
      return prev.slice(0, -1);
    });
  }, []);

  const handleToggleSign = useCallback(() => {
    setExpression((prev) => {
      if (!prev) return '-';
      if (prev.startsWith('-(') && prev.endsWith(')')) {
        return prev.slice(2, -1);
      }
      return `-(${prev})`;
    });
  }, []);

  const handleEvaluate = useCallback(() => {
    if (!expression.trim()) return;
    const res = evaluateScientificExpression(expression, angleUnit, true);
    if (res.result !== null) {
      addEntry({
        toolSlug: 'scientific-calculator',
        toolTitle: "Calculatrice scientifique d'ingénierie",
        expression,
        formattedResult: res.formattedResult,
      });
      setExpression(res.formattedResult);
    }
  }, [expression, angleUnit, addEntry]);

  // Gestion Mémoire
  const handleMemoryClear = () => setMemory(0);
  const handleMemoryRecall = () => setExpression((prev) => prev + memory.toString());
  const handleMemorySave = () => {
    if (currentResult.result !== null) setMemory(currentResult.result);
  };
  const handleMemoryAdd = () => {
    const value = currentResult.result;
    if (value !== null) setMemory((prev) => prev + value);
  };
  const handleMemorySub = () => {
    const value = currentResult.result;
    if (value !== null) setMemory((prev) => prev - value);
  };

  // Support Clavier Physique
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        handleAppend(e.key);
      } else if (e.key === '.' || e.key === ',') {
        handleAppend('.');
      } else if (['+', '-', '*', '/', '(', ')', '^', '!', '%'].includes(e.key)) {
        handleAppend(e.key);
      } else if (e.key === 'p' || e.key === 'P') {
        handleAppend('π');
      } else if (e.key === 'e' || e.key === 'E') {
        handleAppend('e');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAppend, handleEvaluate, handleBackspace, handleClear]);

  const handleCopy = () => {
    const summary = `${expression ? expression + ' = ' : ''}${currentResult.formattedResult}`;
    void navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Styles de touches unifiés et ultra-tactiles
  const keyBase =
    'rounded-xl font-medium transition-all duration-100 select-none flex items-center justify-center active:scale-[0.95] touch-manipulation cursor-pointer';

  // Fonctions scientifiques (zone secondaire)
  const keyScientific =
    'h-9 sm:h-10 bg-surface-sunken/90 dark:bg-surface-sunken text-foreground/90 border border-border/70 hover:bg-surface hover:border-border-strong font-semibold text-xs shadow-2xs';

  // Pavé numérique principal (Zone 2)
  const keyNumber =
    'h-12 sm:h-13 bg-surface text-foreground border border-border-strong/70 hover:bg-surface-hover hover:border-foreground/30 font-extrabold text-base sm:text-lg shadow-xs';
  const keyOperator =
    'h-12 sm:h-13 bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 hover:border-primary/40 font-bold text-lg sm:text-xl shadow-xs';
  const keyActionClear =
    'h-12 sm:h-13 bg-error/10 text-error border border-error/30 hover:bg-error/20 font-bold text-sm sm:text-base shadow-xs';
  const keyActionBackspace =
    'h-12 sm:h-13 bg-surface-hover text-muted-foreground hover:text-foreground border border-border/70 hover:bg-border/60 shadow-xs';
  const keyEquals =
    'h-12 sm:h-13 bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active font-black text-lg sm:text-xl shadow-raised';

  return (
    <div className="grid gap-6 lg:grid-cols-3 max-w-full">
      {/* Panneau Principal de la Calculatrice */}
      <Card className="lg:col-span-2 shadow-modal border-border/80 overflow-hidden flex flex-col">
        <CardHeader className="pb-3 border-b border-border/40 px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Calculator className="size-4" />
              </div>
              <CardTitle className="text-sm sm:text-base font-bold truncate">
                Calculatrice Scientifique
              </CardTitle>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <ScientificCalculatorDocsModal />

              {/* Commutateur DEG / RAD */}
              <div className="bg-surface-sunken border-border/80 flex items-center rounded-lg border p-0.5">
                <button
                  type="button"
                  onClick={() => setAngleUnit('deg')}
                  className={`rounded-md px-2 py-1 text-2xs font-bold transition-all ${
                    angleUnit === 'deg'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Mode Degrés (0-360°)"
                >
                  DEG
                </button>
                <button
                  type="button"
                  onClick={() => setAngleUnit('rad')}
                  className={`rounded-md px-2 py-1 text-2xs font-bold transition-all ${
                    angleUnit === 'rad'
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  title="Mode Radians (0-2π)"
                >
                  RAD
                </button>
              </div>

              {memory !== 0 && (
                <Badge variant="info" className="font-mono text-2xs px-1.5 py-0.5 shrink-0">
                  M={memory}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 flex-1">
          {/* Écran Cockpit Haute Précision */}
          <div className="bg-surface-sunken/90 dark:bg-surface-sunken rounded-2xl border border-border/80 p-3.5 sm:p-4 shadow-inner">
            {/* Ligne expression supérieure avec scroll doux */}
            <div className="flex items-center justify-between gap-2 text-subtle-foreground font-mono text-xs min-h-[1.5rem]">
              <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground/90 shrink-0">
                <span
                  className={`inline-block size-1.5 rounded-full ${
                    currentResult.error ? 'bg-error animate-pulse' : 'bg-success'
                  }`}
                />
                <span>{currentResult.error ? 'ATTENTION' : `MODE ${angleUnit.toUpperCase()}`}</span>
              </div>
              <div className="overflow-x-auto whitespace-nowrap scrollbar-none text-right font-mono text-xs text-muted-foreground max-w-[70%]">
                {expression || ' '}
              </div>
            </div>

            {/* Ligne résultat principale */}
            <div className="mt-1 flex items-baseline justify-between gap-2 min-w-0">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!currentResult.formattedResult}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent hover:border-border/60 transition-colors shrink-0"
                title="Copier le résultat"
              >
                {copied ? (
                  <>
                    <Check className="size-3 text-success" />
                    <span className="text-success font-semibold">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    <span>Copier</span>
                  </>
                )}
              </button>

              <div
                className={`font-mono text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight tabular-nums text-right truncate transition-all select-all ${
                  currentResult.error ? 'text-error' : 'text-foreground'
                }`}
                title={currentResult.formattedResult}
              >
                {currentResult.formattedResult}
              </div>
            </div>
          </div>

          {/* Barre Mémoire Compacte */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleMemoryClear}
              disabled={memory === 0}
              className="h-8 sm:h-9 rounded-lg border border-border/70 bg-surface/60 hover:bg-surface text-2xs font-mono font-bold transition-all disabled:opacity-40 disabled:pointer-events-none hover:border-border-strong text-muted-foreground hover:text-foreground"
            >
              MC
            </button>
            <button
              type="button"
              onClick={handleMemoryRecall}
              disabled={memory === 0}
              className="h-8 sm:h-9 rounded-lg border border-border/70 bg-surface/60 hover:bg-surface text-2xs font-mono font-bold transition-all disabled:opacity-40 disabled:pointer-events-none hover:border-border-strong text-muted-foreground hover:text-foreground"
            >
              MR
            </button>
            <button
              type="button"
              onClick={handleMemorySave}
              className="h-8 sm:h-9 rounded-lg border border-border/70 bg-surface/60 hover:bg-surface text-2xs font-mono font-bold transition-all hover:border-primary/50 text-muted-foreground hover:text-primary"
            >
              MS
            </button>
            <button
              type="button"
              onClick={handleMemoryAdd}
              className="h-8 sm:h-9 rounded-lg border border-border/70 bg-surface/60 hover:bg-surface text-2xs font-mono font-bold transition-all hover:border-primary/50 text-muted-foreground hover:text-primary"
            >
              M+
            </button>
            <button
              type="button"
              onClick={handleMemorySub}
              className="h-8 sm:h-9 rounded-lg border border-border/70 bg-surface/60 hover:bg-surface text-2xs font-mono font-bold transition-all hover:border-primary/50 text-muted-foreground hover:text-primary"
            >
              M-
            </button>
          </div>

          {/* Commutateur de Mode Mobile (< md) */}
          <div className="flex md:hidden bg-surface-sunken p-1 rounded-xl border border-border/70 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMobileMode('scientific')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                mobileMode === 'scientific'
                  ? 'bg-surface text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📋 Scientifique (Complet)
            </button>
            <button
              type="button"
              onClick={() => setMobileMode('standard')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                mobileMode === 'standard'
                  ? 'bg-surface text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🔢 Pavé Standard (Simple)
            </button>
          </div>

          {/* --- STRUCTURE DU CLAVIER DEUX ÉTAGES --- */}
          <div className="space-y-3">
            {/* ZONE 1 : FONCTIONS SCIENTIFIQUES (6 colonnes compactes) */}
            {(mobileMode === 'scientific' || typeof window === 'undefined') && (
              <div className="bg-surface-sunken/50 dark:bg-surface-sunken/40 rounded-2xl p-2 sm:p-3 border border-border/60 space-y-1.5">
                <div className="text-2xs font-bold uppercase tracking-wider text-muted-foreground/80 px-1 flex items-center justify-between">
                  <span>Fonctions Scientifiques</span>
                  <span className="font-mono text-3xs text-subtle-foreground">TRIG • PUISSANCES • LOG</span>
                </div>

                <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                  {/* Rangée 1 : Trigonométrie directe et réciproque */}
                  <button
                    type="button"
                    onClick={() => handleAppend('sin(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    sin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('cos(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    cos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('tan(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    tan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('asin(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    asin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('acos(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    acos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('atan(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    atan
                  </button>

                  {/* Rangée 2 : Puissances, Racines et Logarithmes */}
                  <button
                    type="button"
                    onClick={() => handleAppend('^2')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('^')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    x^y
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('sqrt(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    √x
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('1/(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    1/x
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('log(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    log
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('ln(')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    ln
                  </button>

                  {/* Rangée 3 : Parenthèses, Factorielle, Pourcent, Constantes */}
                  <button
                    type="button"
                    onClick={() => handleAppend('(')}
                    className={`${keyBase} ${keyScientific} font-mono font-bold`}
                  >
                    (
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend(')')}
                    className={`${keyBase} ${keyScientific} font-mono font-bold`}
                  >
                    )
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('!')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    n!
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('%')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('π')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    π
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAppend('e')}
                    className={`${keyBase} ${keyScientific}`}
                  >
                    e
                  </button>
                </div>
              </div>
            )}

            {/* ZONE 2 : GRAND PAVÉ NUMÉRIQUE UNIVERSEL (4 Colonnes Standard) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {/* Ligne 1 : AC, Retour, Signe ±, Division */}
              <button
                type="button"
                onClick={handleClear}
                className={`${keyBase} ${keyActionClear}`}
              >
                AC
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                className={`${keyBase} ${keyActionBackspace}`}
                title="Effacer (Retour arrière)"
              >
                <Delete className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleToggleSign}
                className={`${keyBase} ${keyNumber} text-sm font-semibold`}
                title="Changer de signe"
              >
                ±
              </button>
              <button
                type="button"
                onClick={() => handleAppend('/')}
                className={`${keyBase} ${keyOperator}`}
              >
                ÷
              </button>

              {/* Ligne 2 : 7, 8, 9, Multiplication */}
              <button
                type="button"
                onClick={() => handleAppend('7')}
                className={`${keyBase} ${keyNumber}`}
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleAppend('8')}
                className={`${keyBase} ${keyNumber}`}
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleAppend('9')}
                className={`${keyBase} ${keyNumber}`}
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleAppend('*')}
                className={`${keyBase} ${keyOperator}`}
              >
                ×
              </button>

              {/* Ligne 3 : 4, 5, 6, Soustraction */}
              <button
                type="button"
                onClick={() => handleAppend('4')}
                className={`${keyBase} ${keyNumber}`}
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleAppend('5')}
                className={`${keyBase} ${keyNumber}`}
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleAppend('6')}
                className={`${keyBase} ${keyNumber}`}
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleAppend('-')}
                className={`${keyBase} ${keyOperator}`}
              >
                −
              </button>

              {/* Ligne 4 : 1, 2, 3, Addition */}
              <button
                type="button"
                onClick={() => handleAppend('1')}
                className={`${keyBase} ${keyNumber}`}
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleAppend('2')}
                className={`${keyBase} ${keyNumber}`}
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleAppend('3')}
                className={`${keyBase} ${keyNumber}`}
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleAppend('+')}
                className={`${keyBase} ${keyOperator}`}
              >
                +
              </button>

              {/* Ligne 5 : 0 (large), Point décimal, Égal (Hero) */}
              <button
                type="button"
                onClick={() => handleAppend('0')}
                className={`${keyBase} ${keyNumber} col-span-2`}
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleAppend('.')}
                className={`${keyBase} ${keyNumber}`}
              >
                .
              </button>
              <button
                type="button"
                onClick={handleEvaluate}
                className={`${keyBase} ${keyEquals}`}
              >
                =
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panneau d'Historique des Calculs */}
      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 px-4 sm:px-6 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <History className="size-4 text-muted-foreground" />
              Historique des Calculs
            </CardTitle>

            {history.length > 0 && (
              <div className="flex items-center gap-1">
                {userPlan !== 'free' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportCsv}
                    className="text-2xs h-7 px-2"
                    title="Exporter en CSV"
                  >
                    <Download className="size-3 mr-1" />
                    CSV
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-2xs h-7 px-2 text-subtle-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3 mr-1" />
                  Effacer
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-3.5 sm:p-5 space-y-2.5 flex-1 overflow-y-auto max-h-[460px] pb-16 lg:pb-5">
          {/* Bandeau d'incitation si quota Gratuit atteint */}
          {isLimitReached && (
            <HistoryUpgradeBanner currentCount={history.length} maxLimit={maxLimit} />
          )}

          {history.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="size-10 rounded-full bg-surface-sunken mx-auto flex items-center justify-center text-muted-foreground/60 border border-border/40">
                <Sparkles className="size-5" />
              </div>
              <p className="text-muted-foreground text-xs">
                Aucun calcul dans l&apos;historique.
              </p>
              <p className="text-subtle-foreground text-2xs">
                Exécutez une opération (`=`) pour la conserver.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setExpression(item.formattedResult)}
                className="w-full text-left bg-surface rounded-xl p-3 border border-border/60 hover:border-primary/50 transition-all group shadow-2xs"
              >
                <div className="flex items-center justify-between text-subtle-foreground font-mono text-2xs mb-1 gap-2">
                  <span className="truncate flex-1" title={item.expression}>
                    {item.expression}
                  </span>
                  <span className="text-2xs text-subtle-foreground/60 shrink-0">
                    {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="font-mono text-sm font-bold text-foreground text-right truncate">
                  = {item.formattedResult}
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
