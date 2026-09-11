import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, CircleCheck } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useState } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ROUTES } from '@/config/routes';
import { FormError } from '@/components/feedback/FormError';
import { useIndustries } from '@/features/industries';
import {
  CompanyLookupInput,
  useCreateOrganization,
  type FrenchCompanyCandidate,
} from '@/features/organizations';
import { isAppError } from '@/lib/errors';
import {
  createOrganizationSchema,
  slugifyOrganizationName,
  type CreateOrganizationValues,
} from '@/features/organizations/schemas/organization.schema';
import { useDocumentTitle } from '@/lib/use-document-title';

export default function CreateOrganizationPage() {
  useDocumentTitle('Créer une entreprise');

  const navigate = useNavigate();
  const createOrganization = useCreateOrganization();
  const industries = useIndustries();
  const [submitError, setSubmitError] = useState<unknown>(null);
  /**
   * L'identifiant se remplit automatiquement TANT QUE l'utilisateur n'y a pas
   * touché. Continuer à l'écraser après une modification manuelle effacerait sa
   * saisie à chaque frappe dans le nom — un défaut classique de ce motif.
   */
  const [slugEdited, setSlugEdited] = useState(false);
  /**
   * Nom de l'entreprise retenue dans l'annuaire, pour le confirmer à l'écran.
   *
   * Sans ce retour, la recherche remplit quatre champs d'un coup sans que rien
   * ne dise d'où ils viennent : on ne sait plus si on a saisi le SIRET ou s'il
   * a été trouvé. Remis à `null` dès qu'un des deux champs est retouché à la
   * main — la confirmation ne doit jamais survivre à ce qu'elle confirme.
   */
  const [verifiedCompany, setVerifiedCompany] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: '',
      slug: '',
      city: '',
      industry: '',
      legalName: '',
      registrationNumber: '',
      postalCode: '',
    },
  });

  /**
   * Reprend une fiche de l'annuaire officiel.
   *
   * Le nom commercial prime sur la dénomination légale : c'est celui sous lequel
   * l'entreprise est connue de ses clients, donc celui qui doit s'afficher. La
   * raison sociale est conservée à côté — elle est obligatoire sur les factures.
   *
   * L'identifiant n'est réécrit que si l'utilisateur n'y a pas touché, pour la
   * même raison qu'à la frappe du nom.
   */
  function applyOfficialCompany(company: FrenchCompanyCandidate) {
    const displayName = company.commercialName ?? company.name;
    const fill = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

    setValue('name', displayName, fill);
    setValue('legalName', company.legalName, fill);
    setValue('registrationNumber', company.siret, fill);
    if (company.city !== undefined) setValue('city', company.city, fill);
    if (company.postalCode !== undefined) setValue('postalCode', company.postalCode, fill);
    if (!slugEdited) {
      setValue('slug', slugifyOrganizationName(displayName), { shouldValidate: false });
    }

    setVerifiedCompany(displayName);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createOrganization.mutateAsync({
        name: values.name,
        slug: values.slug,
        ...(values.city !== undefined && values.city !== '' ? { city: values.city } : {}),
        ...(values.industry !== undefined && values.industry !== ''
          ? { industry: values.industry }
          : {}),
        ...(values.legalName !== undefined && values.legalName !== ''
          ? { legalName: values.legalName }
          : {}),
        ...(values.registrationNumber !== undefined && values.registrationNumber !== ''
          ? { registrationNumber: values.registrationNumber }
          : {}),
        ...(values.postalCode !== undefined && values.postalCode !== ''
          ? { postalCode: values.postalCode }
          : {}),
      });
      await navigate(ROUTES.organization);
    } catch (error) {
      // La seule contrainte d'unicité atteignable depuis ce formulaire est le
      // slug. « Cet élément existe déjà », affiché en tête, laisserait chercher
      // lequel ; rattaché au champ, le message se corrige d'un regard.
      //
      // Le contrôle de disponibilité fait à la frappe ne suffit pas : entre la
      // vérification et l'insertion, une autre session peut réserver le même
      // identifiant. La contrainte `unique` reste la seule garantie.
      if (isAppError(error) && error.code === 'conflict') {
        setError('slug', {
          message: 'Cet identifiant est déjà utilisé. Essayez une variante.',
        });
        return;
      }

      setSubmitError(error);
    }
  });

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Créer votre entreprise"
        description="Une entreprise regroupe vos équipes, vos clients et vos missions. Vous en serez le propriétaire."
      />

      <Card>
        <CardContent className="pt-6">
          <FormError error={submitError} />

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {/*
              LA RECHERCHE DANS L'ANNUAIRE, ICI PLUTÔT QU'EN RÉGLAGES SEULEMENT.

              Le même composant sert déjà dans les paramètres de l'entreprise.
              L'y réserver obligeait à ressaisir à la main, à la création, ce que
              l'annuaire sait déjà — puis à y revenir pour compléter le SIRET
              avant la première facture, où il est obligatoire.

              Trois caractères suffisent à chercher par nom ; un SIREN (9
              chiffres) ou un SIRET (14) déclenche la recherche par identifiant.
              La saisie manuelle reste entière : si l'annuaire ne répond pas, ou
              si l'entreprise n'y figure pas encore, les champs se remplissent
              normalement.
            */}
            <Controller
              control={control}
              name="name"
              render={({ field }) => (
                <CompanyLookupInput
                  mode="name"
                  label="Nom de l’entreprise"
                  placeholder="REZO360 Services & Travaux"
                  hint="Tapez les premières lettres : l’annuaire officiel remplit la raison sociale, le SIRET et la ville."
                  required
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setVerifiedCompany(null);
                    if (!slugEdited) {
                      setValue('slug', slugifyOrganizationName(value), { shouldValidate: false });
                    }
                  }}
                  onCompanySelect={applyOfficialCompany}
                  {...(errors.name?.message ? { error: errors.name.message } : {})}
                />
              )}
            />

            <Controller
              control={control}
              name="registrationNumber"
              render={({ field }) => (
                <CompanyLookupInput
                  mode="siret"
                  label="SIRET"
                  placeholder="109 198 440 000 17"
                  hint="Facultatif ici, obligatoire sur vos factures. Saisissez-le pour retrouver l’entreprise."
                  inputMode="numeric"
                  name={field.name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setVerifiedCompany(null);
                  }}
                  onCompanySelect={applyOfficialCompany}
                  {...(errors.registrationNumber?.message
                    ? { error: errors.registrationNumber.message }
                    : {})}
                />
              )}
            />

            {verifiedCompany !== null ? (
              <p className="text-success flex items-center gap-1.5 text-sm" role="status">
                <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">
                  Identité reprise de l’annuaire officiel : {verifiedCompany}
                </span>
              </p>
            ) : null}

            <Input
              label="Identifiant"
              placeholder="rezo360-services"
              hint="Sert dans les adresses et doit rester unique. Modifiable maintenant, figé ensuite."
              required
              {...(errors.slug?.message ? { error: errors.slug.message } : {})}
              {...register('slug', {
                onChange: () => {
                  setSlugEdited(true);
                },
              })}
            />

            <Input
              label="Ville"
              placeholder="Nantes"
              hint="Facultatif — complétez le reste des coordonnées plus tard."
              {...(errors.city?.message ? { error: errors.city.message } : {})}
              {...register('city')}
            />

            {/*
              Le métier est demandé À LA CRÉATION, et pas plus tard.

              Il détermine les types d'intervention, les formulaires de compte
              rendu et les outils proposés. Le demander une fois l'entreprise
              installée obligerait à requalifier des missions déjà saisies —
              c'est le genre de question dont la réponse coûte de plus en plus
              cher à mesure qu'on la reporte.

              Facultatif malgré tout : une entreprise dont le métier ne figure
              pas encore dans la liste doit pouvoir avancer. Elle disposera du
              cœur complet, sans spécialisation.
            */}
            <Select
              label="Métier"
              placeholder={industries.isPending ? 'Chargement…' : 'Choisir un métier…'}
              hint="Détermine les formulaires d’intervention et les outils proposés. Modifiable plus tard."
              disabled={industries.isPending}
              options={(industries.data ?? []).map((item) => ({
                value: item.code,
                label: item.label,
              }))}
              onValueChange={(value) => {
                setValue('industry', value, { shouldValidate: false });
              }}
              {...(errors.industry?.message ? { error: errors.industry.message } : {})}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              // Aucun blocage sur le contenu des champs : `watch()` renvoie une
              // fonction que le compilateur React ne peut pas mémoïser, et
              // désactiverait l'optimisation de toute la page. Le schéma Zod
              // signale les champs manquants à la soumission, ce qui indique
              // AUSSI lequel manque — plus utile qu'un bouton inerte.
              disabled={isSubmitting}
            >
              <Building2 className="size-4" aria-hidden="true" />
              {isSubmitting ? 'Création…' : 'Créer l’entreprise'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
