import { Building2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataView,
  TableAmountCell,
  TableCell,
  TableHeaderCell,
  Toolbar,
} from '@/components/ui';

/**
 * La galerie du système de design.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POURQUOI ELLE N'EXISTE QU'EN DÉVELOPPEMENT
 *
 * Elle n'a pas d'utilisateur : elle sert à regarder une primitive isolément,
 * dans les trois thèmes et aux deux largeurs, sans avoir à trouver un écran
 * métier qui l'emploie. La route qui y mène est conditionnée par
 * `import.meta.env.DEV`, remplacé par `false` à la compilation — ni la route ni
 * cette page ne partent en production.
 *
 * Elle emploie des données de démonstration, pas des données de compte : rien
 * ici ne touche la base.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface FournisseurDemo {
  id: string;
  nom: string;
  reference: string;
  ville: string;
  commandes: number;
  montantEur: number;
}

const FOURNISSEURS: FournisseurDemo[] = [
  {
    id: 'f1',
    nom: 'Nexans Câbles',
    reference: 'NEX-01',
    ville: 'Lyon',
    commandes: 14,
    montantEur: 28450,
  },
  {
    id: 'f2',
    nom: 'Rexel France',
    reference: 'REX-22',
    ville: 'Nanterre',
    commandes: 6,
    montantEur: 9120,
  },
  {
    id: 'f3',
    nom: 'Sonepar Connect',
    reference: 'SON-07',
    ville: 'Paris',
    commandes: 0,
    montantEur: 0,
  },
  {
    id: 'f4',
    nom: 'Fibre & Réseaux SAS',
    reference: 'FBR-13',
    ville: 'Bordeaux',
    commandes: 3,
    montantEur: 4380,
  },
];

const euros = (montant: number) =>
  montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function DesignGalleryPage() {
  const [recherche, setRecherche] = useState('');

  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q === '') return FOURNISSEURS;
    return FOURNISSEURS.filter(
      (f) =>
        f.nom.toLowerCase().includes(q) ||
        f.reference.toLowerCase().includes(q) ||
        f.ville.toLowerCase().includes(q),
    );
  }, [recherche]);

  return (
    <PageShell>
      <PageHeader
        title="Galerie du système de design"
        description="Les primitives, hors de tout écran métier. Basculez de thème et réduisez la fenêtre pour voir chacune se comporter."
        actions={<Badge variant="warning">Développement uniquement</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>PageShell</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            Cette page est elle-même dans un <code className="font-mono">PageShell</code> de largeur
            par défaut. Le rythme vertical — l&apos;espace entre ces cartes et la marge basse —
            vient de lui, plus de chaque page.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-foreground text-sm font-bold tracking-tight">DataView</h2>
        <p className="text-muted-foreground max-w-2xl text-xs">
          Tableau au-delà de 768 px, cartes en deçà. Les deux rendus sortent de la même liste et
          partagent le même état vide : cherchez « zzz » pour le voir des deux côtés.
        </p>

        <DataView
          items={trouves}
          getKey={(f) => f.id}
          label="Fournisseurs de démonstration"
          columnCount={4}
          toolbar={
            <Toolbar
              searchValue={recherche}
              onSearchChange={setRecherche}
              searchLabel="Rechercher un fournisseur"
              searchPlaceholder="Raison sociale, référence, ville…"
              summary={`${trouves.length} fournisseur${trouves.length !== 1 ? 's' : ''} affiché${
                trouves.length !== 1 ? 's' : ''
              }`}
              actions={
                <Button size="sm" className="gap-1.5">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Ajouter
                </Button>
              }
            />
          }
          head={
            <>
              <TableHeaderCell>Fournisseur</TableHeaderCell>
              <TableHeaderCell>Ville</TableHeaderCell>
              <TableHeaderCell>Commandes</TableHeaderCell>
              <TableHeaderCell className="text-right">Montant HT</TableHeaderCell>
            </>
          }
          renderRow={(f) => (
            <>
              <TableCell>
                <p className="text-foreground font-bold">{f.nom}</p>
                <p className="text-3xs text-subtle-foreground font-mono">{f.reference}</p>
              </TableCell>
              <TableCell>{f.ville}</TableCell>
              <TableCell>{f.commandes}</TableCell>
              <TableAmountCell>{euros(f.montantEur)}</TableAmountCell>
            </>
          )}
          renderCard={(f) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-foreground truncate text-sm font-bold">{f.nom}</h3>
                  <p className="text-3xs text-subtle-foreground font-mono">{f.reference}</p>
                </div>
                {f.commandes > 0 ? <Badge variant="info">{f.commandes} commandes</Badge> : null}
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>{f.ville}</span>
                <span className="text-foreground font-medium tabular-nums">
                  {euros(f.montantEur)} HT
                </span>
              </div>
            </>
          )}
          empty={{
            icon: Building2,
            title: 'Aucun fournisseur trouvé',
            description: 'Modifiez votre recherche ou ajoutez un partenaire à votre annuaire.',
          }}
        />
      </div>
    </PageShell>
  );
}
