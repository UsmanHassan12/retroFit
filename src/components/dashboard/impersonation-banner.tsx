import { stopImpersonating } from "@/features/auth/actions";

/** Shown across the client portal while an admin is signed in as this user. */
export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <form
      action={stopImpersonating}
      role="status"
      className="mx-auto mb-6 flex max-w-[1120px] flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3 text-sm text-[#7a5500]"
    >
      <p>
        You’re viewing the portal as <strong>{name}</strong>. Changes you make are saved to their account.
      </p>
      <button type="submit" className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90">
        Return to admin
      </button>
    </form>
  );
}
