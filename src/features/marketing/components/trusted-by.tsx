import Image from "next/image";

import { BlueprintSection } from "@/components/layout/blueprint";

const PARTNERS = [
  { name: "Optimal", src: "/logos/partner-optimal.svg", width: 128 },
  { name: "Emblem", src: "/logos/partner-emblem.svg", width: 128 },
  { name: "Wayline", src: "/logos/partner-wayline.svg", width: 116 },
  { name: "Nietzsche", src: "/logos/partner-nietzsche.svg", width: 121 },
];

export function TrustedBy() {
  // Rendered twice so the CSS marquee loops seamlessly.
  const loop = [...PARTNERS, ...PARTNERS];

  return (
    <BlueprintSection innerClassName="py-14">
      <h2 className="text-center text-xl font-medium text-ink sm:text-2xl">Official Trustmark Installer</h2>
      <div className="relative mx-auto mt-10 max-w-[826px] overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]">
        <ul className="animate-marquee flex w-max items-center gap-[60px] hover:[animation-play-state:paused]">
          {loop.map((partner, index) => (
            <li key={`${partner.name}-${index}`} aria-hidden={index >= PARTNERS.length}>
              <Image src={partner.src} alt={partner.name} width={partner.width} height={28} className="h-7 w-auto" />
            </li>
          ))}
        </ul>
      </div>
    </BlueprintSection>
  );
}
