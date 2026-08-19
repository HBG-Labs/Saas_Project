import { CONSERVATION, EDITEUR, SOUS_TRAITANTS } from '@/config/legal';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Politique de confidentialité.
 *
 * REZO360 traite abondamment des données personnelles : noms et téléphones de
 * techniciens, adresses de chantier, positions GPS relevées à l'arrivée,
 * signatures manuscrites. L'article 13 du RGPD impose d'en informer avant la
 * collecte, pas après.
 *
 * DEUX RÔLES DISTINCTS, et les confondre serait la faute la plus coûteuse :
 * REZO360 est RESPONSABLE de traitement pour les comptes de ses clients, et
 * SOUS-TRAITANT pour les données que ces clients saisissent sur leurs propres
 * clients. Le texte le dit explicitement.
 *
 * ⚠️ Rédigé par un ingénieur d'après le fonctionnement réel du produit, non par
 * un juriste. À relire avant l'ouverture commerciale.
 */
export default function PrivacyPage() {
  useDocumentTitle('Politique de confidentialité');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        Politique de confidentialité
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Comment REZO360 traite les données personnelles, et ce que vous pouvez exiger.
      </p>

      <Section titre="Qui est responsable de quoi">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Deux situations, qu’il ne faut pas confondre.
        </p>
        <div className="mt-3 space-y-3">
          <div className="border-border bg-surface-sunken rounded-xl border p-3.5">
            <p className="text-foreground text-sm font-semibold">
              Vos données de compte — nous sommes responsables
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Adresse, nom, mot de passe chiffré, appartenance à une entreprise, abonnement. Nous
              décidons pourquoi et comment elles sont traitées.
            </p>
          </div>
          <div className="border-border bg-surface-sunken rounded-xl border p-3.5">
            <p className="text-foreground text-sm font-semibold">
              Les données que vous saisissez — nous sommes sous-traitants
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Vos clients, vos chantiers, vos comptes rendus, les signatures que vous recueillez.
              Vous en restez responsable ; nous ne les traitons que pour vous fournir le service, et
              jamais pour notre propre compte.
            </p>
          </div>
        </div>
      </Section>

      <Section titre="Ce que nous collectons, et pourquoi">
        <Tableau
          lignes={[
            ['Adresse e-mail, nom', 'Créer le compte, vous identifier, vous écrire', 'Exécution du contrat'],
            ['Mot de passe', 'Vous authentifier — stocké chiffré, jamais lisible par nous', 'Exécution du contrat'],
            ['Téléphone, fonction', 'Vous joindre, organiser les équipes', 'Exécution du contrat'],
            ['Position GPS', 'Horodater une arrivée sur chantier, à votre demande', 'Intérêt légitime'],
            ['Signature manuscrite', 'Valider un compte rendu auprès du client final', 'Exécution du contrat'],
            ['Journal d’activité', 'Tracer qui a modifié quoi, en cas de litige', 'Intérêt légitime'],
            ['Données de facturation', 'Encaisser l’abonnement, tenir la comptabilité', 'Obligation légale'],
          ]}
        />
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          <strong className="text-foreground">Aucun suivi publicitaire.</strong> REZO360 ne dépose
          pas de cookie de mesure d’audience ni de traceur tiers. Le navigateur conserve seulement
          votre session et vos préférences d’affichage — ce qui ne requiert pas de consentement.
        </p>
      </Section>

      <Section titre="Qui d’autre y a accès">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Aucune donnée n’est vendue ni cédée. Quatre prestataires interviennent, chacun pour une
          fonction précise :
        </p>
        <ul className="mt-3 space-y-2">
          {SOUS_TRAITANTS.map((s) => (
            <li
              key={s.nom}
              className="border-border flex flex-wrap items-baseline justify-between gap-2 border-b py-2 last:border-0"
            >
              <span className="text-foreground text-sm font-medium">{s.nom}</span>
              <span className="text-muted-foreground grow text-xs">{s.objet}</span>
              <span className="text-subtle-foreground text-xs">{s.zone}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Combien de temps">
        <ul className="space-y-1.5">
          {CONSERVATION.map((c) => (
            <li key={c.donnee} className="text-muted-foreground flex justify-between gap-4 text-sm">
              <span>{c.donnee}</span>
              <span className="text-foreground shrink-0 font-medium">{c.duree}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section titre="Vos droits">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Vous pouvez demander l’accès, la rectification, l’effacement, la limitation ou la
          portabilité de vos données, et vous opposer à un traitement fondé sur l’intérêt légitime.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Écrivez à{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          . Nous répondons sous un mois. À défaut de réponse satisfaisante, vous pouvez saisir la
          CNIL.
        </p>
        {/*
          Dit franchement plutôt que caché : la suppression n'est pas encore
          en libre-service dans l'application. Annoncer un droit sans dire
          comment l'exercer est une promesse creuse.
        */}
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          La suppression d’un compte se demande aujourd’hui par courriel : elle n’est pas encore
          disponible depuis l’application. Si vous appartenez à une entreprise, votre administrateur
          peut également retirer votre accès à tout moment.
        </p>
      </Section>

      <Section titre="Sécurité">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Les échanges sont chiffrés en transit. Le cloisonnement entre entreprises est appliqué
          par la base de données elle-même, et non par l’interface : une requête d’une entreprise ne
          peut pas atteindre les lignes d’une autre, quelle que soit la manière dont elle est
          formulée. Les documents déposés reposent dans des dépôts privés, accessibles par liens
          signés à durée limitée.
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

function Tableau({ lignes }: { lignes: readonly (readonly [string, string, string])[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="text-subtle-foreground text-xs">
            <th className="py-2 pr-3 font-medium">Donnée</th>
            <th className="py-2 pr-3 font-medium">Pourquoi</th>
            <th className="py-2 font-medium">Base légale</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map(([donnee, pourquoi, base]) => (
            <tr key={donnee} className="border-border border-t">
              <td className="text-foreground py-2 pr-3 font-medium">{donnee}</td>
              <td className="text-muted-foreground py-2 pr-3">{pourquoi}</td>
              <td className="text-muted-foreground py-2 text-xs">{base}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
