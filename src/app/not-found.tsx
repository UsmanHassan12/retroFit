import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="w-14" />
      <p className="mt-8 text-sm font-semibold tracking-[0.1em] text-brand uppercase">404</p>
      <h1 className="font-display mt-2 text-4xl font-bold text-navy">Page not found</h1>
      <p className="mt-3 max-w-md text-muted">The page you’re looking for has moved or no longer exists.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/" size="lg">
          Back to home
        </ButtonLink>
        <ButtonLink href="/services" variant="outline" size="lg">
          Browse services
        </ButtonLink>
      </div>
    </main>
  );
}
