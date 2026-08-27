import { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Cpu,
  Network,
  Sparkles,
  Zap,
} from 'lucide-react';

export function InteractivePlayground() {
  const [activeTab, setActiveTab] = useState<'elec' | 'fiber'>('elec');

  // ==========================================
  // ÉTAT 1 : SIMULATEUR PUISSANCE & ÉNERGIE (NF C 15-100)
  // ==========================================
  const [powerKw, setPowerKw] = useState<number>(15); // kW
  const [powerFactor, setPowerFactor] = useState<number>(0.85); // cos phi
  const [voltageType, setVoltageType] = useState<'tri' | 'mono'>('tri'); // 400V ou 230V
  const [hoursPerDay, setHoursPerDay] = useState<number>(8); // h/jour

  // Calculs en temps réel (Électricité)
  const apparentPowerKva = powerFactor > 0 ? powerKw / powerFactor : 0;
  const voltage = voltageType === 'tri' ? 400 : 230;
  const currentAmperes =
    voltageType === 'tri'
      ? (powerKw * 1000) / (Math.sqrt(3) * voltage * powerFactor)
      : (powerKw * 1000) / (voltage * powerFactor);
  const monthlyEnergyKwh = powerKw * hoursPerDay * 30;

  // Calibre standard disjoncteur
  const recommendedBreaker =
    [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160].find(
      (b) => b >= currentAmperes * 1.2,
    ) ?? Math.ceil(currentAmperes * 1.25);

  // ==========================================
  // ÉTAT 2 : BILAN OPTIQUE FIBRE FTTH (ITU-T G.652D)
  // ==========================================
  const [fiberLengthKm, setFiberLengthKm] = useState<number>(12); // km
  const [wavelength, setWavelength] = useState<'1310' | '1550'>('1310'); // nm
  const [splicesCount, setSplicesCount] = useState<number>(4); // épissures
  const [connectorsCount, setConnectorsCount] = useState<number>(2); // connecteurs SC/APC
  const [splitterRatio, setSplitterRatio] = useState<
    'none' | '1:4' | '1:8' | '1:16' | '1:32'
  >('1:8');

  // Atténuation linéique & calculs (Fibre)
  const alphaDbPerKm = wavelength === '1310' ? 0.35 : 0.22;
  const lineLossDb = fiberLengthKm * alphaDbPerKm;
  const spliceLossDb = splicesCount * 0.05;
  const connectorLossDb = connectorsCount * 0.35;
  const splitterLossDb = {
    none: 0,
    '1:4': 7.2,
    '1:8': 10.5,
    '1:16': 14.0,
    '1:32': 17.5,
  }[splitterRatio];

  const totalAttenuationDb =
    lineLossDb + spliceLossDb + connectorLossDb + splitterLossDb;
  const opticalBudgetDb = 30.0; // Budget optique classe B+ / C+ GPON
  const residualMarginDb = opticalBudgetDb - totalAttenuationDb;

  return (
    <section className="relative overflow-hidden border-y border-slate-200/80 bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50 py-20 dark:border-slate-800/80 dark:bg-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950 sm:py-28">
      {/* Glows d'arrière-plan doux */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[500px] w-[min(750px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-cyan-300/20 blur-[140px] dark:from-blue-600/30 dark:via-indigo-500/25 dark:to-cyan-400/20" />
      <div className="pointer-events-none absolute top-1/4 right-10 -z-10 size-80 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* GRILLE 2 COLONNES : TEXTE À GAUCHE, PHOTO DÉZOOMÉE & FONDUE À DROITE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 xl:gap-12 items-center">
          {/* COLONNE GAUCHE : TITRE, TEXTE ET ATOUTS CLÉS */}
          <div className="lg:col-span-6 xl:col-span-6 text-center lg:text-left flex flex-col items-center lg:items-start space-y-4">
            {/* Badge Titre */}
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/15 px-4 py-1.5 text-xs font-semibold text-blue-700 backdrop-blur-md dark:border-cyan-400/40 dark:bg-cyan-950/70 dark:text-cyan-300 shadow-xs">
              <Sparkles className="size-4 animate-pulse text-blue-600 dark:text-cyan-400" />
              <span>Testez les calculateurs certifiés en direct</span>
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
              Simulez instantanément vos calculs de dimensionnement électrique et télécom selon les normes en vigueur.
            </p>

            {/* Atouts Clés en Grille */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 w-full text-xs text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <span>Outils universels &amp; calculateurs</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Network className="size-4 text-cyan-500 shrink-0" />
                <span>Bilan optique &amp; ingénierie FTTH</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <Calculator className="size-4 text-blue-500 shrink-0" />
                <span>Formules certifiées NF / ISO / ITU</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/70 dark:border-slate-800/80 dark:bg-slate-900/60 p-2.5 backdrop-blur-xs">
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                <span>Calculs instantanés &amp; exports</span>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : PHOTO DÉZOOMÉE MISE EN VALEUR */}
          <div className="lg:col-span-6 xl:col-span-6 relative">
            {/* Halo lumineux d'accentuation en arrière-plan */}
            <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-gradient-to-tr from-cyan-500/25 via-blue-600/25 to-indigo-500/25 blur-2xl opacity-70 dark:opacity-80" />

            {/* Cadre Visuel Haut de Gamme */}
            <div className="relative group overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-cyan-500/30 bg-slate-900/5 dark:bg-slate-950/60 shadow-2xl shadow-blue-950/20 backdrop-blur-xs">
              <img
                src="/images/backgrounds/industrial-inspection-ambient.jpg"
                alt="Ingénieurs en dimensionnement technique et télécom REZO360"
                className="w-full h-auto max-h-[440px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02] filter contrast-105 saturate-110"
                loading="lazy"
              />

              {/* Fondus dégradés subtils & stylés */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-slate-50/90 via-slate-50/30 to-transparent dark:from-slate-950/90 dark:via-slate-950/30 dark:to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50/80 via-slate-50/20 to-transparent dark:from-slate-950/85 dark:via-slate-950/20 dark:to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-slate-50/50 via-transparent to-transparent dark:from-slate-950/60 dark:via-transparent dark:to-transparent" />

              {/* Badges Flottants Discrets */}
              <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5 rounded-full border border-cyan-500/35 bg-slate-950/75 px-2.5 py-0.5 text-[10px] sm:text-2xs font-bold text-cyan-300 backdrop-blur-md shadow-md">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-cyan-400" />
                </span>
                <span>Studio d’Ingénierie Live</span>
              </div>

              <div className="absolute bottom-2.5 left-2.5 z-20 hidden sm:flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/75 px-2.5 py-1 text-[10px] sm:text-2xs font-medium text-slate-200 backdrop-blur-md shadow-md">
                <Cpu className="size-3 text-cyan-400" />
                <span>Moteur Normatif NF &amp; ITU-T</span>
              </div>
            </div>
          </div>
        </div>

        {/* Console Interactive claire & moderne */}
        <div className="mt-12 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/80">
          {/* Navigation des Onglets Démo */}
          <div className="flex flex-col sm:flex-row border-b border-slate-200 bg-slate-100/70 p-2 dark:border-slate-800 dark:bg-slate-950/60 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('elec')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'elec'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Zap className="size-4 shrink-0" />
              <span>Simulateur Électrique &amp; Ampérage (NF C 15-100)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('fiber')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'fiber'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/25'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
              }`}
            >
              <Network className="size-4 shrink-0" />
              <span>Bilan Optique &amp; Liaison Fibre FTTH (ITU-T G.652)</span>
            </button>
          </div>

          {/* Onglet 1 : Simulateur Puissance & Énergie */}
          {activeTab === 'elec' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              {/* Entrées / Sliders */}
              <div className="space-y-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Dimensionnement Puissance, Ampérage &amp; Protection
                  </h3>
                  <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400">
                    Norme NF C 15-100
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
                    <span className="text-slate-700 dark:text-slate-300">
                      Puissance active nominale (P)
                    </span>
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
                    Facteur de puissance de charge (cos φ)
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
                    <span className="text-slate-700 dark:text-slate-300">
                      Fonctionnement quotidien estimé
                    </span>
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
                    Dimensionnement Apparent
                  </span>

                  <div className="space-y-1">
                    <div className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                      {apparentPowerKva.toFixed(2)} kVA
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed">
                      Courant de ligne :{' '}
                      <span className="text-blue-600 font-bold dark:text-cyan-300">
                        {currentAmperes.toFixed(1)} A
                      </span>{' '}
                      | Énergie :{' '}
                      <span className="text-slate-700 font-bold dark:text-slate-300">
                        {monthlyEnergyKwh.toLocaleString('fr-FR')} kWh/mois
                      </span>
                    </div>
                  </div>

                  {/* Badge de Recommandation */}
                  <div className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-4.5 shrink-0" />
                    <span>Calibre disjoncteur recommandé : {recommendedBreaker} A</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
                  ⚡ Formule certifiée :{' '}
                  <code className="text-slate-700 font-mono text-2xs dark:text-slate-400">
                    {voltageType === 'tri'
                      ? 'S = P / cos φ  |  I = P / (√3 · U · cos φ)'
                      : 'S = P / cos φ  |  I = P / (U · cos φ)'}
                  </code>
                </div>
              </div>
            </div>
          )}

          {/* Onglet 2 : Bilan Optique Fibre FTTH */}
          {activeTab === 'fiber' && (
            <div className="grid gap-8 p-6 lg:grid-cols-12 lg:p-10">
              {/* Entrées / Sliders Fibre */}
              <div className="space-y-6 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Bilan d’Affaiblissement Liaison Optique FTTH / PON
                  </h3>
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-cyan-700 dark:text-cyan-300">
                    Norme ITU-T G.652.D
                  </span>
                </div>

                {/* Choix 1 : Longueur d'onde */}
                <div className="space-y-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300 block">
                    Fenêtre de transmission optique
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWavelength('1310')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        wavelength === '1310'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      1310 nm (0.35 dB/km — Montant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWavelength('1550')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        wavelength === '1550'
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                      }`}
                    >
                      1550 nm (0.22 dB/km — Descendant)
                    </button>
                  </div>
                </div>

                {/* Slider : Distance fibre (km) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300">
                      Longueur de câble optique
                    </span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {fiberLengthKm.toFixed(1)} km
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="35"
                    step="0.5"
                    value={fiberLengthKm}
                    onChange={(e) => setFiberLengthKm(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-cyan-600 dark:bg-slate-800 dark:accent-cyan-500"
                  />
                </div>

                {/* Coupleur / Splitter optique */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-700 dark:text-slate-300 block">
                    Coupleur optique (Splitter réseau PON)
                  </span>
                  <div className="grid grid-cols-5 gap-2">
                    {(
                      [
                        { id: 'none', label: 'Direct (0 dB)' },
                        { id: '1:4', label: '1:4 (7.2 dB)' },
                        { id: '1:8', label: '1:8 (10.5 dB)' },
                        { id: '1:16', label: '1:16 (14 dB)' },
                        { id: '1:32', label: '1:32 (17.5 dB)' },
                      ] as const
                    ).map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() => setSplitterRatio(sp.id)}
                        className={`rounded-md py-1.5 px-1 text-[11px] font-mono font-bold transition-all cursor-pointer text-center ${
                          splitterRatio === sp.id
                            ? 'bg-cyan-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders doubles : Épissures & Connecteurs */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300">
                        Épissures fusion (0.05 dB)
                      </span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {splicesCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="1"
                      value={splicesCount}
                      onChange={(e) => setSplicesCount(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-cyan-600 dark:bg-slate-800 dark:accent-cyan-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300">
                        Connecteurs SC/APC (0.35 dB)
                      </span>
                      <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {connectorsCount}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="1"
                      value={connectorsCount}
                      onChange={(e) => setConnectorsCount(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-cyan-600 dark:bg-slate-800 dark:accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Résultat Bilan Optique */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950 lg:col-span-5">
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Affaiblissement Total Théorique
                  </span>

                  <div className="space-y-1">
                    <div className="text-4xl font-extrabold font-mono text-slate-900 dark:text-white tracking-tight">
                      {totalAttenuationDb.toFixed(2)} dB
                    </div>
                    <div className="text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed">
                      Marge résiduelle :{' '}
                      <span
                        className={`font-bold ${
                          residualMarginDb >= 3
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : residualMarginDb >= 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {residualMarginDb >= 0 ? '+' : ''}
                        {residualMarginDb.toFixed(2)} dB
                      </span>{' '}
                      | Budget classe B+ : 30.0 dBm
                    </div>
                  </div>

                  {/* Badge de Conformité */}
                  <div
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold border ${
                      residualMarginDb >= 3
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : residualMarginDb >= 0
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    <CheckCircle2 className="size-4.5 shrink-0" />
                    <span>
                      {residualMarginDb >= 3
                        ? 'Liaison optique conforme (Marge ≥ 3 dB)'
                        : residualMarginDb >= 0
                          ? 'Marge optique restreinte (< 3 dB)'
                          : 'Perte optique excessive (Non conforme)'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
                  🌐 Formule ITU-T :{' '}
                  <code className="text-slate-700 font-mono text-2xs dark:text-slate-400">
                    A_tot = (L · α) + (N_ep · 0.05) + (N_co · 0.35) + A_split
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
