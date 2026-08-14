import { Award, BookOpen, FileText, Info, ShieldCheck } from 'lucide-react';
import type { ToolDefinition } from '../registry';

interface ReferenceSection {
  standardName: string;
  organization: string;
  title: string;
  summary: string;
  formulas?: { label: string; formula: string; description: string }[];
  table?: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  };
  keyTakeaways?: string[];
}

const REFERENCES_DATABASE: Record<string, ReferenceSection[]> = {
  // ---------------------------------------------------- ÉLECTRICITÉ
  electrical: [
    {
      standardName: 'NF C 15-100 & UTE C 15-105',
      organization: 'AFNOR / UTE',
      title: 'Installations électriques à basse tension & calcul des sections',
      summary:
        "La norme NF C 15-100 régit la conception, la réalisation et l'entretien des installations électriques BT en France. Le guide UTE C 15-105 définit la méthode d'asservissement des sections de câbles en fonction des courants de court-circuit, des chutes de tension et du mode de pose.",
      formulas: [
        {
          label: "Loi d'Ohm Monophasée",
          formula: 'U = R × I',
          description: 'U en Volts (V), R en Ohms (Ω), I en Ampères (A).',
        },
        {
          label: 'Puissance Active (Triphasé Équilibré)',
          formula: 'P = √3 × U × I × cos(φ)',
          description: 'P en Watts (W), U entre phases (V), I par phase (A).',
        },
        {
          label: 'Chute de tension relative ΔU (%)',
          formula: 'ΔU (%) = (100 × b × (ρ1 × (L/S) × cos(φ) + λ × L × sin(φ)) × I) / Un',
          description: 'b=1 (Triphasé), b=2 (Monophasé). S en mm², L en mètres.',
        },
      ],
      table: {
        title: 'Chute de tension maximale autorisée (NF C 15-100)',
        headers: ['Type de circuit', 'Alimentation réseau BT', 'Poste HTA/BT privé'],
        rows: [
          ['Éclairage', '3 %', '6 %'],
          ['Autres usages (Prises, Force)', '5 %', '8 %'],
        ],
      },
      keyTakeaways: [
        'Prise en compte du facteur de correction K selon le mode de pose (encastré, sous conduit, chemin de câble).',
        'Respect du dispositif de protection contre les surintensités (disjoncteur ou fusible de calibre In ≤ Iz).',
        'Vérification de la tenue thermique sous courant de court-circuit maximal (Icc).',
      ],
    },
  ],

  // ---------------------------------------------------- FIBRE OPTIQUE
  'fiber-optics': [
    {
      standardName: 'ITU-T G.652.D & UTE C 90-480',
      organization: 'ITU-T / AFNOR',
      title: 'Caractéristiques de la fibre monomode (SMF) & Bilan optique FTTH',
      summary:
        "La recommandation ITU-T G.652.D définit les fibres monomodes non à dispersion décalée utilisées massivement dans les réseaux FTTH et transport. La norme française UTE C 90-480 fixe les critères d'ingénierie des liaisons de câblage à fibre optique.",
      formulas: [
        {
          label: 'Bilan de liaison théorique (dB)',
          formula: 'A_total = (α × L) + (N_soud × a_soud) + (N_conn × a_conn)',
          description:
            'α : atténuation linéique (dB/km), L : longueur (km), a_soud : perte par épissure, a_conn : perte par connecteur.',
        },
        {
          label: 'Conversion dBm en Milliwatts (mW)',
          formula: 'P(mW) = 10^(P(dBm) / 10)',
          description: 'Conversion de la puissance optique relative en milliwatts.',
        },
      ],
      table: {
        title: 'Valeurs limites de perte linéique et composant (FTTH / LAN)',
        headers: ['Composant / Longueur d’onde', '1310 nm (Max / Typ.)', '1550 nm (Max / Typ.)'],
        rows: [
          ['Atténuation fibre par km', '0.38 dB/km (0.35 typ.)', '0.25 dB/km (0.21 typ.)'],
          ['Épissure par fusion (soudure)', '0.10 dB (0.03 dB typ.)', '0.10 dB (0.03 dB typ.)'],
          ['Pairage de connecteurs (APC)', '0.50 dB (0.25 dB typ.)', '0.50 dB (0.25 dB typ.)'],
        ],
      },
      keyTakeaways: [
        'Code couleur 12 fibres (Standard FR) : Rouge, Bleu, Vert, Jaune, Violet, Blanc, Orange, Gris, Marron, Noir, Turquoise, Rose.',
        'Réflectance des connecteurs SC/APC ou LC/APC recommandée ≤ -60 dB pour éviter le bruit d’amplification.',
      ],
    },
  ],

  // ---------------------------------------------------- TÉLÉCOMS
  telecom: [
    {
      standardName: 'ITU-R P.530 & 3GPP TS 38.104',
      organization: 'ITU-R / 3GPP',
      title: 'Propagation en espace libre & Bilans de liaison radio (Faisceau Hertzien / 4G / 5G)',
      summary:
        "La recommandation ITU-R P.530 fournit des méthodes de prévision des affaiblissements et de la disponibilité des liaisons hertziennes terrestres. Les spécifications 3GPP encadrent la puissance et la sensibilité des équipements de réseau d'accès radio (RAN).",
      formulas: [
        {
          label: 'Affaiblissement en espace libre (FSPL)',
          formula: 'FSPL (dB) = 20×log10(d_km) + 20×log10(f_MHz) + 32.44',
          description: 'd en kilomètres, f en Mégahertz.',
        },
        {
          label: 'Rayon de la 1ère Zone de Fresnel (R1)',
          formula: 'R1 (m) = 17.32 × √((d1 × d2) / (f_GHz × d_total))',
          description: 'd1, d2 et d_total en kilomètres, f en Gigahertz.',
        },
      ],
      table: {
        title: 'Sensibilité minimale récepteur & Marge de fading recommandées',
        headers: ['Fréquence', 'Technologie', 'Marge de fadding minimale'],
        rows: [
          ['6 GHz - 18 GHz', 'Faisceau Hertzien (Point-à-Point)', '25 dB - 35 dB'],
          ['800 MHz - 3.5 GHz', 'Cellulaire LTE / 5G NR', '15 dB - 20 dB'],
        ],
      },
      keyTakeaways: [
        'Degré d obstacle minimal dans la zone de Fresnel : au moins 60 % du premier ellipsoïde de Fresnel doit être dégagé.',
        'Intégration systématique de l atténuation atmosphérique et hydrométéores (pluie) au-delà de 10 GHz.',
      ],
    },
  ],

  // ---------------------------------------------------- RÉSEAUX & IT
  networking: [
    {
      standardName: 'RFC 4632 (CIDR) & RFC 1918 (IPv4 Privé)',
      organization: 'IETF / IEEE',
      title: 'Adressage IP, Découpage VLSM & Standards Ethernet IEEE 802.3',
      summary:
        "La RFC 4632 définit le routage inter-domaines sans classe (CIDR) qui remplace l'ancien système de classes A/B/C. La RFC 1918 réserve des plages d'adresses d'interconnexion privées réutilisables sans enregistrement auprès de l'IANA.",
      formulas: [
        {
          label: 'Nombre d’hôtes utilisables par sous-réseau',
          formula: 'N_hôtes = 2^(32 - Masque) - 2',
          description: 'On soustrait 2 adresses réservées (Adresse Réseau et Adresse Broadcast).',
        },
        {
          label: 'Masque en Notation Décimale à partir du CIDR (/N)',
          formula: 'Masque = 255.255.255.255 << (32 - N)',
          description: 'Exemple : /24 donne 255.255.255.0 (256 adresses totales, 254 hôtes).',
        },
      ],
      table: {
        title: 'Plages d’adresses privées (RFC 1918)',
        headers: ['Classe', 'Plage d’adresses CIDR', 'Nombre d’hôtes maximaux'],
        rows: [
          ['Classe A', '10.0.0.0 /8', '16 777 214'],
          ['Classe B', '172.16.0.0 /12', '1 048 574'],
          ['Classe C', '192.168.0.0 /16', '65 534'],
        ],
      },
      keyTakeaways: [
        'Le premier IP d un bloc est l adresse de réseau (non attribuable à un hôte).',
        'Le dernier IP d un bloc est l adresse de diffusion généralisée (Broadcast).',
        'En IPv6 (RFC 4291), le sous-réseau standard utilisateur est un /64.',
      ],
    },
  ],

  // ---------------------------------------------------- GÉNÉRAL
  general: [
    {
      standardName: 'ISO/IEC 80000-1',
      organization: 'ISO / CEI',
      title: 'Grandeurs, Unités et Symboles Scientifiques Internationaux',
      summary:
        "L'ISO 80000-1 définit le Système International d'unités (SI) et établit les règles d'écriture des symboles, unités de mesure et préfixes décimaux/binaires.",
      formulas: [
        {
          label: 'Préfixes décimaux du SI (Puissances de 10)',
          formula: 'Kilo (10³), Méga (10⁶), Giga (10⁹), Téra (10¹²), Péta (10¹⁵)',
          description: 'Conversion standard de mesures physiques (Watts, Hertz, Mètres).',
        },
        {
          label: 'Préfixes binaires IEC (Puissances de 2)',
          formula: 'Kibi (2¹⁰ = 1024), Mebi (2²⁰), Gibi (2³⁰), Tebi (2⁴⁰)',
          description: '1 KiB = 1024 Octets (à ne pas confondre avec 1 KB = 1000 Octets).',
        },
      ],
      table: {
        title: 'Facteurs de conversion des unités usuelles',
        headers: ['Grandeur', 'Unité de départ', 'Unité cible / Équivalence'],
        rows: [
          ['Puissance', '1 kW', '1.35962 Ch (Cheval-vapeur)'],
          ['Pression', '1 bar', '100 000 Pa (100 kPa / 0.1 MPa)'],
          ['Énergie', '1 kWh', '3.6 × 10⁶ Joules (3.6 MJ)'],
        ],
      },
      keyTakeaways: [
        'Toujours séparer la valeur numérique et le symbole d’unité par un espace insécable.',
        'Respecter la casse des préfixes : « M » pour Méga (10⁶) et « m » pour milli (10⁻³).',
      ],
    },
  ],
};

