import { ShieldCheck } from "lucide-react";

/** Circular "Registered TrustMark" seal with slowly rotating ring text. */
export function TrustBadge() {
  return (
    <div className="relative size-[132px] shrink-0 text-white" role="img" aria-label="Registered TrustMark installer">
      <svg viewBox="0 0 132 132" className=" absolute inset-0 size-full" aria-hidden>
        <defs>
          <path id="trust-ring-outer" d="M66 66m-56 0a56 56 0 1 1 112 0a56 56 0 1 1 -112 0" />
          <path id="trust-ring-inner" d="M66 66m-40 0a40 40 0 1 1 80 0a40 40 0 1 1 -80 0" />
        </defs>
        <text className="fill-current text-[11.3px] font-bold tracking-[0.32em]">
          <textPath href="#trust-ring-outer">REGISTERED TRUSTMARK • REGISTERED TRUSTMARK •</textPath>
        </text>
        <text className="fill-current text-[7.9px] tracking-[0.42em] opacity-80">
          <textPath href="#trust-ring-inner">REGISTERED TRUSTMARK • REGISTERED TRUSTMARK •</textPath>
        </text>
      </svg>
      <span className="absolute inset-0 m-auto flex size-11 items-center justify-center rounded-full bg-white text-navy">
        <ShieldCheck className="size-5" aria-hidden />
      </span>
    </div>
  );
}
