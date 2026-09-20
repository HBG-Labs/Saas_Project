import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building2 } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DataView } from './DataView';
import { TableCell, TableHeaderCell } from './Table';
import { Toolbar } from './Toolbar';

interface Fournisseur {
  id: string;
  name: string;
  city: string;
}

const FOURNISSEURS: Fournisseur[] = [
  { id: 'f1', name: 'Nexans Câbles', city: 'Lyon' },
  { id: 'f2', name: 'Rexel France', city: 'Nanterre' },
];

function Liste({ items = FOURNISSEURS }: { items?: Fournisseur[] }) {
  return (
    <DataView
      items={items}
      getKey={(f) => f.id}
      label="Fournisseurs"
      columnCount={2}
      head={
        <>
          <TableHeaderCell>Fournisseur</TableHeaderCell>
          <TableHeaderCell>Ville</TableHeaderCell>
        </>
      }
      renderRow={(f) => (
        <>
          <TableCell>{f.name}</TableCell>
          <TableCell>{f.city}</TableCell>
        </>
      )}
      renderCard={(f) => (
        <div>
          <h3>{f.name}</h3>
          <p>{f.city}</p>
        </div>
      )}
      empty={{
        icon: Building2,
        title: 'Aucun fournisseur trouvé',
        description: 'Ajoutez un partenaire ou modifiez votre recherche.',
      }}
    />
  );
}

describe('DataView', () => {
  it('rend les mêmes données en cartes et en tableau', () => {
    /*
      L'invariant central. Les deux mises en page restent distinctes — un
      tableau ne se lit pas comme une carte — mais elles portent les mêmes
      éléments. Séparées, elles divergeaient : une colonne ajoutée d'un côté
      n'apparaissait pas de l'autre.

      jsdom n'applique pas les points de rupture : les deux rendus sont donc
      présents, ce qui est précisément ce qu'on veut vérifier ici.
    */
    render(<Liste />);

    for (const f of FOURNISSEURS) {
      expect(screen.getAllByText(f.name), `${f.name} des deux côtés`).toHaveLength(2);
      expect(screen.getAllByText(f.city), `${f.city} des deux côtés`).toHaveLength(2);
    }
  });

  it('donne le même état vide aux deux mises en page', () => {
    // Plusieurs écrans portent aujourd'hui deux textes vides différents pour
    // la même situation — on ne regarde jamais les deux tailles à la fois.
    render(<Liste items={[]} />);

    expect(screen.getAllByText('Aucun fournisseur trouvé')).toHaveLength(2);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('fait couvrir toute la largeur du tableau à l’état vide', () => {
    render(<Liste items={[]} />);

    const cellule = screen.getByRole('cell');
    expect(cellule).toHaveAttribute('colspan', '2');
  });

  it('nomme la zone défilante et la rend atteignable au clavier', () => {
    /*
      Le tableau déborde volontairement en largeur. Sans `tabIndex`, ce qui
      dépasse à droite n'est accessible qu'à la souris ; sans nom, la zone
      focalisable n'est annoncée par rien.
    */
    render(<Liste />);

    const zone = screen.getByRole('region', { name: 'Fournisseurs' });
    expect(zone).toHaveAttribute('tabindex', '0');
  });

  it('donne une clé stable à chaque ligne', () => {
    // Une clé instable casse le focus et l'état des champs à chaque rendu.
    // Les doublons de clé remontent en avertissement React, pas en échec :
    // on les fait donc échouer explicitement.
    const erreur = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Liste items={[...FOURNISSEURS, { id: 'f3', name: 'Sonepar', city: 'Paris' }]} />);
    expect(erreur).not.toHaveBeenCalled();
    erreur.mockRestore();
  });
});

describe('Toolbar', () => {
  function Recherche() {
    const [valeur, setValeur] = useState('');
    const trouves = FOURNISSEURS.filter((f) =>
      f.name.toLowerCase().includes(valeur.trim().toLowerCase()),
    );

    return (
      <Toolbar
        searchValue={valeur}
        onSearchChange={setValeur}
        searchLabel="Rechercher un fournisseur"
        searchPlaceholder="Raison sociale, ville…"
        summary={`${trouves.length} fournisseur${trouves.length !== 1 ? 's' : ''} affiché${
          trouves.length !== 1 ? 's' : ''
        }`}
      />
    );
  }

  it('porte une étiquette accessible malgré le libellé masqué', () => {
    // Un champ de recherche sans étiquette n'est qu'un rectangle : le texte
    // indicatif disparaît dès la première frappe.
    render(<Recherche />);

    expect(
      screen.getByRole('searchbox', { name: 'Rechercher un fournisseur' }),
    ).toBeInTheDocument();
  });

  it('annonce le décompte des résultats à chaque frappe', async () => {
    /*
      Taper remplace la liste sans rien dire. À la souris on voit le tableau
      bouger ; au lecteur d'écran, il ne se passe rien. Ce message est le seul
      retour que reçoivent certaines personnes.
    */
    const user = userEvent.setup();
    render(<Recherche />);

    const annonce = screen.getByText('2 fournisseurs affichés');
    expect(annonce).toHaveAttribute('aria-live', 'polite');

    await user.type(screen.getByRole('searchbox'), 'Nexans');

    expect(screen.getByText('1 fournisseur affiché')).toBeInTheDocument();
  });
});
