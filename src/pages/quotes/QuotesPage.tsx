import { useState } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  FileText,
  DollarSign,
  User,
  Building,
  CheckCircle2,
  Download,
  Send,
  Sparkles,
  Zap,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

export interface QuoteLineItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

const DEFAULT_PRESET_CATALOG: { label: string; unit: string; price: number }[] = [
  { label: 'Raccordement & Soudure Fibre (Par casier / 12 FO)', unit: 'Forfait', price: 120 },
  { label: 'Tirage de câble optique monomode (Au mètre)', unit: 'mètre', price: 3.5 },
  { label: 'Pose & Fixation Boîtier PBO / PTO', unit: 'Unité', price: 65 },
  { label: 'Recette Réflectométrique OTDR (Par fibre)', unit: 'Fibre', price: 15 },
  { label: 'Pose Câble Réseau Ethernet Cat6A / UTP', unit: 'mètre', price: 4.2 },
  { label: 'Consignation & Contrôle Électrique BT', unit: 'Intervention', price: 150 },
];

export default function QuotesPage() {
  useDocumentTitle('Devis & Chiffrage Express');

  const [clientName, setClientName] = useState('Aethel Telecom Solutions');
  const [siteName, setSiteName] = useState('Datacenter Aethel Tower');
  const [vatInput, setVatInput] = useState<string>('8.5');
  const vatRate = parseFloat(vatInput.replace(',', '.')) || 0;

  const [customCatalog, setCustomCatalog] = useState<{ label: string; unit: string; price: number }[]>(() => {
    try {
      const saved = localStorage.getItem('nexoratech_quote_catalog');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_PRESET_CATALOG;
  });

  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [newPreset, setNewPreset] = useState({ label: '', unit: 'Unité', price: 50 });

  const [items, setItems] = useState<QuoteLineItem[]>([
    {
      id: 'l-1',
      description: 'Raccordement & Soudure Fibre (Par casier / 12 FO)',
      unit: 'Forfait',
      quantity: 2,
      unitPrice: 120,
    },
    {
      id: 'l-2',
      description: 'Tirage de câble optique monomode (Au mètre)',
      unit: 'mètre',
      quantity: 150,
      unitPrice: 3.5,
    },
    {
      id: 'l-3',
      description: 'Recette Réflectométrique OTDR (Par fibre)',
      unit: 'Fibre',
      quantity: 24,
      unitPrice: 15,
    },
  ]);

  const [sentSuccess, setSentSuccess] = useState(false);

  const handleAddItem = (preset?: { label: string; unit: string; price: number }) => {
    const newItem: QuoteLineItem = {
      id: `l-${Date.now()}`,
      description: preset ? preset.label : 'Nouvelle prestation',
      unit: preset ? preset.unit : 'Unité',
      quantity: 1,
      unitPrice: preset ? preset.price : 50,
    };
    setItems([...items, newItem]);
  };

  const handleCreateCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPreset.label.trim()) return;

    const item = {
      label: newPreset.label.trim(),
      unit: newPreset.unit.trim() || 'Unité',
      price: Number(newPreset.price) || 0,
    };

    const updatedCatalog = [...customCatalog, item];
    setCustomCatalog(updatedCatalog);
    try {
      localStorage.setItem('nexoratech_quote_catalog', JSON.stringify(updatedCatalog));
    } catch {
      // ignore
    }

    // Ajouter immédiatement la prestation au devis actif
    handleAddItem(item);

    setIsAddCustomModalOpen(false);
    setNewPreset({ label: '', unit: 'Unité', price: 50 });
  };

  const handleDeleteCatalogPreset = (indexToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customCatalog.filter((_, idx) => idx !== indexToDelete);
    setCustomCatalog(updated);
    try {
      localStorage.setItem('nexoratech_quote_catalog', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleUpdateItem = (id: string, key: keyof QuoteLineItem, value: any) => {
    setItems(
      items.map((it) => (it.id === id ? { ...it, [key]: value } : it)),
    );
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  // Calculs Totaux
  const totalHT = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalVAT = (totalHT * vatRate) / 100;
  const totalTTC = totalHT + totalVAT;
  const [isPreviewPdfOpen, setIsPreviewPdfOpen] = useState(false);
  const quoteNumber = useState(() => `DEV-2026-${Math.floor(1000 + Math.random() * 9000)}`)[0];
  const todayDate = new Date().toLocaleDateString('fr-FR');
  const validUntilDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('fr-FR');

  const handleSendQuote = () => {
    setSentSuccess(true);
    setTimeout(() => setSentSuccess(false), 4000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Devis & Chiffrage Express"
        description="Simulateur et générateur de chiffrage instantané pour les prestations sur site et devis clients."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulaire Chiffrage (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card Client & Site */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building className="size-4 text-blue-400" />
                Informations Client & Intervention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Nom du Client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
                <Input
                  label="Site ou Référence Intervention"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Catalog Prestations Rapides */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Sparkles className="size-3.5 text-amber-400" />
                Catalogue des Prestations Standards & Perso
              </CardTitle>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddCustomModalOpen(true)}
                className="cursor-pointer gap-1.5 text-2xs text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              >
                <Plus className="size-3" />
                Créer une prestation perso
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {customCatalog.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleAddItem(preset)}
                    className="group relative flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 pl-3 pr-2 py-1.5 text-2xs text-slate-300 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-white transition-all cursor-pointer select-none"
                  >
                    <Plus className="size-3 text-blue-400 shrink-0" />
                    <span className="truncate max-w-[220px]">{preset.label}</span>
                    <span className="font-semibold text-emerald-400 shrink-0">({preset.price} €)</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteCatalogPreset(idx, e)}
                      className="ml-1 flex size-4 items-center justify-center rounded-full text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Supprimer cette prestation du catalogue"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lignes de devis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Calculator className="size-4 text-emerald-400" />
                  Détail des Prestations & Fournitures
                </CardTitle>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAddItem()}
                className="cursor-pointer gap-1 text-xs"
              >
                <Plus className="size-3.5" />
                Ajouter une ligne
              </Button>
            </CardHeader>

            <CardContent className="space-y-3 pt-5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-12 gap-2 items-center rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-center text-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full rounded border border-slate-700 bg-slate-950 py-1.5 pl-2 pr-5 text-xs text-right text-emerald-400 font-semibold focus:border-blue-500 focus:outline-none"
                      />
                      <span className="absolute right-2 text-2xs text-slate-400">€</span>
                    </div>
                  </div>

                  <div className="col-span-3 sm:col-span-2 text-right font-bold text-white text-xs">
                    {(item.quantity * item.unitPrice).toFixed(2)} €
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 cursor-pointer transition-colors p-1"
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Aperçu & Synthèse Financière (1/3) */}
        <div className="space-y-6">
          <Card className="border-emerald-500/30 bg-gradient-to-b from-slate-900 to-slate-950 shadow-xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="size-4 text-emerald-400" />
                Synthèse du Devis
              </CardTitle>
              <CardDescription>Calcul automatique des totaux HT & TTC.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5 text-xs">
              <div className="space-y-2.5">
                <div className="flex justify-between text-slate-300">
                  <span>Client :</span>
                  <strong className="text-white truncate max-w-[160px]">{clientName || '—'}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Site :</span>
                  <strong className="text-white truncate max-w-[160px]">{siteName || '—'}</strong>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Taux de TVA (%) :</span>
                    <div className="relative flex items-center w-24">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={vatInput}
                        onChange={(e) => setVatInput(e.target.value)}
                        className="w-full rounded border border-slate-700 bg-slate-900 py-1 pl-2 pr-6 text-xs text-right text-emerald-400 font-bold focus:border-blue-500 focus:outline-none"
                      />
                      <span className="absolute right-2 text-2xs text-slate-400 font-semibold">%</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 text-3xs">
                    <button
                      type="button"
                      onClick={() => setVatInput('8.5')}
                      className={cn(
                        'rounded px-1.5 py-0.5 border cursor-pointer transition-colors',
                        vatRate === 8.5
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold'
                          : 'border-slate-800 text-slate-400 hover:text-white',
                      )}
                    >
                      8.5% (Antilles)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatInput('20')}
                      className={cn(
                        'rounded px-1.5 py-0.5 border cursor-pointer transition-colors',
                        vatRate === 20
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold'
                          : 'border-slate-800 text-slate-400 hover:text-white',
                      )}
                    >
                      20% (Métro)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatInput('0')}
                      className={cn(
                        'rounded px-1.5 py-0.5 border cursor-pointer transition-colors',
                        vatRate === 0
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-bold'
                          : 'border-slate-800 text-slate-400 hover:text-white',
                      )}
                    >
                      0%
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-4">
                <div className="flex justify-between text-slate-300">
                  <span>Sous-total HT :</span>
                  <span className="font-semibold text-white">{totalHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>TVA ({vatRate}%) :</span>
                  <span>{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-3 text-sm">
                  <span className="font-bold text-white">Total TTC :</span>
                  <span className="text-xl font-bold text-emerald-400">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-800">
                <Button
                  variant="primary"
                  onClick={handleSendQuote}
                  className="w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer font-semibold shadow-md"
                >
                  <Send className="size-4" />
                  {sentSuccess ? 'Devis envoyé au client !' : 'Valider & Envoyer le devis'}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setIsPreviewPdfOpen(true)}
                  className="w-full justify-center gap-2 cursor-pointer text-xs"
                >
                  <Download className="size-4" />
                  Télécharger le Devis PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal création de prestation personnalisée */}
      <Modal
        open={isAddCustomModalOpen}
        onOpenChange={setIsAddCustomModalOpen}
        title="Ajouter une prestation personnalisée au catalogue"
        description="Créez un nouvel élément tarifaire standardisé qui sera réutilisable pour tous vos devis."
      >
        <form onSubmit={handleCreateCustomPreset} className="space-y-4 pt-2">
          <Input
            label="Libellé / Nom de la prestation *"
            placeholder="ex: Installation Antenne 5G / Micro-cellule"
            value={newPreset.label}
            onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">Unité de facturation</label>
              <select
                value={newPreset.unit}
                onChange={(e) => setNewPreset({ ...newPreset, unit: e.target.value })}
                className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 px-3 text-xs text-slate-200 focus:border-blue-500 focus:outline-none"
              >
                <option value="Unité">Unité / Pièce</option>
                <option value="Forfait">Forfait Global</option>
                <option value="mètre">Au mètre (m)</option>
                <option value="Heure">À l'heure (h)</option>
                <option value="Fibre">Par Fibre Optique</option>
                <option value="Intervention">Par Intervention</option>
              </select>
            </div>

            <Input
              label="Prix unitaire HT (€) *"
              type="number"
              min="0"
              step="0.5"
              placeholder="ex: 150"
              value={newPreset.price}
              onChange={(e) => setNewPreset({ ...newPreset, price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="outline" type="button" onClick={() => setIsAddCustomModalOpen(false)} className="cursor-pointer">
              Annuler
            </Button>
            <Button type="submit" variant="primary" className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-semibold">
              Enregistrer & Ajouter au Devis
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Prévisualisation & Génération PDF Devis */}
      <Modal
        open={isPreviewPdfOpen}
        onOpenChange={setIsPreviewPdfOpen}
        title="Document Officiel Devis PDF"
        description="Aperçu avant impression et téléversement du document client."
      >
        <div className="space-y-6 pt-2">
          {/* Document Paper Preview Container (Fond Blanc Style Papier Imprimable) */}
          <div id="quote-printable-area" className="rounded-xl border border-slate-300 bg-white p-6 sm:p-8 text-slate-900 shadow-2xl space-y-6 font-sans">
            {/* Header Document */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-blue-900">NEXORATECH CARAÏBES</h2>
                <p className="text-xs text-slate-500 font-medium">Ingénierie Réseaux, Fibre Optique & Électricité BT</p>
                <p className="text-2xs text-slate-400 mt-1">SIRET : 849 204 192 00018 • TVA : FR 49 849204192</p>
              </div>

              <div className="text-right sm:text-right">
                <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                  DEVIS N° {quoteNumber}
                </span>
                <p className="text-2xs text-slate-500 mt-1">Émis le : {todayDate}</p>
                <p className="text-2xs text-slate-500">Valide jusqu'au : {validUntilDate}</p>
              </div>
            </div>

            {/* Informations Client & Site */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200 text-xs">
              <div>
                <p className="text-3xs uppercase font-bold tracking-wider text-slate-400">DESTINATAIRE CLIENT</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{clientName || 'Client non spécifié'}</p>
              </div>
              <div>
                <p className="text-3xs uppercase font-bold tracking-wider text-slate-400">SITE D'INTERVENTION</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{siteName || 'Site principal'}</p>
              </div>
            </div>

            {/* Tableau des Lignes du Devis */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Désignation de la prestation</th>
                    <th className="py-2.5 px-2 text-center">Qté</th>
                    <th className="py-2.5 px-2 text-center">Unité</th>
                    <th className="py-2.5 px-3 text-right">P.U HT</th>
                    <th className="py-2.5 px-3 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{it.description}</td>
                      <td className="py-2.5 px-2 text-center">{it.quantity}</td>
                      <td className="py-2.5 px-2 text-center text-slate-500">{it.unit}</td>
                      <td className="py-2.5 px-3 text-right">{it.unitPrice.toFixed(2)} €</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        {(it.quantity * it.unitPrice).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Récapitulatif Financier */}
            <div className="flex flex-col sm:flex-row justify-between items-end border-t border-slate-300 pt-4 gap-4">
              <div className="text-3xs text-slate-500 space-y-1">
                <p><strong>Conditions de règlement :</strong> Paiement à 30 jours à compter de la réception.</p>
                <p><strong>Mode de paiement :</strong> Virement bancaire / Carte bancaire Pro.</p>
                <p><em>En cas de retard de paiement, une indemnité forfaitaire de 40 € sera appliquée.</em></p>
              </div>

              <div className="w-full sm:w-56 space-y-1.5 text-xs text-right border-t sm:border-t-0 sm:border-l border-slate-200 sm:pl-4 pt-3 sm:pt-0">
                <div className="flex justify-between text-slate-600">
                  <span>Total HT :</span>
                  <span className="font-semibold text-slate-900">{totalHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>TVA ({vatRate}%) :</span>
                  <span>{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-blue-900 border-t border-slate-300 pt-2">
                  <span>TOTAL TTC :</span>
                  <span className="text-base text-blue-900">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Cadre Bon pour Accord & Signature Client */}
            <div className="mt-6 rounded-lg border border-slate-300 p-4 bg-slate-50/50">
              <div className="flex justify-between items-start text-2xs text-slate-600">
                <div>
                  <p className="font-bold text-slate-800">Bon pour accord et commande :</p>
                  <p className="text-3xs text-slate-500">Mention manuscrite « Bon pour accord », Date et Signature du Client :</p>
                </div>
                <div className="h-14 w-40 rounded border border-dashed border-slate-400 bg-white flex items-center justify-center text-3xs text-slate-400 italic">
                  [Emplacement Signature Client]
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Modal */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsPreviewPdfOpen(false)} className="cursor-pointer">
              Fermer
            </Button>
            <Button
              variant="primary"
              onClick={handlePrintPdf}
              className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2"
            >
              <Download className="size-4" />
              Imprimer / Enregistrer en PDF
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
