import { AlertTriangle } from 'lucide-react';

import { EDITEUR } from '@/config/legal';
import { useDocumentTitle } from '@/lib/use-document-title';

/**
 * Conditions générales de vente — prestations HBG Labs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNE ACTIVITÉ DISTINCTE DE L'ABONNEMENT REZO360
 *
 * REZO360 (`TermsPage.tsx`, /conditions-generales) est un produit vendu par
 * abonnement à des utilisateurs finaux. HBG Labs — la même entité, EI de
 * Harry Bergoz — vend en parallèle des prestations sur devis : création de
 * sites, web design, développement web et SaaS sur mesure, maintenance,
 * conseil. Deux activités, deux contrats : ce texte ne remplace ni ne modifie
 * les CGV/CGU de REZO360.
 *
 * CE QUE JE NE PEUX PAS DÉCIDER À LA PLACE DE HARRY
 *
 * Acompte (30 %), moyen de paiement (virement) et délai de garantie (30
 * jours) sont des VALEURS USUELLES DU SECTEUR pour une prestation de
 * développement web freelance en France — pas des faits vérifiés sur la
 * pratique commerciale de HBG Labs. Elles sont écrites en clair dans le texte
 * (un contrat ne doit pas avoir l'air provisoire pour le client qui le lit) et
 * restent à confirmer ou ajuster par Harry.
 *
 * Le nom d'un médiateur de la consommation et la confirmation du régime de
 * TVA restent en revanche de vrais inconnus, pas des défauts raisonnables :
 * ils sont signalés — encart en haut de page et repères <Preciser> dans le
 * texte — plutôt que remplis par une valeur plausible.
 *
 * ⚠️ Rédigé par un ingénieur à partir d'un modèle générique de CGV de
 * prestations numériques, non par un juriste. Aucune clause ci-dessous n'a été
 * relue par un avocat. À faire valider avant le premier devis signé.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const POINTS_A_DECIDER = [
  'Nom et coordonnées du médiateur de la consommation (obligatoire dès le premier client particulier)',
  'Confirmation du régime de TVA (franchise en base par défaut en micro-entreprise, sauf dépassement de seuil ou option)',
];

export default function ServicesTermsPage() {
  useDocumentTitle('CGV — Prestations HBG Labs');

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
        Conditions générales de vente — Prestations
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Ce que vous commandez auprès de HBG Labs, ce que nous devons, et à qui appartient le
        résultat.
      </p>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        Ces conditions couvrent les prestations réalisées sur devis (création de sites,
        d’applications, maintenance, conseil). Elles sont distinctes des{' '}
        <a href="/conditions-generales" className="text-primary hover:underline">
          conditions d’abonnement à REZO360
        </a>
        .
      </p>

      <div
        role="alert"
        className="border-warning-border bg-warning-subtle mt-6 rounded-xl border p-4 text-sm"
      >
        <p className="text-foreground flex items-center gap-2 font-semibold">
          <AlertTriangle className="text-warning size-4 shrink-0" />
          Choix commerciaux à trancher avant le premier devis
        </p>
        <ul className="text-muted-foreground mt-1.5 list-inside list-disc space-y-0.5 text-xs leading-relaxed">
          {POINTS_A_DECIDER.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">
          Acompte, moyen de paiement et délai de garantie (sections 3, 4 et 8) sont préremplis
          avec des valeurs usuelles du secteur — à confirmer ou ajuster dans{' '}
          <code className="text-foreground">ServicesTermsPage.tsx</code>.
        </p>
      </div>

      <Section titre="1. Objet">
        <p className="text-muted-foreground text-sm leading-relaxed">
          HBG Labs, entreprise individuelle représentée par Harry Bergoz, propose des prestations
          de création de sites web, web design, développement web et d’applications web ou SaaS
          sur mesure, de maintenance et d’évolution, ainsi que du conseil et de l’accompagnement
          digital. Chaque prestation fait l’objet d’un devis préalable décrivant précisément son
          périmètre.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Ces prestations s’adressent à des clients professionnels comme, le cas échéant, à des
          particuliers. Les sections 14 et 15 précisent les règles propres à chaque catégorie.
        </p>
      </Section>

      <Section titre="2. Définitions">
        <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Client</strong> — la personne physique ou morale
            qui commande une prestation.
          </li>
          <li>
            <strong className="text-foreground">Devis</strong> — le document décrivant le
            périmètre, le prix et les délais d’une prestation, avant commande.
          </li>
          <li>
            <strong className="text-foreground">Prestation</strong> — l’ensemble des travaux
            décrits au devis accepté.
          </li>
          <li>
            <strong className="text-foreground">Livrable</strong> — le résultat remis au client à
            l’issue de la prestation : code source, maquette, site déployé, documentation.
          </li>
          <li>
            <strong className="text-foreground">Réception</strong> — la validation, expresse ou
            tacite, par laquelle le client accepte le livrable.
          </li>
        </ul>
      </Section>

      <Section titre="3. Devis et commande">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Chaque devis est établi à titre gratuit et reste valable le délai qu’il indique. Il
          n’engage HBG Labs que pour le périmètre qu’il décrit : toute demande en dehors de ce
          périmètre fait l’objet d’un devis complémentaire.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          La commande est formée par l’acceptation écrite du devis (signature, mention « bon pour
          accord », ou validation électronique équivalente). Elle est conditionnée au versement
          d’un acompte de <strong className="text-foreground">30 % du prix total</strong> à la
          commande, le solde étant dû à la livraison, sauf échéancier différent prévu au devis.
        </p>
      </Section>

      <Section titre="4. Prix et paiement">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Le prix est celui figurant au devis accepté, en euros. Sauf mention contraire,
          HBG Labs relève du régime de la franchise en base de TVA (article 293 B du Code
          général des impôts) : la TVA n’est pas applicable, et n’est donc pas ajoutée au prix —{' '}
          <Preciser>à confirmer si le seuil de franchise venait à être dépassé</Preciser>.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Le paiement s’effectue par virement bancaire, aux échéances prévues au devis.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <strong className="text-foreground">Clients professionnels</strong> — tout retard de
          paiement entraîne, de plein droit et sans mise en demeure préalable, l’application de
          pénalités au taux d’intérêt légal majoré ainsi que d’une indemnité forfaitaire de
          recouvrement de 40 € (articles L441-10 et D441-5 du Code de commerce), sans préjudice
          d’une indemnisation complémentaire sur justificatif.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <strong className="text-foreground">Clients particuliers</strong> — en cas de retard, une
          mise en demeure est adressée avant toute pénalité ; aucune indemnité forfaitaire de
          recouvrement ne s’applique aux relations avec un consommateur.
        </p>
      </Section>

      <Section titre="5. Réalisation de la prestation">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Les délais indiqués au devis sont donnés à titre indicatif et courent à compter de la
          réception des éléments nécessaires à la prestation (contenus, accès, validations). Un
          retard dans leur transmission par le client reporte d’autant les délais annoncés, sans
          que ce report puisse être imputé à HBG Labs.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Pour les prestations engageant plusieurs étapes, chaque jalon est soumis à validation du
          client avant le passage à l’étape suivante. L’absence de retour dans un délai raisonnable
          vaut validation tacite.
        </p>
      </Section>

      <Section titre="6. Obligations respectives">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Le client s’engage à fournir en temps utile les contenus, accès et informations
          nécessaires à la réalisation de la prestation, et à valider les livrables intermédiaires
          dans des délais raisonnables.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          HBG Labs s’engage à mettre en œuvre les moyens et compétences nécessaires à la
          réalisation de la prestation, conformément aux règles de l’art. Sauf stipulation
          contraire expresse au devis, cette obligation est une obligation de moyens et non de
          résultat.
        </p>
      </Section>

      <Section titre="7. Propriété intellectuelle">
        <p className="text-muted-foreground text-sm leading-relaxed">
          <strong className="text-foreground">Ce qui est cédé au client.</strong> Sauf stipulation
          contraire au devis, les droits de propriété intellectuelle sur le livrable spécifique
          commandé — le site, l’application ou le design réalisés sur mesure pour ce client — sont
          cédés au client à réception intégrale du prix, et pas avant. Jusqu’à ce paiement
          intégral, HBG Labs reste titulaire de ces droits.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <strong className="text-foreground">Ce qui reste la propriété de HBG Labs.</strong> Le
          paiement d’une prestation n’emporte cession que du livrable spécifique commandé — jamais
          des méthodes, gabarits, composants internes, bibliothèques de code, outils ou savoir-faire
          réutilisables que HBG Labs a développés pour son propre usage et mobilise d’un projet à
          l’autre. Un client ne devient pas propriétaire du studio parce qu’il en devient client.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <strong className="text-foreground">Composants et licences tiers.</strong> Les
          bibliothèques open source intégrées au livrable restent régies par leurs licences
          respectives, que le client s’engage à respecter. Il en va de même des polices, images,
          icônes ou vidéos sous licence tierce : leur usage par le client se limite à ce que la
          licence d’origine autorise, et ne leur est pas transféré au-delà.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          <strong className="text-foreground">Contenus fournis par le client.</strong> Le client
          garantit détenir les droits nécessaires sur les contenus (textes, images, marques,
          bases de données) qu’il transmet, et garantit HBG Labs contre tout recours d’un tiers à
          ce titre.
        </p>
      </Section>

      <Section titre="8. Responsabilité et garantie">
        <p className="text-muted-foreground text-sm leading-relaxed">
          La responsabilité de HBG Labs ne peut être engagée qu’en cas de faute prouvée dans
          l’exécution de la prestation, à l’exclusion de tout dommage indirect (perte
          d’exploitation, perte de chance, atteinte à l’image). Cette responsabilité ne peut être
          recherchée au titre de contenus, accès ou instructions fournis par le client, ni d’un
          usage du livrable non conforme à sa destination.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les anomalies signalées par écrit dans un délai de{' '}
          <strong className="text-foreground">30 jours</strong> suivant la réception sont
          corrigées sans frais supplémentaires. Passé ce délai, ou pour toute évolution ne relevant
          pas d’une anomalie, l’intervention fait l’objet d’un nouveau devis.
        </p>
      </Section>

      <Section titre="9. Maintenance et abonnements récurrents">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Lorsqu’un contrat de maintenance est souscrit en complément d’une prestation, il couvre,
          dans les limites précisées au devis correspondant :
        </p>
        <ul className="text-muted-foreground mt-3 list-inside list-disc space-y-1.5 text-sm leading-relaxed">
          <li>
            <strong className="text-foreground">Maintenance corrective</strong> — correction des
            dysfonctionnements constatés sur le périmètre livré.
          </li>
          <li>
            <strong className="text-foreground">Maintenance évolutive</strong> — améliorations et
            évolutions mineures, dans la limite du volume convenu.
          </li>
          <li>
            <strong className="text-foreground">Mises à jour et sécurité</strong> — application des
            correctifs de sécurité des composants utilisés.
          </li>
          <li>
            <strong className="text-foreground">Sauvegardes</strong> — fréquence et rétention
            précisées au devis de maintenance.
          </li>
          <li>
            <strong className="text-foreground">Disponibilité</strong> — fournie sans engagement
            contractuel de résultat, sauf niveau de service explicitement souscrit.
          </li>
          <li>
            <strong className="text-foreground">Délai d’intervention</strong> — délai indicatif
            précisé au devis, hors cas de force majeure.
          </li>
        </ul>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Sont exclues de la maintenance les évolutions majeures, les refontes et toute
          intervention rendue nécessaire par une modification du livrable réalisée par un tiers.
          Un contrat de maintenance à échéance mensuelle est résiliable à tout moment avec un
          préavis d’un mois, sans effet rétroactif sur les mois déjà réglés.
        </p>
      </Section>

      <Section titre="10. Résiliation, force majeure, confidentialité">
        <p className="text-muted-foreground text-sm leading-relaxed">
          En cas d’interruption d’une prestation avant son terme, les travaux déjà réalisés sont
          dus au prorata de leur avancement ; l’acompte versé reste acquis à hauteur des travaux
          engagés.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Aucune des parties n’est responsable d’un manquement causé par un cas de force majeure au
          sens de l’article 1218 du Code civil.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les informations échangées dans le cadre de la prestation sont traitées de manière
          confidentielle et ne sont communiquées à un tiers qu’avec l’accord du client ou en
          exécution d’une obligation légale.
        </p>
      </Section>

      <Section titre="11. Données personnelles">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Un échange autour d’un devis (nom, e-mail, téléphone, société, description du projet)
          donne lieu à un traitement de données à caractère personnel dont HBG Labs est
          responsable. Ces données sont conservées le temps nécessaire à l’échange puis, pour un
          prospect sans suite, trois ans à compter du dernier contact — durée recommandée par la
          CNIL. Elles ne sont ni cédées ni utilisées à d’autres fins que la relation commerciale.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Vous pouvez demander l’accès, la rectification, l’effacement ou la limitation de ces
          données par écrit à{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          , et saisir la CNIL à défaut de réponse satisfaisante.
        </p>
      </Section>

      <Section titre="12. Recours à l’intelligence artificielle">
        <p className="text-muted-foreground text-sm leading-relaxed">
          HBG Labs peut recourir à des outils d’intelligence artificielle dans son processus de
          conception et de développement (génération ou relecture de code, assistance à la
          rédaction, recherche). Chaque production issue de ces outils fait l’objet d’une validation
          humaine avant intégration au livrable : HBG Labs demeure seul responsable du résultat
          final, quel que soit l’outil ayant contribué à sa production.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Aucune donnée confidentielle ou personnelle transmise par le client n’est communiquée à
          un fournisseur d’intelligence artificielle sans son autorisation préalable. Le client
          s’engage réciproquement à ne pas transmettre à HBG Labs, pour un usage avec ces outils,
          de données qu’il n’est pas autorisé à divulguer.
        </p>
      </Section>

      <Section titre="13. Sous-traitants et outils tiers">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Selon les besoins du projet, HBG Labs peut faire appel à des prestataires ou outils
          tiers pour héberger, développer ou faire fonctionner un livrable — à titre d’exemple :
          Supabase, Vercel, Stripe, Google, Microsoft, ou des fournisseurs d’intelligence
          artificielle comme OpenAI ou Anthropic. Cette liste est indicative ; les prestataires
          effectivement mobilisés sur un projet donné sont précisés au devis —{' '}
          <Preciser>à confirmer projet par projet</Preciser>.
        </p>
      </Section>

      <Section titre="14. Dispositions propres aux clients professionnels (B2B)">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Entre professionnels, aucun droit de rétractation légal ne s’applique : la commande
          engage dès son acceptation, dans les conditions du présent contrat.
        </p>
      </Section>

      <Section titre="15. Dispositions propres aux clients particuliers (B2C)">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Un particulier bénéficie en principe d’un délai de rétractation de quatorze jours après
          la commande (article L221-18 du Code de la consommation). Ce droit ne s’applique
          toutefois pas à un service « confectionné selon les spécifications du consommateur »
          (article L221-28 3°) — ce qu’est, par nature, un site ou une application développés sur
          mesure. Cette exception ne joue que si le client en a été informé clairement avant la
          commande, et que l’exécution de la prestation n’a commencé qu’après son accord exprès et
          renoncement à son droit de rétractation, recueilli par écrit.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Conformément à l’article L616-1 du Code de la consommation, tout client particulier peut
          recourir gratuitement à un médiateur de la consommation en cas de litige non résolu à
          l’amiable : <Preciser>médiateur à désigner avant toute vente à un particulier</Preciser>.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Les garanties légales de conformité et des vices cachés s’appliquent dans les conditions
          de droit commun, sans que les présentes conditions ne puissent y déroger au détriment du
          consommateur.
        </p>
      </Section>

      <Section titre="16. Droit applicable et juridiction">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Les présentes conditions sont soumises au droit français. Entre professionnels, tout
          litige relève des tribunaux du ressort du siège de HBG Labs, à défaut de résolution
          amiable. À l’égard d’un consommateur, cette clause ne prive pas le client de la
          possibilité de saisir la juridiction de son lieu de résidence, conformément aux règles
          protectrices du droit de la consommation.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Toute question :{' '}
          <a href={`mailto:${EDITEUR.email}`} className="text-primary hover:underline">
            {EDITEUR.email}
          </a>
          .
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

/** Un point de politique commerciale non tranché se voit dans la phrase, pas deviné. */
function Preciser({ children }: { children: React.ReactNode }) {
  return <span className="text-warning font-medium">[{children}]</span>;
}
