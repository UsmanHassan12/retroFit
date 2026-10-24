import { BlueprintSection, SectionHeading } from "@/components/layout/blueprint";
import { CtaBanner } from "@/features/marketing/components/cta-banner";
import { FeaturedServices } from "@/features/marketing/components/featured-services";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { Testimonials } from "@/features/marketing/components/testimonials";
import { TrustedBy } from "@/features/marketing/components/trusted-by";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustedBy />
      <HowItWorks />
      <FeaturedServices />

      <div id="testimonials" className="scroll-mt-28">
        <BlueprintSection innerClassName="py-16 sm:py-[90px]">
          <SectionHeading
            eyebrow="Testimonials"
            title="Trusted By Thousands Of Homeowners And Local Authorities."
            className="max-w-[724px]"
          />
        </BlueprintSection>
        <BlueprintSection corners={false}>
          <Testimonials />
        </BlueprintSection>
      </div>

      <CtaBanner />
    </>
  );
}
