import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';

import industrialInspectionImg from '@/assets/images/backgrounds/industrial-inspection-ambient.jpg';

export function InteractivePlayground() {
  const [activeTab, setActiveTab] = useState<'calc' | 'ai'>('calc');

  // État pour le simulateur de puissance & énergie (Outil Universel)
  const [powerKw, setPowerKw] = useState<number>(15); // kW
  const [powerFactor, setPowerFactor] = useState<number>(0.85); // cos phi
  const [voltageType, setVoltageType] = useState<'tri' | 'mono'>('tri'); // 400V ou 230V
  const [hoursPerDay, setHoursPerDay] = useState<number>(8); // h/jour

  // Calculs en temps réel
  const apparentPowerKva = powerFactor > 0 ? powerKw / powerFactor : 0;
  const voltage = voltageType === 'tri' ? 400 : 230;
  const currentAmperes =
    voltageType === 'tri'
      ? (powerKw * 1000) / (Math.sqrt(3) * voltage * powerFactor)
      : (powerKw * 1000) / (voltage * powerFactor);
  const monthlyEnergyKwh = powerKw * hoursPerDay * 30;

  // État pour la démo Assistant IA
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  const prompts = [
    {
      id: 'err42',
      label: 'Code Erreur E42 — Variateur de vitesse moteur',
      response: `[DIAGNOSTIC EN TEMPS RÉEL]
• Cause probable : Surintensité passagère en sortie de variateur (Fréquence > 50Hz).
• Procédure de résolution recommandée :
  1. Vérifier la ventilation du coffret et les grilles d'aération.
  2. Mesurer l'isolement du moteur avec un mégohmmètre à 500V.
  3. Réinitialiser le paramètre P02.04 sur le panneau de commande.`,
    },
    {
      id: 'hvac',
      label: 'Pression de surchauffe PAC / Climatisation',
      response: `[ANALYSE THERMIQUE CYBER-IA]
• Valeur mesurée : Pression d'évaporation à 8.2 bar (Température saturée +4°C).
• Recommandation : Surchauffe cible = 5K à 8K.
• Diagnostic : Si la surchauffe mesurée est > 12K, rajouter de la charge d'éluant par fractions de 50g.`,
    },
    {
      id: 'slope',
      label: 'Norme d’accessibilité PMR — Rampe d’accès',
      response: `[RÉGLEMENTATION CHANTIER & ACCESSIBILITÉ]
• Règle PMR : Pente max = 5% sans palier de repos, ou jusqu'à 8% sur une longueur maximale de 2 mètres.
• Calcul : Pour un dénivelé de 40 cm, prévoir une rampe minimale de 8,00 mètres linéaires.`,
    },
  ];

  const handleSelectPrompt = (p: (typeof prompts)[0]) => {
    setSelectedPrompt(p.id);
    setIsTyping(true);
    setAiResponse(null);
    setTimeout(() => {
      setAiResponse(p.response);
      setIsTyping(false);
    }, 500);
  };

  return (
    <section className="relative overflow-hidden border-y border-slate-200/80 bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50 py-20 dark:border-slate-800/80 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:py-28">
      {/* Glows d'arrière-plan doux */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[min(750px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-cyan-300/20 blur-[140px] dark:from-blue-600/30 dark:via-indigo-500/25 dark:to-cyan-400/20" />
      <div className="pointer-events-none absolute top-1/4 right-10 -z-10 size-80 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* GRILLE 2 COLONNES : TEXTE À GAUCHE, PHOTO DÉZOOMÉE & FONDUE À DROITE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
          {/* COLONNE GAUCHE : TITRE, TEXTE ET ATOUTS CLÉS (CENTRÉ SUR MOBILE, ALIGNÉ À GAUCHE SUR DESKTOP) */}
          <div className="lg:col-span-6 xl:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start space-y-4">
            {/* Badge Titre */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/15 px-4 py-1.5 text-xs font-semibold text-blue-700 backdrop-blur-md dark:border-cyan-400/40 dark:bg-cyan-950/70 dark:text-cyan-300 shadow-xs">
              <Sparkles className="size-4 animate-pulse text-blue-600 dark:text-cyan-400" />
              <span>Testez la puissance de REZO360 en direct</span>
            </div>

            {/* Titre H2 Principal */}
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl leading-tight dark:text-white text-center lg:text-left">
              Votre Studio d’Ingénierie Technique,{' '}
              <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-indigo-200">
                Partout Avec Vous
              </span>
            </h2>

            {/* Paragraphe Explicatif */}
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal text-center lg:text-left mx-auto lg:mx-0">
              Simulez instantanément vos calculs d’ingénierie et testez l’assistance technique intelligente.
            </p>

            {/* Atouts Clés en Grille */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <span>13 Outils universels intégrés</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Bot className="size-4 text-cyan-500 shrink-0" />
                <span>Diagnostic IA temps réel</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Calculator className="size-4 text-blue-500 shrink-0" />
                <span>Formules certifiées NF / ISO</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span>Fonctionne 100% hors-ligne</span>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : PHOTO DÉZOOMÉE MISE EN VALEUR, SANS FILTRE NOIR AVEC FONDU STYLÉ */}
          <div className="lg:col-span-6 xl:col-span-6 relative">
            {/* Halo lumineux d'accentuation en arrière-plan */}
            <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-tr from-cyan-500/25 via-blue-600/25 to-indigo-500/25 blur-2xl opacity-70 dark:opacity-80" />

            {/* Cadre Visuel Haut de Gamme */}
            <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-cyan-500/30 bg-slate-900/5 dark:bg-slate-950/60 shadow-2xl shadow-blue-950/20 backdrop-blur-xs">
              {/* Photo Dézoomée, Nette et Lumineuse sans filtre assombrissant */}
              <img
                src={industrialInspectionImg}
                alt="Ingénieurs en diagnostic technique industriel REZO360"
                className="w-full h-auto max-h-[440px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                loading="lazy"
              />

              {/* Fondus dégradés subtils & stylés pour une intégration fluide sans coupure */}
              {/* Fondu latéral gauche (vers le texte à gauche) */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-slate-50/90 via-slate-50/30 to-transparent dark:from-slate-950/90 dark:via-slate-950/30 dark:to-transparent" />
              {/* Fondu bas */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50/80 via-slate-50/20 to-transparent dark:from-slate-950/85 dark:via-slate-950/20 dark:to-transparent" />
              {/* Fondu latéral droit léger */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50/50 via-transparent to-transparent dark:from-slate-950/60 dark:via-transparent dark:to-transparent" />

              {/* Badges Flottants Discrets & Ultra-Fins */}
              {/* 1. Statut Studio d’Ingénierie en haut à droite */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-full border border-cyan-500/35 bg-slate-950/75 px-2.5 py-0.5 text-[10px] sm:text-2xs font-bold text-cyan-300 backdrop-blur-md shadow-md">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-cyan-400" />
                </span>
                <span>Studio d’Ingénierie Live</span>
              </div>

              {/* 2. Badge Assistant IA en bas à gauche */}
              <div className="absolute bottom-2.5 left-2.5 z-20 hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1 text-[10px] sm:text-2xs font-medium text-slate-200 backdrop-blur-md shadow-md">
                <Bot className="size-3 text-cyan-400" />
                <span>Assistant IA Prêt</span>
              </div>
            </div>
          </div>
        </div>

        {/* Console Interactive claire & moderne */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
          {/* Navigation des Onglets Démo */}
          <div className="flex flex-col sm:flex-row border-b border-slate-200 bg-slate-100/70 p-2 dark:border-slate-800 dark:bg-slate-950/60 gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveTab('calc')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'calc'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Calculator className="size-4 shrink-0" />
              <span>Simulateur Puissance &amp; Énergie Live</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Bot className="size-4 shrink-0" />
              <span>Assistant IA &amp; Diagnostic Technique</span>
            </button>
          </div>

          {/* Onglet 1 : Simulateur Puissance & Énergie */}
          {activeTab === 'calc' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              {/* Entrées / Sliders */}
              <div className="space-y-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Dimensionnement Puissance &amp; Ampérage
                  </h3>
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400">
                    Outil Universel
                  </span>
                </div>

                {/* Choix 1 : Régime de tension */}
                <div className="space-y-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300 block">
                    Régime d’alimentation électrique
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVoltageType('tri')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        voltageType === 'tri'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      Triphasé (400 V)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoltageType('mono')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        voltageType === 'mono'
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      Monophasé (230 V)
                    </button>
                  </div>
                </div>

                {/* Slider : Puissance active (kW) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Puissance active nominale (P)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                      {powerKw} kW
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="120"
                    step="1"
                    value={powerKw}
                    onChange={(e) => setPowerKw(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-800 dark:accent-cyan-500"
                  />
                </div>

                {/* Choix : Facteur de puissance (cos phi) */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-700 dark:text-slate-300 block">
                    Facteur de puissance (cos φ)
                  </span>
                  <div className="flex gap-2">
                    {[0.8, 0.85, 0.9, 0.95, 1.0].map((pf) => (
                      <button
                        key={pf}
                        type="button"
                        onClick={() => setPowerFactor(pf)}
                        className={`flex-1 rounded-md py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                          powerFactor === pf
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {pf.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider : Heures / jour */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">Fonctionnement quotidien</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-cyan-400">
                      {hoursPerDay} h / jour
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    step="1"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600 dark:bg-slate-800 dark:accent-cyan-500"
                  />
                </div>
              </div>

              {/* Résultat / Synthèse */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 lg:col-span-5">
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Résultat Instantané
                  </span>

                  <div className="space-y-1">
                    <div className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                      {apparentPowerKva.toFixed(2)} kVA
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      Courant de ligne : <span className="text-blue-600 font-bold dark:text-cyan-300">{currentAmperes.toFixed(1)} A</span> | Énergie : <span className="text-slate-700 font-bold dark:text-slate-300">{monthlyEnergyKwh.toLocaleString('fr-FR')} kWh/mois</span>
                    </div>
                  </div>

                  {/* Badge de Recommandation */}
                  <div className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-5 shrink-0" />
                    <span>Calibre disjoncteur recommandé : {Math.ceil(currentAmperes * 1.25)} A</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
                  ⚡ Formule : <code className="text-slate-700 font-mono dark:text-slate-400">{voltageType === 'tri' ? 'S = P / cos φ  |  I = P / (√3 · U · cos φ)' : 'S = P / cos φ  |  I = P / (U · cos φ)'}</code>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 2 : Assistant IA */}
          {activeTab === 'ai' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              <div className="space-y-4 lg:col-span-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Sélectionnez un scénario de test IA :
                </h3>
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
                    <span>REZO360 Copilot Engine v4.2</span>
                  </div>

                  <div className="mt-4 font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {isTyping && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <RefreshCw className="size-4 animate-spin text-cyan-600 dark:text-cyan-400" />
                        <span>Génération du diagnostic technique...</span>
                      </div>
                    )}

                    {!isTyping && aiResponse && (
                      <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-300">
                        {aiResponse}
                      </pre>
                    )}

                    {!isTyping && !aiResponse && (
                      <p className="text-slate-500 italic">
                        Cliquez sur l’un des scénarios ci-contre pour voir l’assistance IA en action.
                      </p>
                    )}
                  </div>
                </div>

                {aiResponse && (
                  <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-emerald-600 font-bold dark:border-slate-800 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-4" />
                      <span>Recommandation technique conforme aux règles de l'art</span>
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
