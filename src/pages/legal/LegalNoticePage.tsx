import { AlertTriangle } from 'lucide-react';

import { CONSERVATION, EDITEUR, HEBERGEURS, champsManquants, estRenseigne } from '@/config/legal';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Mentions légales.
 *
 * Obligatoires pour tout site professionnel français (LCEN, article 6-III).
 * Leur absence est punie d'amende, et un client professionnel les cherche avant
 * de signer.
 *
 * Les valeurs viennent de `config/legal.ts`. Celles qui manquent sont
 * SIGNALÉES à l'écran : une mention légale incomplète qui se présente comme
 * complète est pire que pas de page du tout — on ne la corrige jamais.
 */
export default function LegalNoticePage() {
  useDocumentTitle('Mentions légales');

  const manquants = champsManquants();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        Mentions légales
      </h1>

      {manquants.length > 0 ? (
        <div
          role="alert"
          className="border-warning-border bg-warning-subtle mt-6 rounded-xl border p-4 text-sm"
        >
          <p className="text-foreground flex items-center gap-2 font-semibold">
            <AlertTriangle className="text-warning size-4 shrink-0" />
            Page incomplète — à renseigner avant l’ouverture commerciale
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
            Éléments manquants : <strong>{manquants.join(', ')}</strong>. Ils se renseignent dans{' '}
            <code className="text-foreground">src/config/legal.ts</code>. Cet encart disparaîtra
            de lui-même.
          </p>
        </div>
      ) : null}

      <Section titre="Éditeur du site">
        <Ligne label="Raison sociale" valeur={EDITEUR.raisonSociale} />
        <Ligne label="Forme juridique" valeur={EDITEUR.formeJuridique} />
        <Ligne label="Capital social" valeur={EDITEUR.capitalSocial} />
        <Ligne label="Siège social" valeur={EDITEUR.siege} />
        <Ligne label="SIRET" valeur={EDITEUR.siret} />
        <Ligne label="TVA intracommunautaire" valeur={EDITEUR.tvaIntracom} />
        <Ligne label="Directeur de la publication" valeur={EDITEUR.directeurPublication} />
        <Ligne label="Contact" valeur={EDITEUR.email} />
        <Ligne label="Téléphone" valeur={EDITEUR.telephone} />
      </Section>

      <Section titre="Hébergement">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Deux prestataires interviennent. Les nommer tous deux évite de laisser croire que les
          données reposent ailleurs qu’elles ne reposent.
        </p>
        <ul className="mt-3 space-y-3">
          {HEBERGEURS.map((h) => (
            <li key={h.nom} className="border-border bg-surface-sunken rounded-xl border p-3.5">
              <p className="text-foreground text-sm font-semibold">{h.nom}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">{h.role}</p>
              <p className="text-subtle-foreground mt-1 text-xs">{h.adresse}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Propriété intellectuelle">
        <p className="text-muted-foreground text-sm leading-relaxed">
          L’ensemble des éléments composant REZO360 — code, interface, textes, marques — est
          protégé. Toute reproduction ou réutilisation sans autorisation écrite est interdite.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les données saisies par un client — missions, clients, comptes rendus, documents —
          <strong className="text-foreground"> lui appartiennent</strong>. REZO360 les héberge et
          les traite pour son compte, sans en revendiquer la propriété ni les exploiter à d’autres
          fins.
        </p>
      </Section>

      <Section titre="Durées de conservation">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Le détail des traitements figure dans la politique de confidentialité. En résumé :
        </p>
        <ul className="mt-3 space-y-1.5">
          {CONSERVATION.map((c) => (
            <li
              key={c.donnee}
              className="text-muted-foreground flex min-w-0 flex-col gap-0.5 text-sm sm:flex-row sm:justify-between sm:gap-4"
            >
              <span className="min-w-0">{c.donnee}</span>
              <span className="text-foreground min-w-0 font-medium sm:shrink-0 sm:text-right">
                {c.duree}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Signalement">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tout contenu manifestement illicite peut être signalé à{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          . Le signalement doit préciser la page et le motif.
        </p>
      </Section>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-foreground text-lg font-semibold">{titre}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** N'affiche la ligne que si la valeur est renseignée. */
function Ligne({ label, valeur }: { label: string; valeur: string }) {
  if (!estRenseigne(valeur)) {
    return null;
  }

  return (
    <div className="border-border flex flex-wrap justify-between gap-2 border-b py-2 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-foreground text-sm font-medium">{valeur}</span>
    </div>
  );
}
