import { SelectField } from '@/components/ui/SelectField';
import { useRef, useState } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  FileText,
  Building,
  Download,
  History,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { CustomerPicker, SitePicker, useCustomers, useCustomerSites } from '@/features/customers';
import { useCurrentOrganization } from '@/features/organizations';
import {
  DEFAULT_QUOTE_PAYMENT_METHOD,
  DEFAULT_QUOTE_PAYMENT_TERMS,
  toEuros,
  useCreateQuote,
  useCreateQuoteTemplate,
  useDeleteQuoteTemplate,
  useQuoteTemplates,
  useSeedQuoteTemplates,
} from '@/features/quotes';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/lib/use-document-title';

export interface QuoteLineItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Prestations standards proposées à l'amorçage d'un catalogue vide.
 *
 * Ce ne sont PAS des données de l'application : elles ne s'affichent nulle part
 * tant que personne ne les importe, et une fois importées elles appartiennent à
 * l'organisation, qui les modifie ou les supprime librement.
 */
const STANDARD_PRESETS: readonly { label: string; unit: string; priceEuros: number }[] = [
  { label: 'Diagnostic & Intervention Technique', unit: 'Forfait', priceEuros: 120 },
  { label: 'Maintenance préventive / Entretien', unit: 'Intervention', priceEuros: 95 },
  { label: 'Pose & Raccordement d’équipement', unit: 'Unité', priceEuros: 150 },
  { label: 'Passage de câbles / Gaines / Conduits', unit: 'mètre', priceEuros: 4.5 },
  { label: 'Mise en conformité & Contrôle sécurité', unit: 'Forfait', priceEuros: 180 },
  { label: 'Remplacement pièce d’usure / Composant', unit: 'Unité', priceEuros: 65 },
];

