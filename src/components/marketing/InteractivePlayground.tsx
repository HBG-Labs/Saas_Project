import { useState } from 'react';
import { Calculator, Bot, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Zap, RefreshCw } from 'lucide-react';

export function InteractivePlayground() {
  const [activeTab, setActiveTab] = useState<'calc' | 'ai'>('calc');

  // État pour le calculateur de chute de tension
  const [cableLength, setCableLength] = useState<number>(35); // mètres
  const [cableSection, setCableSection] = useState<number>(2.5); // mm²
  const [currentIntensity, setCurrentIntensity] = useState<number>(16); // Ampères

  // Calcul simplifié de chute de tension : ΔU = (2 * L * I) / (56 * S) pour le cuivre
  const voltageDropVolts = (2 * cableLength * currentIntensity) / (56 * cableSection);
  const voltageDropPercent = (voltageDropVolts / 230) * 100;
  const isConform = voltageDropPercent <= 3.0; // Conforme NF C 15-100 si <= 3%

  // État pour la démo Assistant IA
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const prompts = [
    {
      id: 'err42',
      label: 'Code Erreur E42 - Variateur ABB',
      response: `[DIAGNOSTIC EN TEMPS RÉEL]
• Cause probable : Surintensité passagère en sortie de variateur (Fréquence > 50Hz).
• Procédure de résolution recommandée :
  1. Vérifier la ventilation du coffret et les grilles d'aération.
  2. Mesurer l'isolement du moteur avec un mégohmmètre à 500V.
  3. Réinitialiser le paramètre P02.04 sur le panneau de commande.`,
    },
    {
      id: 'hvac',
      label: 'Pression de surchauffe PAC R32',
      response: `[ANALYSE THERMIQUE CYBER-IA]
• Valeur mesurée : Pression d'évaporation à 8.2 bar (Température saturée +4°C).
• Recommandation : Surchauffe cible = 5K à 8K.
• Diagnostic : Si la surchauffe mesurée est > 12K, rajouter de la charge d'éluant R32 par fractions de 50g.`,
    },
  ];

  const handleSelectPrompt = (p: (typeof prompts)[0]) => {
    setSelectedPrompt(p.id);
    setIsTyping(true);
    setAiResponse(null);
    setTimeout(() => {
      setAiResponse(p.response);
      setIsTyping(false);
    }, 600);
  };

  return (
    <section className="relative overflow-hidden border-y border-slate-200/80 bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50 py-20 dark:border-slate-800/80 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:py-28">
      {/* Glows d'arrière-plan doux */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[500px] w-[750px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-cyan-300/20 blur-[140px] dark:from-blue-600/30 dark:via-indigo-500/25 dark:to-cyan-400/20" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-600 backdrop-blur-md dark:border-blue-500/30 dark:text-blue-400">
            <Sparkles className="size-4 animate-pulse text-blue-600 dark:text-cyan-400" />
            <span>Testez la puissance de NexoraTech en direct</span>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl leading-tight dark:text-white">
            Votre Studio d&apos;Ingénierie Technique, <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-400">Partout Avec Vous</span>
          </h2>

          <p className="text-base text-slate-600 sm:text-lg dark:text-slate-400">
            Testez nos moteurs de calcul certifiés et simulez vos bilans directement sur le terrain ou au bureau.
          </p>
        </div>

        {/* Console Interactive claire & moderne */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
          {/* Navigation des Onglets Démo */}
          <div className="flex border-b border-slate-200 bg-slate-100/70 p-2 dark:border-slate-800 dark:bg-slate-950/60">
            <button
              onClick={() => setActiveTab('calc')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'calc'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Calculator className="size-4" />
              <span>Calculateur NF C 15-100 Live</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Bot className="size-4" />
              <span>Assistant IA & Diagnostic Panne</span>
            </button>
          </div>

          {/* Onglet 1 : Calculateur Live */}
          {activeTab === 'calc' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              {/* Entrées / Sliders */}
              <div className="space-y-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chute de Tension en Monophasé 230V</h3>
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400">
                    Cuivre (Cu)
                  </span>
                </div>

                {/* Slider 1 : Longueur */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Longueur du câble (mètres)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-indigo-400">{cableLength} m</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="150"
                    step="5"
                    value={cableLength}
                    onChange={(e) => setCableLength(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-800 dark:accent-indigo-500"
                  />
                </div>

                {/* Slider 2 : Section */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Section du conducteur (mm²)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-indigo-400">{cableSection} mm²</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[1.5, 2.5, 4, 6, 10].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setCableSection(sec)}
                        className={`rounded-lg py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
                          cableSection === sec
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {sec} mm²
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider 3 : Intensité */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Intensité de courant (Ampères)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-indigo-400">{currentIntensity} A</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="63"
                    step="1"
                    value={currentIntensity}
                    onChange={(e) => setCurrentIntensity(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-800 dark:accent-indigo-500"
                  />
                </div>
              </div>

              {/* Résultat / Jauge */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 lg:col-span-5">
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Résultat Instantané
                  </span>

                  <div className="space-y-1">
                    <div className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                      {voltageDropPercent.toFixed(2)} %
                    </div>
                    <div className="text-sm font-mono text-slate-600 dark:text-slate-400">
                      Chute brute : <span className="text-blue-600 font-bold dark:text-indigo-300">{voltageDropVolts.toFixed(2)} Volts</span>
                    </div>
                  </div>

                  {/* Badge de Conformité */}
                  <div
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border transition-all ${
                      isConform
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {isConform ? (
                      <>
                        <CheckCircle2 className="size-5 shrink-0" />
                        <span>Conforme NF C 15-100 (≤ 3%)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-5 shrink-0" />
                        <span>Non-conforme (&gt; 3%) — Augmenter la section</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
                  ⚡ Formule normée : <code className="text-slate-700 font-mono dark:text-slate-400">ΔU = (2 · L · I) / (γ · S)</code>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 2 : Assistant IA */}
          {activeTab === 'ai' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              <div className="space-y-4 lg:col-span-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sélectionnez un scénario de test IA :</h3>
                <div className="space-y-3">
                  {prompts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectPrompt(p)}
                      className={`w-full rounded-2xl p-4 text-left border transition-all cursor-pointer ${
                        selectedPrompt === p.id
                          ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 font-bold dark:text-white shadow-lg'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{p.label}</span>
                        <ArrowRight className="size-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 lg:col-span-7 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-mono text-cyan-600 font-bold dark:border-slate-800 dark:text-cyan-400">
                    <Zap className="size-4 animate-bounce" />
                    <span>NexoraAI Copilot Engine v4.2</span>
                  </div>

                  <div className="mt-4 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {isTyping && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <RefreshCw className="size-4 animate-spin text-cyan-600 dark:text-cyan-400" />
                        <span>Génération du diagnostic technique...</span>
                      </div>
                    )}

                    {!isTyping && aiResponse && (
                      <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-300">{aiResponse}</pre>
                    )}

                    {!isTyping && !aiResponse && (
                      <p className="text-slate-500 italic">
                        Cliquez sur l&apos;un des scénarios ci-contre pour voir l&apos;assistance IA en action.
                      </p>
                    )}
                  </div>
                </div>

                {aiResponse && (
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-emerald-600 font-bold dark:border-slate-800 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" />
                      <span>Diagnostic certifié conforme aux notices constructeur</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
