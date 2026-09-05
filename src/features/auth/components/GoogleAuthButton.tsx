import { Button } from '@/components/ui/Button';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.87h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.35Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.62-2.42l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.9A6.01 6.01 0 0 1 6.08 12c0-.66.11-1.3.32-1.9V7.51H3.05A10 10 0 0 0 2 12c0 1.61.38 3.14 1.05 4.49L6.4 13.9Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.95 5.51L6.4 10.1c.79-2.37 3-4.13 5.6-4.13Z"
      />
    </svg>
  );
}

interface GoogleAuthButtonProps {
  label?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function GoogleAuthButton({
  label = 'Continuer avec Google',
  isLoading = false,
  disabled = false,
  onClick,
}: GoogleAuthButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="bg-surface w-full font-semibold shadow-xs"
      leadingIcon={<GoogleMark />}
      isLoading={isLoading}
      loadingLabel="Ouverture de Google"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
