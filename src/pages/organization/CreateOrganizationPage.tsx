import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { useCreateOrganization } from '@/features/organizations';
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

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationValues>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: '', slug: '', city: '', industry: '' },
  });

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
            <Input
              label="Nom de l’entreprise"
              placeholder="Fibre Atlantique"
              autoComplete="organization"
              required
              {...(errors.name?.message ? { error: errors.name.message } : {})}
              {...register('name', {
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                  if (!slugEdited) {
                    setValue('slug', slugifyOrganizationName(event.target.value), {
                      shouldValidate: false,
                    });
                  }
                },
              })}
            />

            <Input
              label="Identifiant"
              placeholder="fibre-atlantique"
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