export default function QuotesPage() {
  useDocumentTitle('Devis & Chiffrage Express');

  const { organization } = useCurrentOrganization();
  const organizationId = organization?.id ?? null;

  // Un client de la base d'abord ; la saisie libre reste possible pour un
  // chiffrage avant fiche. Un devis rattaché à une fiche apparaît dans le
  // portail de ce client une fois envoyé — un devis en texte libre, jamais.
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [siteName, setSiteName] = useState('');
  const customersQuery = useCustomers(organizationId);
  const sitesQuery = useCustomerSites(customerId ?? undefined);
  const selectedCustomer = (customersQuery.data ?? []).find((c) => c.id === customerId) ?? null;
  const selectedSite = (sitesQuery.data ?? []).find((site) => site.id === siteId) ?? null;
  const [vatInput, setVatInput] = useState<string>(() =>
    organization?.default_vat_rate != null ? String(organization.default_vat_rate) : '20',
  );
  const organizationVatRate = organization?.default_vat_rate ?? 20;
  const [vatSource, setVatSource] = useState(organizationVatRate);
  if (vatSource !== organizationVatRate) {
    setVatSource(organizationVatRate);
    setVatInput(String(organizationVatRate));
  }

  const vatRate = parseFloat(vatInput.replace(',', '.')) || 0;

  /**
   * Le catalogue vit en base, plus dans le navigateur.
   *
   * C'est le savoir-faire tarifaire de l'entreprise : il doit être le même pour
   * tous ceux qui chiffrent, et survivre au poste de travail qui l'a saisi.
   */
  const templatesQuery = useQuoteTemplates(organizationId);
  const templates = templatesQuery.data ?? [];

  const createTemplate = useCreateQuoteTemplate(organizationId ?? '');
  const deleteTemplate = useDeleteQuoteTemplate(organizationId ?? '');
  const seedTemplates = useSeedQuoteTemplates(organizationId ?? '');
  const createQuote = useCreateQuote(organizationId ?? '');

  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [newPreset, setNewPreset] = useState({ label: '', unit: 'Unité', price: 50 });
  const [submitError, setSubmitError] = useState<unknown>(null);

  const [items, setItems] = useState<QuoteLineItem[]>([]);

  /**
   * Compteur de lignes.
   *
   * `Date.now()` produisait l'identifiant, ce qui rend le rendu impur — et deux
   * ajouts dans la même milliseconde donnaient la même clé React. Un compteur
   * est stable, croissant et n'a besoin d'aucune horloge.
   */
  const nextLineId = useRef(1);

  /** Référence et identifiant attribués par la base une fois le devis enregistré. */
  const [savedReference, setSavedReference] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);

  const handleAddItem = (preset?: { label: string; unit: string; price: number }) => {
    const newItem: QuoteLineItem = {
      id: `l-${nextLineId.current++}`,
      description: preset ? preset.label : 'Nouvelle prestation',
      unit: preset ? preset.unit : 'Unité',
      quantity: 1,
      unitPrice: preset ? preset.price : 50,
    };
    setItems((previous) => [...previous, newItem]);
    // Toute modification invalide la référence déjà émise : ce n'est plus le
    // même devis, et laisser l'ancien numéro affiché serait trompeur.
    setSavedReference(null);
    setSavedQuoteId(null);
  };

  const handleCreateCustomPreset = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const label = newPreset.label.trim();
    if (label === '') return;

    const unit = newPreset.unit.trim() === '' ? 'Unité' : newPreset.unit.trim();
    const price = Number(newPreset.price) || 0;

    createTemplate.mutate(
      { label, unit, priceEuros: price },
      {
        onSuccess: () => {
          // La prestation créée est ajoutée au devis en cours : c'est la raison
          // pour laquelle on vient de la créer.
          handleAddItem({ label, unit, price });
          setIsAddCustomModalOpen(false);
          setNewPreset({ label: '', unit: 'Unité', price: 50 });
        },
        onError: setSubmitError,
      },
    );
  };

  const handleDeleteCatalogPreset = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTemplate.mutate(templateId);
  };

  const handleUpdateItem = (id: string, key: keyof QuoteLineItem, value: string | number) => {
    setItems((previous) => previous.map((it) => (it.id === id ? { ...it, [key]: value } : it)));
    setSavedReference(null);
    setSavedQuoteId(null);
  };

  const handleRemoveItem = (id: string) => {
    setItems((previous) => previous.filter((it) => it.id !== id));
    setSavedReference(null);
    setSavedQuoteId(null);
  };

  // Calculs Totaux — affichage seul. Le total qui fait foi est celui de la vue
  // `quote_totals`, recalculé côté base à partir des lignes enregistrées.
  const totalHT = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalVAT = (totalHT * vatRate) / 100;
  const totalTTC = totalHT + totalVAT;

  const [isPreviewPdfOpen, setIsPreviewPdfOpen] = useState(false);
  const quoteNumber = savedReference ?? 'brouillon non enregistré';
  // Initialiseurs paresseux : la date d'émission d'un devis est fixée à
  // l'ouverture de l'écran, elle ne doit pas se recalculer à chaque rendu.
  const [todayDate] = useState(() => new Date().toLocaleDateString('fr-FR'));
  const [validUntilDate] = useState(() =>
    new Date(Date.now() + 30 * 24 * 3600 * 1000).toLocaleDateString('fr-FR'),
  );

  /**
   * Enregistre le devis et ses lignes.
   *
   * Rien n'est envoyé au client à ce stade — aucun courriel ne part de
   * l'application. Le devis devient une pièce retrouvable, avec sa référence
   * `DEV-nnnn` attribuée par la base, que l'on imprime ensuite en PDF.
   */
  const handleSendQuote = () => {
    setSubmitError(null);

    if (items.length === 0) {
      setSubmitError(new Error('Ajoutez au moins une prestation avant d’enregistrer le devis.'));
      return;
    }

    createQuote.mutate(
      {
        vatRate,
        customerId,
        siteId: customerId === null ? null : siteId,
        customerName: selectedCustomer?.name ?? clientName.trim(),
        siteName: selectedSite?.name ?? siteName.trim(),
        items: items.map((item) => ({
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          priceEuros: item.unitPrice,
        })),
      },
      {
        onSuccess: (quote) => {
          setSavedReference(quote.reference);
          setSavedQuoteId(quote.id);
        },
        onError: setSubmitError,
      },
    );
  };

  const handlePrintPdf = () => {
    window.print();
  };

  if (templatesQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 pb-12">
        <PageHeader
          title="Devis & Chiffrage Express"
          description="Simulateur et générateur de chiffrage instantané pour les prestations sur site et devis clients."
        />
        <ErrorState error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Devis & Chiffrage Express"
        description="Simulateur et générateur de chiffrage instantané pour les prestations sur site et devis clients."
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to={ROUTES.quotesHistory}>
              <History className="size-4" aria-hidden="true" />
              Historique des devis
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Formulaire Chiffrage (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Card Client & Site */}
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Building className="text-primary size-4" />
                Informations Client & Intervention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <CustomerPicker
                  organizationId={organizationId}
                  value={customerId}
                  onChange={(id) => {
                    setCustomerId(id);
                    setSiteId(null);
                  }}
                  label="Client de la base"
                />
                {customerId === null ? (
                  <Input
                    label="Ou nom du client (hors base)"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    hint="Sans fiche, le devis n’apparaîtra pas dans un espace client."
                  />
                ) : (
                  <SitePicker customerId={customerId} value={siteId} onChange={setSiteId} />
                )}
              </div>
              {customerId === null ? (
                <Input
                  label="Site ou Référence Intervention"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Catalog Prestations Rapides */}
          <Card>
            <CardHeader className="flex flex-col items-stretch gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-muted-foreground flex min-w-0 items-start gap-2 text-xs font-bold tracking-wider uppercase sm:items-center">
                <Sparkles className="text-warning mt-0.5 size-3.5 shrink-0 sm:mt-0" />
                Catalogue des Prestations Standards & Perso
              </CardTitle>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddCustomModalOpen(true)}
                className="border-primary/30 text-2xs text-primary hover:bg-primary/10 w-full cursor-pointer justify-center gap-1.5 sm:w-auto"
              >
                <Plus className="size-3" />
                Créer une prestation perso
              </Button>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-2">
                {templates.map((preset) => {
                  const priceEuros = toEuros(preset.unit_price_cents);

                  return (
                    <div
                      key={preset.id}
                      className="group border-border bg-surface text-muted-foreground hover:border-primary/50 hover:bg-primary/5 relative flex min-h-touch items-center rounded-lg border pr-1 pl-3 text-xs transition-[background-color,border-color] sm:min-h-8"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleAddItem({
                            label: preset.label,
                            unit: preset.unit,
                            price: priceEuros,
                          })
                        }
                        className="focus-visible:ring-ring flex min-h-touch min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none sm:min-h-8"
                      >
                        <Plus className="text-primary size-3 shrink-0" />
                        <span className="text-foreground max-w-[200px] truncate">
                          {preset.label}
                        </span>
                        <span className="text-success shrink-0 font-semibold">
                          ({priceEuros.toFixed(2)} €)
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCatalogPreset(preset.id, e)}
                        className="text-subtle-foreground hover:bg-error/20 hover:text-error focus-visible:ring-ring ml-1 flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:size-7"
                        title="Supprimer cette prestation du catalogue"
                        aria-label={`Supprimer ${preset.label} du catalogue`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  );
                })}

                {!templatesQuery.isPending && templates.length === 0 && (
                  <div className="space-y-2.5">
                    <p className="text-2xs text-muted-foreground">
                      Aucune prestation au catalogue. Une fois créées, elles seront réutilisables
                      pour tous vos devis, par toute l’équipe.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => seedTemplates.mutate(STANDARD_PRESETS)}
                      disabled={seedTemplates.isPending}
                      className="text-2xs cursor-pointer gap-1.5"
                    >
                      <Sparkles className="text-warning size-3" />
                      {seedTemplates.isPending
                        ? 'Import en cours…'
                        : 'Importer les prestations standards'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lignes de devis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Calculator className="text-success size-4" />
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

            <CardContent className="space-y-2 pt-5">
              {/*
                Ligne d'en-tête, à partir de `sm` seulement.

                Sur grand écran elle nomme les colonnes une fois pour toutes.
                Sur téléphone les champs s'empilent : la même information doit
                alors être portée par chaque champ, d'où les libellés inline
                ci-dessous — sans quoi trois nombres se suivent sans qu'on
                sache lequel est la quantité et lequel le prix.
              */}
              {items.length > 0 ? (
                <div className="text-subtle-foreground text-3xs hidden grid-cols-12 gap-2 px-3 font-bold tracking-wider uppercase sm:grid">
                  <span className="col-span-5">Désignation</span>
                  <span className="col-span-2 text-center">Quantité</span>
                  <span className="col-span-2 text-right">Prix unitaire</span>
                  <span className="col-span-2 text-right">Total HT</span>
                  <span className="col-span-1" />
                </div>
              ) : null}

              {items.map((item) => (
                <div
                  key={item.id}
                  className="border-border bg-surface grid grid-cols-12 items-end gap-2 rounded-lg border p-3 text-xs sm:items-center"
                >
                  <div className="col-span-12 sm:col-span-5">
                    <span
                      aria-hidden="true"
                      className="text-subtle-foreground text-3xs mb-1 block font-bold tracking-wider uppercase sm:hidden"
                    >
                      Désignation
                    </span>
                    <input
                      type="text"
                      value={item.description}
                      aria-label="Désignation de la prestation"
                      onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                      className="border-border-strong bg-surface-sunken text-foreground focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded border px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 sm:min-h-0"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <span
                      aria-hidden="true"
                      className="text-subtle-foreground text-3xs mb-1 block font-bold tracking-wider uppercase sm:hidden"
                    >
                      Qté
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      aria-label="Quantité"
                      onChange={(e) =>
                        handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      className="border-border-strong bg-surface-sunken text-foreground focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded border px-2 py-1.5 text-center text-xs focus:outline-none focus-visible:ring-2 sm:min-h-0"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-2">
                    <span
                      aria-hidden="true"
                      className="text-subtle-foreground text-3xs mb-1 block font-bold tracking-wider uppercase sm:hidden"
                    >
                      P.U.
                    </span>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.unitPrice}
                        aria-label="Prix unitaire hors taxes, en euros"
                        onChange={(e) =>
                          handleUpdateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                        className="border-border-strong bg-surface-sunken focus:border-primary focus-visible:ring-ring/30 text-success min-h-touch w-full rounded border py-1.5 pr-5 pl-2 text-right text-xs font-semibold focus:outline-none focus-visible:ring-2 sm:min-h-0"
                      />
                      <span className="text-muted-foreground text-2xs absolute right-2">€</span>
                    </div>
                  </div>

                  <div className="text-foreground col-span-3 pb-1.5 text-right text-xs font-bold sm:col-span-2 sm:pb-0">
                    {(item.quantity * item.unitPrice).toFixed(2)} €
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      // 44 px : la corbeille est collée au montant, et un
                      // pouce qui vise mal efface une ligne au lieu de la
                      // corriger.
                      className="text-subtle-foreground hover:text-error size-touch flex cursor-pointer items-center justify-center rounded-md transition-colors sm:size-8"
                      title="Supprimer la ligne"
                      aria-label={`Supprimer la ligne « ${item.description} »`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {items.length === 0 ? (
                <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center text-xs">
                  Aucune ligne pour l’instant. Touchez une prestation du catalogue ci-dessus, ou
                  ajoutez une ligne libre.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Aperçu & Synthèse Financière (1/3) */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card className="border-success/30 from-surface to-surface-sunken bg-gradient-to-b shadow-xl">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="text-success size-4" />
                Synthèse du Devis
              </CardTitle>
              <CardDescription>Calcul automatique des totaux HT & TTC.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5 text-xs">
              <div className="space-y-2.5">
                <div className="text-muted-foreground flex justify-between">
                  <span>Client :</span>
                  <strong className="text-foreground max-w-[160px] truncate">
                    {clientName || '—'}
                  </strong>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>Site :</span>
                  <strong className="text-foreground max-w-[160px] truncate">
                    {siteName || '—'}
                  </strong>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="text-muted-foreground flex items-center justify-between">
                    <span>Taux de TVA (%) :</span>
                    <div className="relative flex w-24 items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={vatInput}
                        onChange={(e) => setVatInput(e.target.value)}
                        className="border-border-strong bg-surface text-success focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded border py-1 pr-6 pl-2 text-right text-xs font-bold focus:outline-none focus-visible:ring-2 sm:min-h-0"
                      />
                      <span className="text-2xs text-muted-foreground absolute right-2 font-semibold">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="text-3xs flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setVatInput('8.5')}
                      className={cn(
                        'min-h-touch cursor-pointer rounded border px-2 transition-colors sm:min-h-0 sm:px-1.5 sm:py-0.5',
                        vatRate === 8.5
                          ? 'border-success/50 bg-success/10 text-success font-bold'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      8.5% (Antilles)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatInput('20')}
                      className={cn(
                        'min-h-touch cursor-pointer rounded border px-2 transition-colors sm:min-h-0 sm:px-1.5 sm:py-0.5',
                        vatRate === 20
                          ? 'border-success/50 bg-success/10 text-success font-bold'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      20% (Métro)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVatInput('0')}
                      className={cn(
                        'min-h-touch cursor-pointer rounded border px-2 transition-colors sm:min-h-0 sm:px-1.5 sm:py-0.5',
                        vatRate === 0
                          ? 'border-success/50 bg-success/10 text-success font-bold'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      0%
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-border space-y-2 border-t pt-4">
                <div className="text-muted-foreground flex justify-between">
                  <span>Sous-total HT :</span>
                  <span className="text-foreground font-semibold">{totalHT.toFixed(2)} €</span>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>TVA ({vatRate}%) :</span>
                  <span>{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="border-border flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-foreground font-bold">Total TTC :</span>
                  <span className="text-success text-xl font-bold">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>

              <div className="border-border space-y-2.5 border-t pt-4">
                <FormError error={submitError} />

                <Button
                  variant="primary"
                  onClick={handleSendQuote}
                  disabled={createQuote.isPending}
                  className="w-full cursor-pointer justify-center gap-2 font-semibold"
                >
                  <Send className="size-4" />
                  {createQuote.isPending
                    ? 'Enregistrement…'
                    : savedReference !== null
                      ? `Devis ${savedReference} enregistré`
                      : 'Valider & Enregistrer le devis'}
                </Button>

                {/*
                  C'est précisément ce qui manquait : le devis était bien
                  enregistré, mais rien à l'écran ne menait vers lui ensuite —
                  seul le PDF, téléchargé sur-le-champ, en gardait une trace.
                */}
                {savedQuoteId !== null ? (
                  <Button asChild variant="outline" className="w-full justify-center gap-2 text-xs">
                    <Link to={ROUTES.quoteDetail(savedQuoteId)}>
                      <FileText className="size-4" />
                      Voir le devis enregistré
                    </Link>
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  onClick={() => setIsPreviewPdfOpen(true)}
                  className="w-full cursor-pointer justify-center gap-2 text-xs"
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
          <FormError error={submitError} />

          <Input
            label="Libellé / Nom de la prestation *"
            placeholder="ex: Installation Antenne 5G / Micro-cellule"
            value={newPreset.label}
            onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quote-new-preset-unit"
                className="text-muted-foreground mb-1.5 block text-xs font-medium"
              >
                Unité de facturation
              </label>
              <SelectField
                id="quote-new-preset-unit"
                value={newPreset.unit}
                onChange={(e) => setNewPreset({ ...newPreset, unit: e.target.value })}
                className="border-border-strong bg-surface text-foreground focus:border-primary focus-visible:ring-ring/30 w-full rounded-md border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2"
              >
                <option value="Unité">Unité / Pièce</option>
                <option value="Forfait">Forfait Global</option>
                <option value="mètre">Au mètre (m)</option>
                <option value="Heure">À l'heure (h)</option>
                <option value="Intervention">Par Intervention</option>
              </SelectField>
            </div>

            <Input
              label="Prix unitaire HT (€) *"
              type="number"
              min="0"
              step="0.5"
              placeholder="ex: 150"
              value={newPreset.price}
              onChange={(e) =>
                setNewPreset({ ...newPreset, price: parseFloat(e.target.value) || 0 })
              }
              required
            />
          </div>

          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsAddCustomModalOpen(false)}
              className="w-full cursor-pointer sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="w-full cursor-pointer font-semibold sm:w-auto"
            >
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
        size="2xl"
      >
        <div className="space-y-6 pt-2">
          {/* Document Paper Preview Container (Fond Blanc Style Papier Imprimable) */}
          {/*
            ⚠️ Zone imprimable : couleurs en dur VOLONTAIRES.

            Ce devis part chez le client, à l'impression ou en PDF. Il doit
            rester noir sur blanc quel que soit le thème de l'application —
            le passer sur les jetons produirait une page noire pour quiconque
            travaille en thème sombre. Ce n'est pas une dette de design system.
          */}
          <div
            id="quote-printable-area"
            className="space-y-6 rounded-xl border border-slate-300 bg-white p-4 font-sans text-slate-900 shadow-2xl sm:p-8"
          >
            {/* Header Document */}
            <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-blue-900">
                  {organization?.name ?? 'REZO360 Pro'}
                </h2>
                {organization?.legal_name && organization.legal_name !== organization.name && (
                  <p className="text-xs font-semibold text-slate-600">{organization.legal_name}</p>
                )}
                <p className="text-2xs mt-1 text-slate-500">
                  {organization?.registration_number
                    ? `SIRET : ${organization.registration_number}`
                    : ''}
                  {organization?.registration_number && organization?.vat_number ? ' • ' : ''}
                  {organization?.vat_number ? `TVA : ${organization.vat_number}` : ''}
                </p>
                {(organization?.address_line1 || organization?.city) && (
                  <p className="text-3xs text-slate-500">
                    {[organization?.address_line1, organization?.postal_code, organization?.city]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                )}
              </div>

              <div className="text-left sm:text-right">
                <span className="inline-block rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                  DEVIS N° {quoteNumber}
                </span>
                <p className="text-2xs mt-1 text-slate-500">Émis le : {todayDate}</p>
                <p className="text-2xs text-slate-500">Valide jusqu'au : {validUntilDate}</p>
              </div>
            </div>

            {/* Informations Client & Site */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-2">
              <div>
                <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">
                  DESTINATAIRE CLIENT
                </p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {clientName || 'Client non spécifié'}
                </p>
              </div>
              <div>
                <p className="text-3xs font-bold tracking-wider text-slate-500 uppercase">
                  SITE D'INTERVENTION
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  {siteName || 'Site principal'}
                </p>
              </div>
            </div>

            {/* Tableau des Lignes du Devis */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- le tableau horizontal doit être défilable au clavier */}
            <div className="scroll-x focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none" role="region" aria-label="Lignes du devis à imprimer" tabIndex={0}>
              <table className="w-full min-w-[34rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 font-semibold text-slate-700">
                    <th className="px-3 py-2.5">Désignation de la prestation</th>
                    <th className="px-2 py-2.5 text-center">Qté</th>
                    <th className="px-2 py-2.5 text-center">Unité</th>
                    <th className="px-3 py-2.5 text-right">P.U HT</th>
                    <th className="px-3 py-2.5 text-right">Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="px-3 py-2.5 font-medium text-slate-900">{it.description}</td>
                      <td className="px-2 py-2.5 text-center">{it.quantity}</td>
                      <td className="px-2 py-2.5 text-center text-slate-500">{it.unit}</td>
                      <td className="px-3 py-2.5 text-right">{it.unitPrice.toFixed(2)} €</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                        {(it.quantity * it.unitPrice).toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Récapitulatif Financier */}
            <div className="flex flex-col items-end justify-between gap-4 border-t border-slate-300 pt-4 sm:flex-row">
              <div className="text-3xs space-y-1 text-slate-500">
                <p>
                  <strong>Conditions de règlement :</strong>{' '}
                  {organization?.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS}
                </p>
                <p>
                  <strong>Mode de paiement :</strong>{' '}
                  {organization?.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD}
                </p>
                <p>
                  <em>
                    En cas de retard de paiement, une indemnité forfaitaire de 40 € sera appliquée.
                  </em>
                </p>
              </div>

              <div className="w-full space-y-1.5 border-t border-slate-200 pt-3 text-right text-xs sm:w-56 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                <div className="flex justify-between text-slate-600">
                  <span>Total HT :</span>
                  <span className="font-semibold text-slate-900">{totalHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>TVA ({vatRate}%) :</span>
                  <span>{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-blue-900">
                  <span>TOTAL TTC :</span>
                  <span className="text-base text-blue-900">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Cadre Bon pour Accord & Signature Client */}
            <div className="mt-6 rounded-lg border border-slate-300 bg-slate-50/50 p-4">
              <div className="text-2xs flex flex-col items-start justify-between gap-3 text-slate-600 sm:flex-row">
                <div>
                  <p className="font-bold text-slate-800">Bon pour accord et commande :</p>
                  <p className="text-3xs text-slate-500">
                    Mention manuscrite « Bon pour accord », Date et Signature du Client :
                  </p>
                </div>
                <div className="text-3xs flex h-14 w-full items-center justify-center rounded border border-dashed border-slate-400 bg-white text-slate-500 italic sm:w-40">
                  [Emplacement Signature Client]
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Modal */}
          <div className="border-border flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsPreviewPdfOpen(false)}
              className="w-full cursor-pointer sm:w-auto"
            >
              Fermer
            </Button>
            <Button
              variant="primary"
              onClick={handlePrintPdf}
              className="w-full cursor-pointer gap-2 font-semibold sm:w-auto"
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
