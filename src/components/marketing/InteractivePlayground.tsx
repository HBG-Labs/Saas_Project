import { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
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
    <section className="py-16 sm:py-24 bg-transparent text-white">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-6">
        {/* EN-TÊTE : TEXTE PUR */}
        <div className="mx-auto max-w-3xl text-center flex flex-col items-center space-y-4">
          {/* Badge Titre */}
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-cyan-300 shadow-xs">
            <Sparkles className="size-4 text-cyan-400" />
            <span>Testez les calculateurs certifiés en direct</span>
          </div>

          {/* Titre H2 Principal */}
          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Votre Studio d’Ingénierie Technique,{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-200 bg-clip-text text-transparent">
              Partout Avec Vous
            </span>
          </h2>

          {/* Paragraphe Explicatif */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal max-w-2xl">
            Simulez instantanément vos calculs de dimensionnement électrique et télécom selon les normes en vigueur.
          </p>

          {/* Atouts Clés en Grille Épurée */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 w-full text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2 p-2 border-b border-white/10">
              <Zap className="size-4 text-amber-400 shrink-0" />
              <span>Outils universels &amp; calculateurs</span>
            </div>
            <div className="flex items-center gap-2 p-2 border-b border-white/10">
              <Network className="size-4 text-cyan-400 shrink-0" />
              <span>Bilan optique &amp; ingénierie FTTH</span>
            </div>
            <div className="flex items-center gap-2 p-2 border-b border-white/10">
              <Calculator className="size-4 text-blue-400 shrink-0" />
              <span>Formules certifiées NF / ISO / ITU</span>
            </div>
            <div className="flex items-center gap-2 p-2 border-b border-white/10">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>Calculs instantanés &amp; exports</span>
            </div>
          </div>
        </div>

        {/* Console Interactive Épurée & Transparente */}
        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-transparent">
          {/* Navigation des Onglets Démo */}
          <div className="flex flex-col sm:flex-row border-b border-white/10 p-2 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('elec')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'elec'
                  ? 'border border-cyan-500/40 bg-cyan-950/50 text-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                  ? 'border border-cyan-500/40 bg-cyan-950/50 text-cyan-300'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
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
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Dimensionnement Puissance, Ampérage &amp; Protection
                  </h3>
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-xs font-mono font-semibold text-cyan-300">
                    Norme NF C 15-100
                  </span>
                </div>

                {/* Choix 1 : Régime de tension */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-300 block">
                    Régime d’alimentation électrique
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVoltageType('tri')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        voltageType === 'tri'
                          ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                          : 'border border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Triphasé (400 V)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVoltageType('mono')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        voltageType === 'mono'
                          ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                          : 'border border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      Monophasé (230 V)
                    </button>
                  </div>
                </div>

                {/* Slider : Puissance active (kW) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">
                      Puissance active nominale (P)
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-500"
                  />
                </div>

                {/* Choix : Facteur de puissance (cos phi) */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-300 block">
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
                            ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                            : 'border border-white/10 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        {pf.toFixed(2)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Slider : Heures / jour */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">
                      Fonctionnement quotidien estimé
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-500"
                  />
                </div>
              </div>

              {/* Résultat / Synthèse */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-transparent p-6 lg:col-span-5">
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Dimensionnement Apparent
                  </span>

                  <div className="space-y-1">
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                      {apparentPowerKva.toFixed(2)} kVA
                    </div>
                    <div className="text-xs font-mono text-slate-300 leading-relaxed">
                      Courant de ligne :{' '}
                      <span className="text-cyan-300 font-bold">
                        {currentAmperes.toFixed(1)} A
                      </span>{' '}
                      | Énergie :{' '}
                      <span className="text-slate-200 font-bold">
                        {monthlyEnergyKwh.toLocaleString('fr-FR')} kWh/mois
                      </span>
                    </div>
                  </div>

                  {/* Badge de Recommandation */}
                  <div className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>Calibre disjoncteur recommandé : {recommendedBreaker} A</span>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400">
                  ⚡ Formule certifiée :{' '}
                  <code className="text-slate-300 font-mono text-2xs">
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
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Bilan d’Affaiblissement Liaison Optique FTTH / PON
                  </h3>
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-xs font-mono font-semibold text-cyan-300">
                    Norme ITU-T G.652.D
                  </span>
                </div>

                {/* Choix 1 : Longueur d'onde */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-300 block">
                    Fenêtre de transmission optique
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWavelength('1310')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        wavelength === '1310'
                          ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                          : 'border border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      1310 nm (0.35 dB/km — Montant)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWavelength('1550')}
                      className={`rounded-lg py-2.5 px-3 text-xs font-bold transition-all cursor-pointer ${
                        wavelength === '1550'
                          ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                          : 'border border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      1550 nm (0.22 dB/km — Descendant)
                    </button>
                  </div>
                </div>

                {/* Slider : Distance fibre (km) */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">
                      Longueur de câble optique
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
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
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-500"
                  />
                </div>

                {/* Coupleur / Splitter optique */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-300 block">
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
                            ? 'border border-cyan-500/40 bg-cyan-950/60 text-cyan-300'
                            : 'border border-white/10 text-slate-400 hover:bg-white/5'
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
                      <span className="text-slate-300">
                        Épissures fusion (0.05 dB)
                      </span>
                      <span className="font-mono font-bold text-cyan-400">
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
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">
                        Connecteurs SC/APC (0.35 dB)
                      </span>
                      <span className="font-mono font-bold text-cyan-400">
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
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/10 accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Résultat Bilan Optique */}
              <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-transparent p-6 lg:col-span-5">
                <div className="space-y-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Affaiblissement Total Théorique
                  </span>

                  <div className="space-y-1">
                    <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                      {totalAttenuationDb.toFixed(2)} dB
                    </div>
                    <div className="text-xs font-mono text-slate-300 leading-relaxed">
                      Marge résiduelle :{' '}
                      <span
                        className={`font-bold ${
                          residualMarginDb >= 3
                            ? 'text-emerald-400'
                            : residualMarginDb >= 0
                              ? 'text-amber-400'
                              : 'text-rose-400'
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
                    className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border ${
                      residualMarginDb >= 3
                        ? 'border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
                        : residualMarginDb >= 0
                          ? 'border-amber-500/30 bg-amber-950/40 text-amber-300'
                          : 'border-rose-500/30 bg-rose-950/40 text-rose-300'
                    }`}
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>
                      {residualMarginDb >= 3
                        ? 'Liaison optique conforme (Marge ≥ 3 dB)'
                        : residualMarginDb >= 0
                          ? 'Marge optique restreinte (< 3 dB)'
                          : 'Perte optique excessive (Non conforme)'}
                    </span>
                  </div>
                </div>

                <div className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-400">
                  🌐 Formule ITU-T :{' '}
                  <code className="text-slate-300 font-mono text-2xs">
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
