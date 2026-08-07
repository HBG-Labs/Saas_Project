import { Calculator, Copy, Delete, Download, History, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { HistoryUpgradeBanner, useCalculationHistory } from '@/features/history';

import { evaluateScientificExpression } from './compute';
import { ScientificCalculatorDocsModal } from './components/ScientificCalculatorDocsModal';

export default function ScientificCalculatorTool() {
  const [expression, setExpression] = useState('');
  const [angleUnit, setAngleUnit] = useState<'deg' | 'rad'>('deg');
  const [memory, setMemory] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  // Hook d'historique centralisé sensible aux abonnements
  const {
    entries: history,
    addEntry,
    clearHistory,
    exportCsv,
    userPlan,
    setUserPlan,
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
      const functions = ['asin(', 'acos(', 'atan(', 'sin(', 'cos(', 'tan(', 'sqrt(', 'log(', 'ln(', 'abs(', '1/('];
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
    if (currentResult.result !== null) setMemory((prev) => prev + currentResult.result);
  };
  const handleMemorySub = () => {
    if (currentResult.result !== null) setMemory((prev) => prev - currentResult.result);
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
      } else if (['+', '-', '*', '/', '.', '(', ')', '^', '!', '%'].includes(e.key)) {
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
    const summary = `${expression} = ${currentResult.formattedResult}`;
    void navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Panneau Principal de la Calculatrice */}
      <Card className="lg:col-span-2 shadow-modal border-border/80">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="size-5 text-primary" />
              <span>Calculatrice Scientifique d&apos;Ingénierie</span>
              <ScientificCalculatorDocsModal />
            </CardTitle>

            <div className="flex items-center gap-2">
              <div className="bg-surface-sunken border-border/80 flex items-center rounded-lg border p-0.5">
                <button
                  type="button"
                  onClick={() => setAngleUnit('deg')}
                  className={`rounded-md px-2.5 py-1 text-2xs font-bold transition-all ${
                    angleUnit === 'deg'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  DEG
                </button>
                <button
                  type="button"
                  onClick={() => setAngleUnit('rad')}
                  className={`rounded-md px-2.5 py-1 text-2xs font-bold transition-all ${
                    angleUnit === 'rad'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  RAD
                </button>
              </div>

              {memory !== 0 && (
                <Badge variant="info" className="font-mono text-2xs">
                  M = {memory}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="bg-surface-sunken rounded-2xl border border-border/80 p-4 shadow-inner">
            <div className="text-subtle-foreground font-mono text-xs min-h-[1.25rem] text-right overflow-x-auto whitespace-nowrap scrollbar-none">
              {expression || ' '}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-subtle-foreground text-2xs font-semibold uppercase">
                {currentResult.error ? 'ATTENTION' : `MODE ${angleUnit.toUpperCase()}`}
              </span>
              <span
                className={`font-mono text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums transition-all ${
                  currentResult.error ? 'text-error' : 'text-foreground'
                }`}
              >
                {currentResult.formattedResult}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <Button variant="outline" size="sm" onClick={handleMemoryClear} className="font-mono text-2xs">
              MC
            </Button>
            <Button variant="outline" size="sm" onClick={handleMemoryRecall} className="font-mono text-2xs">
              MR
            </Button>
            <Button variant="outline" size="sm" onClick={handleMemorySave} className="font-mono text-2xs">
              MS
            </Button>
            <Button variant="outline" size="sm" onClick={handleMemoryAdd} className="font-mono text-2xs">
              M+
            </Button>
            <Button variant="outline" size="sm" onClick={handleMemorySub} className="font-mono text-2xs">
              M-
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <Button variant="secondary" size="sm" onClick={() => handleAppend('sin(')}>
              sin
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('cos(')}>
              cos
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('tan(')}>
              tan
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear} className="text-error border-error/30 hover:bg-error/10 font-bold">
              AC
            </Button>
            <Button variant="outline" size="sm" onClick={handleBackspace}>
              <Delete className="size-4" />
            </Button>

            <Button variant="secondary" size="sm" onClick={() => handleAppend('asin(')}>
              asin
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('acos(')}>
              acos
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('atan(')}>
              atan
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('log(')}>
              log
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('ln(')}>
              ln
            </Button>

            <Button variant="secondary" size="sm" onClick={() => handleAppend('^2')}>
              x²
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('^')}>
              x^y
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('7')} className="font-bold text-sm">
              7
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('8')} className="font-bold text-sm">
              8
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('9')} className="font-bold text-sm">
              9
            </Button>

            <Button variant="secondary" size="sm" onClick={() => handleAppend('sqrt(')}>
              √x
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('!')}>
              n!
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('4')} className="font-bold text-sm">
              4
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('5')} className="font-bold text-sm">
              5
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('6')} className="font-bold text-sm">
              6
            </Button>

            <Button variant="secondary" size="sm" onClick={() => handleAppend('1/(')}>
              1/x
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('%')}>
              %
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('1')} className="font-bold text-sm">
              1
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('2')} className="font-bold text-sm">
              2
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('3')} className="font-bold text-sm">
              3
            </Button>

            <Button variant="secondary" size="sm" onClick={() => handleAppend('π')}>
              π
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('e')}>
              e
            </Button>
            <Button variant="secondary" size="sm" onClick={handleToggleSign}>
              ±
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAppend('0')} className="font-bold text-sm">
              0
            </Button>

            <Button variant="primary" size="sm" onClick={handleEvaluate} className="font-bold text-base shadow-modal glow-primary">
              =
            </Button>
          </div>

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <Button variant="secondary" size="sm" onClick={() => handleAppend('(')} className="font-mono">
              (
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend(')')} className="font-mono">
              )
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('+')} className="flex-1 font-mono">
              +
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('-')} className="flex-1 font-mono">
              -
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('*')} className="flex-1 font-mono">
              ×
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleAppend('/')} className="flex-1 font-mono">
              ÷
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
              <Copy className="size-3.5 mr-1" />
              {copied ? 'Copié' : 'Copier'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Panneau d'Historique des Calculs avec Quota Abonnement */}
      <Card className="bg-surface-sunken/60 border-border/80 flex flex-col justify-between">
        <CardHeader className="pb-3 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
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

          {/* Sélecteur de test du plan d'abonnement (Gratuit vs Pro) */}
          <div className="bg-surface border border-border/60 rounded-xl p-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-2xs font-semibold">Formule active :</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setUserPlan('free')}
                className={`px-2 py-0.5 rounded text-2xs font-semibold transition-all ${
                  userPlan === 'free'
                    ? 'bg-surface-sunken text-foreground border border-border/80 shadow-xs'
                    : 'text-subtle-foreground hover:text-foreground'
                }`}
              >
                Gratuit (10 max)
              </button>
              <button
                type="button"
                onClick={() => setUserPlan('pro')}
                className={`px-2 py-0.5 rounded text-2xs font-semibold transition-all ${
                  userPlan === 'pro'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-subtle-foreground hover:text-foreground'
                }`}
              >
                Pro (Illimité)
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[420px] pt-4">
          {/* Bandeau d'incitation si quota Gratuit atteint */}
          {isLimitReached && <HistoryUpgradeBanner currentCount={history.length} maxLimit={10} />}

          {history.length === 0 ? (
            <p className="text-muted-foreground text-xs text-center py-10">
              Aucun calcul dans l&apos;historique. Exécutez une opération pour la conserver.
            </p>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setExpression(item.formattedResult)}
                className="w-full text-left bg-surface rounded-xl p-3 border border-border/60 hover:border-primary/50 transition-all group"
              >
                <div className="flex items-center justify-between text-subtle-foreground font-mono text-2xs mb-1">
                  <span className="truncate max-w-[160px]">{item.expression}</span>
                  <span className="text-2xs text-subtle-foreground/60">
                    {new Date(item.timestamp).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="font-mono text-sm font-bold text-foreground text-right">
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