export function ToolReferences({ tool }: { tool: Pick<ToolDefinition, 'slug' | 'category' | 'title'> }) {
  const references =
    REFERENCES_DATABASE[tool.category] ?? REFERENCES_DATABASE.general ?? [];

  return (
    <div className="space-y-6 pt-2">
      <div className="rounded-2xl border border-blue-200/70 bg-blue-50/50 p-4 sm:p-5 dark:border-blue-900/40 dark:bg-blue-950/20">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200">
              Conformité & Certifications Techniques
            </h3>
            <p className="text-xs text-blue-900/80 dark:text-blue-300/80 leading-relaxed">
              Les calculs effectués par l&apos;outil <strong>{tool.title}</strong> reposent rigoureusement sur les standards d&apos;ingénierie et normes officielles recensés ci-dessous.
            </p>
          </div>
        </div>
      </div>

      {references.map((ref, idx) => (
        <div
          key={`${ref.standardName}-${idx}`}
          className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-slate-900"
        >
          {/* Header de la norme */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {ref.standardName}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Award className="size-3 text-amber-500" />
              {ref.organization}
            </span>
          </div>

          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-white">{ref.title}</h4>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {ref.summary}
            </p>
          </div>

          {/* Formules scientifiques */}
          {ref.formulas && ref.formulas.length > 0 && (
            <div className="space-y-3">
              <h5 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <FileText className="size-3.5" /> Formules & Équations de référence
              </h5>
              <div className="grid gap-3 sm:grid-cols-2">
                {ref.formulas.map((item, fIdx) => (
                  <div
                    key={fIdx}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800/60 dark:bg-slate-950/60"
                  >
                    <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </span>
                    <code className="mt-1 block font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      {item.formula}
                    </code>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tableau d'abaque */}
          {ref.table && (
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {ref.table.title}
              </h5>
              <div className="scroll-x rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                    <tr>
                      {ref.table.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-3.5 py-2 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ref.table.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3.5 py-2 text-slate-600 dark:text-slate-300 ${
                              cIdx === 0 ? 'font-medium text-slate-900 dark:text-white' : 'font-mono'
                            }`}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Points clés terrain */}
          {ref.keyTakeaways && ref.keyTakeaways.length > 0 && (
            <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Info className="size-3.5 text-amber-500" />
                Exigences réglementaires & recommandations terrain
              </span>
              <ul className="space-y-1.5 pl-4 text-xs text-slate-600 dark:text-slate-400 list-disc">
                {ref.keyTakeaways.map((takeaway, tIdx) => (
                  <li key={tIdx}>
                    <span>{takeaway}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
