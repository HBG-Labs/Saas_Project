import { Check } from 'lucide-react';

import { cn } from '@/lib/cn';

export interface DocumentWizardStep {
  label: string;
  description: string;
}

interface DocumentWizardStepperProps {
  steps: readonly DocumentWizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  label?: string;
}

/**
 * Navigation commune aux assistants devis et facture.
 *
 * Les étapes restent librement accessibles : revenir vérifier un client ou
 * une condition ne doit jamais effacer la saisie effectuée ailleurs.
 */
export function DocumentWizardStepper({
  steps,
  currentStep,
  onStepChange,
  label = 'Étapes du document',
}: DocumentWizardStepperProps) {
  const activeStep = steps[currentStep];

  return (
    <nav
      aria-label={label}
      className="border-border bg-surface-raised rounded-xl border px-2.5 py-3 sm:px-4 sm:py-4"
    >
      <ol className="relative grid grid-cols-4 gap-1">
        <span
          aria-hidden="true"
          className="bg-border absolute top-4 right-[12.5%] left-[12.5%] h-px"
        />
        {steps.map((step, index) => {
          const isCurrent = index === currentStep;
          const isComplete = index < currentStep;

          return (
            <li key={step.label} className="relative z-10 min-w-0">
              <button
                type="button"
                onClick={() => onStepChange(index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Étape ${index + 1} sur ${steps.length} : ${step.label}`}
                className="focus-visible:ring-ring group min-h-touch flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg px-0.5 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'border-border bg-surface-raised text-muted-foreground flex size-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                    isComplete && 'border-success bg-success text-success-foreground',
                    isCurrent && 'border-primary bg-primary text-primary-foreground shadow-xs',
                    !isCurrent && !isComplete && 'group-hover:border-primary/50',
                  )}
                >
                  {isComplete ? <Check className="size-4" aria-hidden="true" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'text-3xs xs:text-2xs max-w-full leading-tight font-medium sm:text-xs',
                    isCurrent ? 'text-primary font-bold' : 'text-muted-foreground',
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {activeStep ? (
        <p className="text-muted-foreground mt-2 text-center text-xs">
          <span className="text-foreground font-semibold">
            Étape {currentStep + 1} sur {steps.length}
          </span>
          {' — '}
          {activeStep.description}
        </p>
      ) : null}
    </nav>
  );
}
