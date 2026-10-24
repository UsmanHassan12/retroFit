"use client";

import { useEffect } from "react";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Hook up Sentry / your logger here.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="w-14" />
      <h1 className="font-display mt-8 text-3xl font-bold text-navy">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted">An unexpected error occurred. Please try again.</p>
      {error.digest ? <p className="mt-2 text-xs text-faint">Reference: {error.digest}</p> : null}
      <Button className="mt-8" size="lg" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
