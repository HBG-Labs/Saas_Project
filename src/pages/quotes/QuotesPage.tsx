import { SelectField } from '@/components/ui/SelectField';
import { useCallback, useRef, useState } from 'react';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  FileText,
  Building,
  Download,
  Ellipsis,
  History,
  Send,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import { Link } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { FormError } from '@/components/feedback/FormError';
import { DocumentWizardStepper } from '@/components/finance/DocumentWizardStepper';
import { SalesNavTabs } from '@/components/finance/SalesNavTabs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/config/routes';
import { Table } from '@/components/ui/Table';
import { CustomerPicker, SitePicker, useCustomers, useCustomerSites } from '@/features/customers';
import {
  DocumentNumberingBanner,
  DocumentNumberingModal,
  DocumentLogoEditor,
  DocumentOptionsPanel,
  DEFAULT_DOCUMENT_OPTIONS,
  serializeDocumentOptions,
  useDocumentNumbering,
  type DocumentOptions,
} from '@/features/documents';
import { useCurrentOrganization, useUploadOrganizationLogo } from '@/features/organizations';
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
import type { Customer } from '@/types/domain';

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

const QUOTE_STEPS = [
  { label: 'Client', description: 'Choisissez le client et le site d’intervention.' },
  { label: 'Prestations', description: 'Ajoutez et chiffrez les prestations du devis.' },
  { label: 'Conditions', description: 'Vérifiez la TVA et les modalités applicables.' },
  { label: 'Validation', description: 'Contrôlez les montants avant l’enregistrement.' },
] as const;

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  return localIsoDate(new Date(base.getTime() + days * ONE_DAY_MS));
}

function formatDocumentDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

function customerAddress(customer: Customer | null): string[] {
  return customer
    ? [
        [customer.address_line1, customer.address_line2].filter(Boolean).join(' '),
        [customer.postal_code, customer.city].filter(Boolean).join(' '),
        customer.country,
      ].filter((line): line is string => Boolean(line))
    : [];
}

