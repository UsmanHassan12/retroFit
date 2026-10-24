import Image from "next/image";

import { BlueprintSection, SectionHeading } from "@/components/layout/blueprint";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    number: "01",
    title: "Choose your service",
    description:
      "Browse our transparent service catalogue. Select assessment, design, coordination or full package.",
    image: "/images/marketing/step-choose-service.webp",
    alt: "Modern home with solar panels at dusk",
  },
  {
    number: "02",
    title: "We do the heavy lifting",
    description:
      "Certified team manages surveys, design, funding, installation and full PAS 2035 compliance.",
    image: "/images/marketing/step-heavy-lifting.webp",
    alt: "Retrofit assessor recording a survey on a tablet",
  },
  {
    number: "03",
    title: "Receive deliverables",
    description: "Final report, compliance certificate, photos and all audit-ready documentation.",
    image: "/images/marketing/step-deliverables.webp",
    alt: "Retrofit report and compliance checklist on a desk",
  },
];

export function HowItWorks() {
  return (
    <div id="how-it-works" className="scroll-mt-28">
      <BlueprintSection innerClassName="py-16 sm:py-20">
        <SectionHeading eyebrow="How It Works" title="From Interest To Completion In Weeks" className="max-w-md" />
      </BlueprintSection>

      <BlueprintSection corners={false} innerClassName="px-0">
        <ol className="divide-blueprint divide-y">
          {STEPS.map((step, index) => {
            const imageFirst = index % 2 === 0;
            return (
              <li key={step.number} className="grid md:grid-cols-[570px_1fr]">
                <div
                  className={cn(
                    "relative min-h-[240px] overflow-hidden md:min-h-[319px]",
                    !imageFirst && "md:order-2",
                  )}
                >
                  <Image
                    src={step.image}
                    alt={step.alt}
                    fill
                    sizes="(min-width: 768px) 570px, 100vw"
                    className="object-cover transition-transform duration-700 hover:scale-[1.03]"
                  />
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgb(11_28_48/0.25))]"
                  />
                </div>
                <div
                  className={cn(
                    "border-blueprint flex flex-col justify-center gap-4 px-6 py-10 md:px-[25px]",
                    imageFirst ? "md:border-l" : "md:border-r",
                    index === 0 && "md:border-t md:border-t-brand/40",
                  )}
                >
                  <span className="text-[64px] leading-none font-bold text-brand-700/30 sm:text-[90px]">
                    {step.number}
                  </span>
                  <h3 className="text-2xl font-bold text-navy sm:text-[30px]">{step.title}</h3>
                  <p className="max-w-[466px] text-base text-muted sm:text-[16.7px]">{step.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </BlueprintSection>
    </div>
  );
}