export default function QuotesPage() {
  useDocumentTitle('Nouveau devis');

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
  const selectedCustomerAddress = customerAddress(selectedCustomer);
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
  const [currentStep, setCurrentStep] = useState(0);
  const [desktopOptionsOpen, setDesktopOptionsOpen] = useState(false);
  const [documentOptions, setDocumentOptions] = useState<DocumentOptions>({
    ...DEFAULT_DOCUMENT_OPTIONS,
    showAcceptanceTerms: true,
    showSignature: true,
  });
  const [numberingOpen, setNumberingOpen] = useState(false);
  const [discountRate, setDiscountRate] = useState(0);
  const [documentTitle, setDocumentTitle] = useState('');
  const [freeField, setFreeField] = useState('');
  const numbering = useDocumentNumbering(organizationId, 'quote');
  const uploadLogo = useUploadOrganizationLogo(organizationId ?? '');
  const wizardRef = useRef<HTMLDivElement>(null);

  const goToStep = (step: number) => {
    setCurrentStep(step);
    requestAnimationFrame(() =>
      wizardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
    );
  };

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
  const grossHT = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = (grossHT * discountRate) / 100;
  const totalHT = grossHT - discountAmount;
  const totalVAT = (totalHT * vatRate) / 100;
  const totalTTC = totalHT + totalVAT;

  const [isPreviewPdfOpen, setIsPreviewPdfOpen] = useState(false);
  const quoteNumber = savedReference ?? 'brouillon non enregistré';
  // Initialiseurs paresseux : la date d'émission d'un devis est fixée à
  // l'ouverture de l'écran, elle ne doit pas se recalculer à chaque rendu.
  const [issueDateIso, setIssueDateIso] = useState(() => localIsoDate(new Date()));
  const [validityDays, setValidityDays] = useState(60);
  const validUntilIso = addCalendarDays(issueDateIso, validityDays);
  const issueDateLabel = formatDocumentDate(issueDateIso);
  const validUntilDate = formatDocumentDate(validUntilIso);
  const updateLogoSize = useCallback(
    (size: { width: number; height: number }) =>
      setDocumentOptions((current) => ({
        ...current,
        logoWidth: size.width,
        logoHeight: size.height,
      })),
    [],
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
        discountRate,
        documentOptions: serializeDocumentOptions(documentOptions),
        ...(documentOptions.showTitle ? { title: documentTitle.trim() } : {}),
        ...(documentOptions.showFreeField ? { notes: freeField.trim() } : {}),
        issueDate: issueDateIso,
        validUntil: validUntilIso,
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
          title="Nouveau devis"
          description="Préparez le chiffrage, vérifiez les montants puis enregistrez le document client."
        />
        <ErrorState error={templatesQuery.error} onRetry={() => void templatesQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="lg:bg-surface-sunken mx-auto max-w-6xl space-y-6 pb-12 lg:fixed lg:inset-0 lg:z-50 lg:max-w-none lg:space-y-0 lg:overflow-y-auto lg:pb-24">
      <div className="lg:hidden">
        <PageHeader
          title="Nouveau devis"
          description="Préparez le chiffrage, vérifiez les montants puis enregistrez le document client."
          actions={
            <Button asChild variant="outline" className="gap-2">
              <Link to={ROUTES.quotesHistory}>
                <History className="size-4" aria-hidden="true" />
                Voir les devis
              </Link>
            </Button>
          }
        />
        <SalesNavTabs />
      </div>

      <header className="border-border bg-surface/95 sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b px-6 backdrop-blur lg:flex">
        <Button asChild variant="ghost" size="sm" aria-label="Fermer l’éditeur de devis">
          <Link to={ROUTES.quotesHistory}>
            <X className="size-5" aria-hidden="true" />
          </Link>
        </Button>

        <div className="text-center">
          <p className="text-muted-foreground text-2xs font-semibold tracking-wider uppercase">
            Total TTC
          </p>
          <p className="text-foreground text-xl font-black tabular-nums">{totalTTC.toFixed(2)} €</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setDesktopOptionsOpen((open) => !open)}
          aria-label={
            desktopOptionsOpen ? 'Fermer les options du devis' : 'Ouvrir les options du devis'
          }
          title="Options du devis"
          aria-expanded={desktopOptionsOpen}
          aria-controls="quote-desktop-options"
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </Button>
      </header>

      <div ref={wizardRef} className="scroll-mt-20 lg:hidden">
        <DocumentWizardStepper
          steps={QUOTE_STEPS}
          currentStep={currentStep}
          onStepChange={goToStep}
          label="Création du devis"
        />
      </div>

      <div
        className={cn(
          'mx-auto max-w-4xl space-y-6 lg:mx-0 lg:grid lg:max-w-none lg:items-start lg:gap-5 lg:space-y-0 lg:px-6 lg:py-5',
          desktopOptionsOpen
            ? 'lg:grid-cols-[minmax(0,56rem)_18rem] lg:justify-center'
            : 'lg:grid-cols-[minmax(0,56rem)] lg:justify-center',
        )}
      >
        <section className="space-y-6">
          {numbering.data ? (
            <DocumentNumberingBanner
              documentKind="quote"
              nextValue={numbering.data.next_value}
              format={numbering.data.format}
              onModify={() => setNumberingOpen(true)}
            />
          ) : null}
          <div
            aria-label="Document devis"
            className="financial-paper financial-paper-a4 border-border relative hidden overflow-hidden rounded-sm border px-12 py-11 shadow-[0_18px_55px_rgba(15,23,42,0.12)] lg:block xl:px-14"
          >
            <div
              className="financial-paper-accent-bar absolute inset-x-0 top-0 h-1.5"
              aria-hidden="true"
            />

            <div className="mb-10 flex items-start justify-between gap-8">
              <div className="flex min-w-0 flex-col items-start gap-3">
                <DocumentLogoEditor
                  src={organization?.logo_url}
                  size={{
                    width: documentOptions.logoWidth,
                    height: documentOptions.logoHeight,
                  }}
                  onSizeChange={updateLogoSize}
                  onUpload={(file) => uploadLogo.mutateAsync(file)}
                />
                <div className="financial-paper-company min-w-64 border border-dashed px-3 py-2.5">
                  <p className="text-foreground text-lg font-black tracking-tight">
                    {organization?.name ?? 'REZO360 Pro'}
                  </p>
                  {organization?.legal_name && organization.legal_name !== organization.name ? (
                    <p className="text-muted-foreground mt-0.5 text-xs font-semibold">
                      {organization.legal_name}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-3xs mt-1 max-w-sm leading-relaxed">
                    {[
                      organization?.address_line1,
                      organization?.address_line2,
                      [organization?.postal_code, organization?.city].filter(Boolean).join(' '),
                      organization?.country,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Coordonnées de votre entreprise'}
                  </p>
                  {organization?.registration_number ? (
                    <p className="text-muted-foreground text-3xs mt-1">
                      SIRET {organization.registration_number}
                      {organization.vat_number ? ` · TVA ${organization.vat_number}` : ''}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-foreground text-2xl font-black tracking-tight">
                  {savedReference ?? 'Brouillon'}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Émis le {issueDateLabel}</p>
                {documentOptions.mode === 'electronic' ? (
                  <p className="financial-paper-electronic mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold">
                    Format électronique
                  </p>
                ) : null}
              </div>
            </div>

            {documentOptions.showTitle ? (
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="Intitulé du devis"
                className="border-primary/35 text-foreground focus:border-primary mb-6 w-full border border-dashed bg-transparent px-3 py-2 text-lg font-bold outline-none"
              />
            ) : null}

            <div className="mb-8 grid grid-cols-[minmax(0,1fr)_15rem] gap-5">
              <div className="financial-paper-client-panel rounded-2xl border p-5">
                <p className="text-financial-accent text-3xs mb-3 font-black tracking-[0.16em] uppercase">
                  Destinataire
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <CustomerPicker
                    organizationId={organizationId}
                    value={customerId}
                    onChange={(id) => {
                      setCustomerId(id);
                      setSiteId(null);
                    }}
                    label="Client"
                  />
                  {customerId === null ? (
                    <Input
                      label="Nom libre"
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                    />
                  ) : (
                    <SitePicker customerId={customerId} value={siteId} onChange={setSiteId} />
                  )}
                </div>
                {customerId === null ? (
                  <div className="mt-3">
                    <Input
                      label="Site ou référence d’intervention"
                      value={siteName}
                      onChange={(event) => setSiteName(event.target.value)}
                    />
                  </div>
                ) : null}

                {documentOptions.showDeliveryAddress ? (
                  <div className="financial-paper-company text-3xs mt-4 border border-dashed p-3 leading-relaxed">
                    <p className="financial-paper-strong font-bold">Adresse du client</p>
                    {selectedCustomerAddress.length > 0 ? (
                      selectedCustomerAddress.map((line) => <p key={line}>{line}</p>)
                    ) : (
                      <p className="financial-paper-muted mt-1">
                        Sélectionnez une fiche client avec une adresse renseignée.
                      </p>
                    )}
                  </div>
                ) : null}

                {documentOptions.showRegistrationNumber || documentOptions.showVatNumber ? (
                  <div className="financial-paper-text text-3xs mt-3 flex flex-wrap gap-x-5 gap-y-1">
                    {documentOptions.showRegistrationNumber ? (
                      <span>
                        <strong>SIREN / SIRET :</strong>{' '}
                        {selectedCustomer?.registration_number || 'Non renseigné'}
                      </span>
                    ) : null}
                    {documentOptions.showVatNumber ? (
                      <span>
                        <strong>TVA :</strong> {selectedCustomer?.vat_number || 'Non renseignée'}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="financial-paper-date-panel rounded-2xl border p-5">
                <p className="text-financial-accent text-3xs font-black tracking-[0.16em] uppercase">
                  Dates du document
                </p>
                <div className="mt-4 space-y-3 text-xs">
                  <label className="text-muted-foreground block font-semibold">
                    Date d’émission
                    <input
                      type="date"
                      value={issueDateIso}
                      onChange={(event) => setIssueDateIso(event.target.value)}
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      className="financial-paper-date-input financial-paper-strong mt-1 w-full rounded-lg border px-3 py-2 outline-none"
                    />
                  </label>
                  <SelectField
                    label="Période de validité"
                    value={String(validityDays)}
                    onChange={(event) => setValidityDays(Number(event.target.value))}
                    className="financial-paper-date-input financial-paper-strong mt-1 w-full rounded-lg border px-3 py-2 outline-none"
                  >
                    <option value="15">15 jours</option>
                    <option value="30">30 jours</option>
                    <option value="45">45 jours</option>
                    <option value="60">60 jours</option>
                    <option value="90">90 jours</option>
                  </SelectField>
                  <p className="financial-paper-muted text-3xs">
                    Valable jusqu’au <strong>{validUntilDate}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-border overflow-hidden rounded-xl border">
              <div className="financial-paper-table-accent text-3xs grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem_7rem_2.5rem] items-center gap-px px-3 py-2.5 font-black tracking-wide uppercase">
                <span>Désignation</span>
                <span className="text-center">Qté</span>
                <span className="text-center">Unité</span>
                <span className="text-right">Prix HT</span>
                <span className="text-right">Total HT</span>
                <span />
              </div>

              <div className="divide-border divide-y">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-surface grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_7rem_7rem_2.5rem] items-center gap-2 px-3 py-2.5"
                  >
                    <input
                      type="text"
                      value={item.description}
                      aria-label="Désignation de la prestation"
                      onChange={(event) =>
                        handleUpdateItem(item.id, 'description', event.target.value)
                      }
                      className="border-primary/30 bg-primary/5 text-foreground focus:border-primary focus:ring-primary/20 min-w-0 rounded-md border border-dashed px-2.5 py-2 text-xs font-semibold transition outline-none focus:ring-2"
                    />
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      aria-label="Quantité"
                      onChange={(event) =>
                        handleUpdateItem(item.id, 'quantity', Number(event.target.value) || 0)
                      }
                      className="border-border bg-surface-sunken text-foreground focus:border-primary focus:ring-primary/20 rounded-md border border-dashed px-2 py-2 text-center text-xs outline-none focus:ring-2"
                    />
                    <input
                      type="text"
                      value={item.unit}
                      aria-label="Unité"
                      onChange={(event) => handleUpdateItem(item.id, 'unit', event.target.value)}
                      className="border-border bg-surface-sunken text-foreground focus:border-primary focus:ring-primary/20 rounded-md border border-dashed px-2 py-2 text-center text-xs outline-none focus:ring-2"
                    />
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={item.unitPrice}
                        aria-label="Prix unitaire hors taxes, en euros"
                        onChange={(event) =>
                          handleUpdateItem(item.id, 'unitPrice', Number(event.target.value) || 0)
                        }
                        className="border-border bg-surface-sunken text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-md border border-dashed py-2 pr-5 pl-2 text-right text-xs font-semibold outline-none focus:ring-2"
                      />
                      <span className="text-3xs text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2">
                        €
                      </span>
                    </div>
                    <span className="text-foreground text-right text-xs font-black tabular-nums">
                      {(item.quantity * item.unitPrice).toFixed(2)} €
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-subtle-foreground hover:bg-error/10 hover:text-error flex size-8 items-center justify-center rounded-lg transition"
                      aria-label={`Supprimer la ligne « ${item.description} »`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}

                {items.length === 0 ? (
                  <div className="bg-surface-sunken text-muted-foreground flex min-h-28 items-center justify-center px-6 text-center text-xs">
                    Ajoutez une première prestation pour construire le devis.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddItem()}
                className="border-success/30 text-success hover:bg-success/10 gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Ligne simple
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddCustomModalOpen(true)}
                className="gap-1.5"
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Nouvelle prestation
              </Button>
              <div className="ml-auto flex max-w-[28rem] flex-wrap justify-end gap-1.5">
                {templates.slice(0, 4).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      handleAddItem({
                        label: preset.label,
                        unit: preset.unit,
                        price: toEuros(preset.unit_price_cents),
                      })
                    }
                    className="bg-surface-hover text-3xs text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-full px-2.5 py-1.5 font-semibold transition"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-9 grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-10">
              <div className="bg-surface-sunken rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-3xs text-muted-foreground font-black tracking-[0.16em] uppercase">
                      Conditions
                    </p>
                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                      {organization?.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS}
                    </p>
                  </div>
                  <label className="text-muted-foreground shrink-0 text-xs font-semibold">
                    TVA
                    <span className="relative mt-1 flex w-24 items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={vatInput}
                        onChange={(event) => setVatInput(event.target.value)}
                        className="border-border bg-surface text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border py-2 pr-7 pl-3 text-right text-sm font-bold outline-none focus:ring-2"
                        aria-label="Taux de TVA"
                      />
                      <span className="text-muted-foreground absolute right-3 text-xs">%</span>
                    </span>
                  </label>
                </div>
              </div>

              <dl className="space-y-3 text-sm">
                {discountRate > 0 ? (
                  <div className="text-muted-foreground flex items-center justify-between">
                    <dt>Sous-total HT</dt>
                    <dd className="text-foreground font-semibold tabular-nums">
                      {grossHT.toFixed(2)} €
                    </dd>
                  </div>
                ) : null}
                {discountRate > 0 ? (
                  <div className="text-muted-foreground flex items-center justify-between">
                    <dt>Remise {discountRate} %</dt>
                    <dd className="text-success font-semibold tabular-nums">
                      − {discountAmount.toFixed(2)} €
                    </dd>
                  </div>
                ) : null}
                <div className="text-muted-foreground flex items-center justify-between">
                  <dt>Total HT</dt>
                  <dd className="text-foreground font-bold tabular-nums">{totalHT.toFixed(2)} €</dd>
                </div>
                <div className="text-muted-foreground flex items-center justify-between">
                  <dt>TVA {vatRate} %</dt>
                  <dd className="text-foreground font-semibold tabular-nums">
                    {totalVAT.toFixed(2)} €
                  </dd>
                </div>
                <div className="financial-paper-total-panel flex items-center justify-between rounded-xl px-4 py-3 text-base font-black">
                  <dt>Total TTC</dt>
                  <dd className="tabular-nums">{totalTTC.toFixed(2)} €</dd>
                </div>
              </dl>
            </div>

            {documentOptions.showFreeField ? (
              <textarea
                value={freeField}
                onChange={(event) => setFreeField(event.target.value)}
                placeholder="Ajoutez une information libre…"
                className="border-primary/35 text-muted-foreground focus:border-primary mt-8 min-h-20 w-full resize-none border border-dashed bg-transparent p-3 text-xs outline-none"
              />
            ) : null}

            {documentOptions.showBankDetails ||
            documentOptions.showAcceptanceTerms ||
            documentOptions.showSignature ? (
              <div className="border-border text-3xs text-muted-foreground mt-10 grid grid-cols-2 gap-5 border-t pt-7">
                <div className="space-y-4">
                  {documentOptions.showAcceptanceTerms ? (
                    <div>
                      <p className="text-foreground font-bold">Modalités de règlement</p>
                      <p className="mt-1 leading-relaxed">
                        {organization?.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD}
                      </p>
                    </div>
                  ) : null}
                  {documentOptions.showBankDetails ? (
                    <div>
                      <p className="text-foreground font-bold">Coordonnées bancaires</p>
                      <p className="mt-1 leading-relaxed">
                        IBAN : {organization?.iban || 'À compléter dans les paramètres'}
                        <br />
                        BIC : {organization?.bic || 'À compléter dans les paramètres'}
                      </p>
                    </div>
                  ) : null}
                </div>
                {documentOptions.showSignature ? (
                  <div className="border-border-strong rounded-xl border border-dashed p-4">
                    <p className="text-foreground font-bold">Bon pour accord</p>
                    <p className="mt-1">Date, nom et signature du client</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Formulaire Chiffrage (2/3) */}
          <div className="space-y-6 lg:hidden">
            {/* Card Client & Site */}
            <Card variant="section" className={cn('pb-6', currentStep !== 0 && 'hidden lg:block')}>
              <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Building className="text-primary size-4" />
                  Client et intervention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-0 pt-0">
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
            <Card variant="section" className={cn('pb-6', currentStep !== 1 && 'hidden lg:block')}>
              <CardHeader className="flex flex-col items-stretch gap-3 px-0 pt-0 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-muted-foreground flex min-w-0 items-start gap-2 text-xs font-bold tracking-wider uppercase sm:items-center">
                  <Sparkles className="text-warning mt-0.5 size-3.5 shrink-0 sm:mt-0" />
                  Catalogue de prestations
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

              <CardContent className="px-0 pt-0">
                <div className="flex flex-wrap gap-2">
                  {templates.map((preset) => {
                    const priceEuros = toEuros(preset.unit_price_cents);

                    return (
                      <div
                        key={preset.id}
                        className="group border-border bg-surface text-muted-foreground hover:border-primary/50 hover:bg-primary/5 min-h-touch relative flex items-center rounded-lg border pr-1 pl-3 text-xs transition-[background-color,border-color] sm:min-h-8"
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
                          className="focus-visible:ring-ring min-h-touch flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none sm:min-h-8"
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
                          className="text-subtle-foreground hover:bg-error/20 hover:text-error focus-visible:ring-ring size-touch ml-1 flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none sm:size-7"
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
            <Card variant="section" className={cn('pb-6', currentStep !== 1 && 'hidden lg:block')}>
              <CardHeader className="flex flex-row items-center justify-between px-0 pt-0 pb-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Calculator className="text-success size-4" />
                    Prestations et fournitures
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

              <CardContent className="space-y-2 px-0 pt-0">
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
                        className="border-border bg-surface-sunken text-foreground focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded border px-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 sm:min-h-0"
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
                        className="border-border bg-surface-sunken text-foreground focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded border px-2 py-1.5 text-center text-xs focus:outline-none focus-visible:ring-2 sm:min-h-0"
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
                          className="border-border bg-surface-sunken focus:border-primary focus-visible:ring-ring/30 text-success min-h-touch w-full rounded border py-1.5 pr-5 pl-2 text-right text-xs font-semibold focus:outline-none focus-visible:ring-2 sm:min-h-0"
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

          <Card variant="section" className={cn('pb-6 lg:hidden', currentStep !== 2 && 'hidden')}>
            <CardHeader className="px-0 pt-0 pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="text-primary size-4" aria-hidden="true" />
                Conditions du devis
              </CardTitle>
              <CardDescription>
                Ces informations seront reprises sur le devis et dans son PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-0 pt-0">
              <div className="border-border bg-surface grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="quote-vat-rate"
                    className="text-foreground block text-xs font-semibold"
                  >
                    Taux de TVA
                  </label>
                  <div className="relative flex max-w-40 items-center">
                    <input
                      id="quote-vat-rate"
                      type="text"
                      inputMode="decimal"
                      value={vatInput}
                      onChange={(e) => setVatInput(e.target.value)}
                      className="border-border bg-surface-sunken text-foreground focus:border-primary focus-visible:ring-ring/30 min-h-touch w-full rounded-lg border py-2 pr-8 pl-3 text-sm font-semibold focus:outline-none focus-visible:ring-2"
                    />
                    <span className="text-muted-foreground absolute right-3 text-xs font-semibold">
                      %
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: '8.5', label: '8,5 % Antilles' },
                      { value: '20', label: '20 % Métropole' },
                      { value: '0', label: '0 %' },
                    ].map((rate) => (
                      <button
                        key={rate.value}
                        type="button"
                        onClick={() => setVatInput(rate.value)}
                        className={cn(
                          'min-h-touch cursor-pointer rounded-lg border px-2.5 text-xs transition-colors sm:min-h-8',
                          vatInput === rate.value
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {rate.label}
                      </button>
                    ))}
                  </div>
                </div>

                <dl className="text-muted-foreground space-y-3 text-xs">
                  <div>
                    <dt className="text-foreground font-semibold">Conditions d’acceptation</dt>
                    <dd className="mt-1 leading-relaxed">
                      {organization?.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-foreground font-semibold">Modalités de règlement</dt>
                    <dd className="mt-1 leading-relaxed">
                      {organization?.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD}
                    </dd>
                  </div>
                </dl>
              </div>
              <p className="text-muted-foreground text-xs">
                Les textes par défaut se modifient dans les paramètres de l’entreprise.
              </p>
            </CardContent>
          </Card>

          {/* Aperçu & Synthèse Financière (1/3) */}
          <div className={cn('space-y-6 lg:hidden', currentStep !== 3 && 'hidden')}>
            <Card className="border-primary/25 shadow-xs">
              <CardHeader className="border-b pb-4">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <FileText className="text-success size-4" />
                  Synthèse du devis
                </CardTitle>
                <CardDescription>Calcul automatique des totaux HT & TTC.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 pt-5 text-xs">
                <div className="space-y-2.5">
                  <div className="text-muted-foreground flex justify-between">
                    <span>Client :</span>
                    <strong className="text-foreground max-w-[160px] truncate">
                      {selectedCustomer?.name || clientName || '—'}
                    </strong>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>Site :</span>
                    <strong className="text-foreground max-w-[160px] truncate">
                      {selectedSite?.name || siteName || '—'}
                    </strong>
                  </div>
                  <div className="text-muted-foreground flex justify-between">
                    <span>Taux de TVA :</span>
                    <strong className="text-foreground">{vatRate} %</strong>
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
                    <span className="text-primary text-xl font-bold">{totalTTC.toFixed(2)} €</span>
                  </div>
                </div>

                <div className="border-border space-y-2.5 border-t pt-4">
                  <FormError error={submitError} />

                  {/*
                  C'est précisément ce qui manquait : le devis était bien
                  enregistré, mais rien à l'écran ne menait vers lui ensuite —
                  seul le PDF, téléchargé sur-le-champ, en gardait une trace.
                */}
                  {savedQuoteId !== null ? (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-center gap-2 text-xs"
                    >
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
        </section>

        {desktopOptionsOpen ? (
          <aside
            id="quote-desktop-options"
            aria-label="Options et synthèse du devis"
            className="border-border bg-surface sticky top-20 hidden rounded-xl border shadow-xs lg:block"
          >
            <div className="border-border flex items-center gap-2 border-b px-4 py-3">
              <Settings2 className="text-primary size-4" aria-hidden="true" />
              <h2 className="text-foreground flex-1 text-sm font-bold">Options du devis</h2>
              <button
                type="button"
                onClick={() => setDesktopOptionsOpen(false)}
                className="text-muted-foreground hover:bg-surface-hover hover:text-foreground flex size-7 items-center justify-center rounded-md transition"
                aria-label="Fermer les options du devis"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <DocumentOptionsPanel
              kind="quote"
              value={documentOptions}
              onChange={setDocumentOptions}
            />
            {documentOptions.showGlobalDiscount ? (
              <div className="border-border border-t px-4 py-4">
                <Input
                  label="Remise globale (%)"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountRate}
                  onChange={(event) =>
                    setDiscountRate(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                  }
                />
              </div>
            ) : null}
            <div className="space-y-5 border-t p-4 text-xs">
              <section className="border-border space-y-2 border-t pt-4">
                <div className="text-muted-foreground flex justify-between gap-3">
                  <span>Total HT</span>
                  <strong className="text-foreground tabular-nums">{totalHT.toFixed(2)} €</strong>
                </div>
                <div className="text-muted-foreground flex justify-between gap-3">
                  <span>TVA</span>
                  <span className="tabular-nums">{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="border-border flex items-center justify-between gap-3 border-t pt-3">
                  <span className="text-foreground font-bold">Total TTC</span>
                  <strong className="text-primary text-lg font-black tabular-nums">
                    {totalTTC.toFixed(2)} €
                  </strong>
                </div>
              </section>

              <FormError error={submitError} />
              {savedQuoteId !== null ? (
                <Button asChild variant="outline" className="w-full justify-center gap-2 text-xs">
                  <Link to={ROUTES.quoteDetail(savedQuoteId)}>
                    <FileText className="size-4" aria-hidden="true" />
                    Voir le devis
                  </Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPreviewPdfOpen(true)}
                className="w-full justify-center gap-2 text-xs"
              >
                <Download className="size-4" aria-hidden="true" />
                Aperçu PDF
              </Button>
            </div>
          </aside>
        ) : null}
      </div>

      {organizationId && numbering.data ? (
        <DocumentNumberingModal
          key={`${numbering.data.next_value}-${numbering.data.format}`}
          open={numberingOpen}
          onOpenChange={setNumberingOpen}
          organizationId={organizationId}
          documentKind="quote"
          initialNumber={numbering.data.next_value}
          initialFormat={numbering.data.format}
        />
      ) : null}

      <div className="border-border bg-surface-raised/95 sticky bottom-16 z-20 -mx-4 flex items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border lg:hidden">
        {currentStep > 0 ? (
          <Button variant="outline" onClick={() => goToStep(currentStep - 1)} className="gap-1.5">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Retour
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}

        {currentStep < QUOTE_STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => goToStep(currentStep + 1)} className="gap-1.5">
            Continuer
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSendQuote}
            disabled={createQuote.isPending}
            className="gap-1.5"
          >
            <Send className="size-4" aria-hidden="true" />
            {createQuote.isPending
              ? 'Enregistrement…'
              : savedReference !== null
                ? `${savedReference} enregistré`
                : 'Enregistrer le devis'}
          </Button>
        )}
      </div>

      <div className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-40 hidden items-center justify-end gap-3 border-t px-6 py-3 backdrop-blur lg:flex">
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsPreviewPdfOpen(true)}
          className="gap-2"
        >
          <Download className="size-4" aria-hidden="true" />
          Aperçu PDF
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSendQuote}
          disabled={createQuote.isPending}
          className="gap-2"
        >
          <Send className="size-4" aria-hidden="true" />
          {createQuote.isPending
            ? 'Enregistrement…'
            : savedReference !== null
              ? `${savedReference} enregistré`
              : 'Enregistrer le devis'}
        </Button>
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
                className="border-border bg-surface text-foreground focus:border-primary focus-visible:ring-ring/30 w-full rounded-md border px-3 py-2 text-xs focus:outline-none focus-visible:ring-2"
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
            className="financial-paper financial-paper-a4-preview space-y-6 rounded-sm border p-4 font-sans sm:p-10"
          >
            {/* Header Document */}
            <div className="financial-paper-accent-bar -mx-4 -mt-4 h-1.5 sm:-mx-10 sm:-mt-10" />
            <div className="financial-paper-border flex flex-col items-start justify-between gap-5 border-b pb-5 sm:flex-row">
              <div className="space-y-3">
                {organization?.logo_url ? (
                  <div
                    className="financial-paper-company flex items-center justify-center overflow-hidden border border-dashed"
                    style={{
                      width: documentOptions.logoWidth,
                      height: documentOptions.logoHeight,
                    }}
                  >
                    <img
                      src={organization.logo_url}
                      alt="Logo de l’entreprise"
                      className="size-full object-contain p-2"
                    />
                  </div>
                ) : null}
                <div className="financial-paper-company border border-dashed px-3 py-2">
                  <h2 className="financial-paper-brand text-base font-bold tracking-tight">
                    {organization?.name ?? 'REZO360 Pro'}
                  </h2>
                  {organization?.legal_name && organization.legal_name !== organization.name && (
                    <p className="financial-paper-text text-xs font-semibold">
                      {organization.legal_name}
                    </p>
                  )}
                  <p className="financial-paper-muted text-2xs mt-1">
                    {organization?.registration_number
                      ? `SIRET : ${organization.registration_number}`
                      : ''}
                    {organization?.registration_number && organization?.vat_number ? ' • ' : ''}
                    {organization?.vat_number ? `TVA : ${organization.vat_number}` : ''}
                  </p>
                  {(organization?.address_line1 || organization?.city) && (
                    <p className="financial-paper-muted text-3xs">
                      {[organization?.address_line1, organization?.postal_code, organization?.city]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="financial-paper-label inline-block rounded-md px-2.5 py-1 text-xs font-bold">
                  DEVIS N° {quoteNumber}
                </span>
                <p className="financial-paper-muted text-2xs mt-1">Émis le : {issueDateLabel}</p>
                <p className="financial-paper-muted text-2xs">Valide jusqu'au : {validUntilDate}</p>
                {documentOptions.mode === 'electronic' ? (
                  <p className="financial-paper-electronic text-3xs mt-2 inline-flex rounded-full px-2.5 py-1 font-bold">
                    Prêt pour conversion Factur‑X
                  </p>
                ) : null}
              </div>
            </div>

            {documentOptions.showTitle && documentTitle.trim() ? (
              <h3 className="financial-paper-strong text-lg font-black">{documentTitle.trim()}</h3>
            ) : null}

            {/* Informations Client & Site */}
            <div className="financial-paper-panel grid grid-cols-1 gap-4 rounded-lg border p-4 text-xs sm:grid-cols-2">
              <div>
                <p className="financial-paper-muted text-3xs font-bold tracking-wider uppercase">
                  DESTINATAIRE CLIENT
                </p>
                <p className="financial-paper-strong mt-0.5 text-sm font-bold">
                  {selectedCustomer?.name || clientName || 'Client non spécifié'}
                </p>
                {documentOptions.showDeliveryAddress ? (
                  <p className="financial-paper-muted text-3xs mt-1 leading-relaxed">
                    {selectedCustomerAddress.length > 0
                      ? selectedCustomerAddress.join(' · ')
                      : 'Adresse à compléter sur la fiche client'}
                  </p>
                ) : null}
                {documentOptions.showRegistrationNumber && selectedCustomer ? (
                  <p className="financial-paper-muted text-3xs mt-1">
                    SIREN / SIRET : {selectedCustomer.registration_number || 'Non renseigné'}
                  </p>
                ) : null}
                {documentOptions.showVatNumber && selectedCustomer ? (
                  <p className="financial-paper-muted text-3xs mt-1">
                    TVA : {selectedCustomer.vat_number || 'Non renseignée'}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="financial-paper-muted text-3xs font-bold tracking-wider uppercase">
                  SITE D'INTERVENTION
                </p>
                <p className="financial-paper-strong mt-0.5 text-sm font-semibold">
                  {selectedSite?.name || siteName || 'Site principal'}
                </p>
              </div>
            </div>

            {/* Tableau des Lignes du Devis */}
            <Table
              label="Lignes du devis à imprimer"
              minWidth="34rem"
              containerClassName="financial-paper-focus"
            >
              <thead>
                <tr className="financial-paper-table-head border-b font-semibold">
                  <th className="px-3 py-2.5">Désignation de la prestation</th>
                  <th className="px-2 py-2.5 text-center">Qté</th>
                  <th className="px-2 py-2.5 text-center">Unité</th>
                  <th className="px-3 py-2.5 text-right">P.U HT</th>
                  <th className="px-3 py-2.5 text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="financial-paper-table-body divide-y">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="financial-paper-strong px-3 py-2.5 font-medium">
                      {it.description}
                    </td>
                    <td className="px-2 py-2.5 text-center">{it.quantity}</td>
                    <td className="financial-paper-muted px-2 py-2.5 text-center">{it.unit}</td>
                    <td className="px-3 py-2.5 text-right">{it.unitPrice.toFixed(2)} €</td>
                    <td className="financial-paper-strong px-3 py-2.5 text-right font-semibold">
                      {(it.quantity * it.unitPrice).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {documentOptions.showFreeField && freeField.trim() ? (
              <div className="financial-paper-company financial-paper-text border border-dashed p-3 text-xs leading-relaxed whitespace-pre-wrap">
                {freeField.trim()}
              </div>
            ) : null}

            {/* Récapitulatif Financier */}
            <div className="financial-paper-border-strong flex flex-col items-end justify-between gap-4 border-t pt-4 sm:flex-row">
              <div className="financial-paper-muted text-3xs space-y-2">
                {documentOptions.showAcceptanceTerms ? (
                  <>
                    <p>
                      <strong>Conditions de règlement :</strong>{' '}
                      {organization?.quote_payment_terms ?? DEFAULT_QUOTE_PAYMENT_TERMS}
                    </p>
                    <p>
                      <strong>Mode de paiement :</strong>{' '}
                      {organization?.quote_payment_method ?? DEFAULT_QUOTE_PAYMENT_METHOD}
                    </p>
                  </>
                ) : null}
                {documentOptions.showBankDetails ? (
                  <p>
                    <strong>Coordonnées bancaires :</strong> IBAN{' '}
                    {organization?.iban || 'à compléter'}
                    {organization?.bic ? ` · BIC ${organization.bic}` : ''}
                  </p>
                ) : null}
              </div>

              <div className="financial-paper-border w-full space-y-1.5 border-t pt-3 text-right text-xs sm:w-56 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
                <div className="financial-paper-text flex justify-between">
                  <span>Total HT :</span>
                  <span className="financial-paper-strong font-semibold">
                    {totalHT.toFixed(2)} €
                  </span>
                </div>
                <div className="financial-paper-muted flex justify-between">
                  <span>TVA ({vatRate}%) :</span>
                  <span>{totalVAT.toFixed(2)} €</span>
                </div>
                <div className="financial-paper-border-strong financial-paper-total flex justify-between border-t pt-2 text-sm font-bold">
                  <span>TOTAL TTC :</span>
                  <span className="text-base">{totalTTC.toFixed(2)} €</span>
                </div>
              </div>
            </div>

            {/* Cadre Bon pour Accord & Signature Client */}
            {documentOptions.showSignature ? (
              <div className="financial-paper-panel financial-paper-border-strong mt-6 rounded-lg border p-4">
                <div className="financial-paper-text text-2xs flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div>
                    <p className="financial-paper-strong font-bold">
                      Bon pour accord et commande :
                    </p>
                    <p className="financial-paper-muted text-3xs">
                      Mention manuscrite « Bon pour accord », date et signature du client.
                    </p>
                  </div>
                  <div className="financial-paper-signature text-3xs flex h-14 w-full items-center justify-center rounded border border-dashed italic sm:w-40">
                    Emplacement signature
                  </div>
                </div>
              </div>
            ) : null}
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
