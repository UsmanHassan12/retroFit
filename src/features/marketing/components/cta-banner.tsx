import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BlueprintSection } from "@/components/layout/blueprint";

const AVATARS = [
  "/images/avatars/customer-1.webp",
  "/images/avatars/customer-2.webp",
  "/images/avatars/customer-3.webp",
  "/images/avatars/customer-4.webp",
];

/** "Start your retrofit project today" banner, shared by the landing and services pages. */
export function CtaBanner() {
  return (
    <BlueprintSection innerClassName="px-4 py-16 sm:py-[127px] lg:px-[18px]">
      <div className="relative isolate overflow-hidden rounded-[20px] bg-[radial-gradient(120%_120%_at_30%_70%,#1b3346_0%,#0b1c30_55%)] px-6 py-12 sm:px-[65px] sm:py-[76px]">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_380px]">
          <div className="max-w-[447px]">
            <div className="flex -space-x-1.5">
              {AVATARS.map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt=""
                  width={30}
                  height={30}
                  className="size-[30px] rounded-full object-cover ring-2 ring-navy"
                />
              ))}
            </div>
            <h2 className="font-accent mt-6 text-[27.5px] leading-tight font-semibold text-white">
              Start Your Retrofit Project Today
            </h2>
            <p className="font-accent mt-3 text-[15.7px] font-light text-line">
              Join 500+ homeowners this month who secured funding and compliant designs through the
              Retrofit Portal.
            </p>
            <Link
              href="/services"
              className="font-accent group mt-8 inline-flex h-[66px] w-[259px] items-center justify-between rounded-full bg-white pr-3 pl-8 text-xl font-medium text-navy transition-transform hover:-translate-y-0.5"
            >
              Get Started
              <span className="flex size-11 items-center justify-center rounded-full bg-[#0b3a5c] text-white transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </Link>
          </div>

          <CollageArt />
        </div>
      </div>
    </BlueprintSection>
  );
}

function CollageArt() {
  return (
    <div aria-hidden className="relative mx-auto hidden h-[290px] w-[375px] lg:block">
      <span className="absolute top-[52px] left-0 h-[185px] w-[375px] rounded-[50%] border-[14px] border-brand" />
      <Photo src="/images/marketing/cta-interior.webp" className="top-0 left-[63px] h-[190px] w-[134px] rotate-0" />
      <Photo src="/images/marketing/cta-street.webp" className="top-[20px] left-[182px] h-[128px] w-[89px]" />
      <Photo src="/images/marketing/cta-team.webp" className="top-[174px] left-[80px] h-[89px] w-[110px]" />
      <Photo src="/images/marketing/cta-house.webp" className="top-[101px] left-[195px] h-[190px] w-[134px]" />
      {/* Lower half of the ring passes in front of the photos. */}
      <span className="absolute top-[52px] left-0 h-[185px] w-[375px] rounded-[50%] border-[14px] border-transparent border-b-brand" />
    </div>
  );
}

function Photo({ src, className }: { src: string; className: string }) {
  return (
    <span className={`absolute overflow-hidden rounded-md bg-white p-[5px] shadow-lg ${className}`}>
      <span className="relative block size-full overflow-hidden rounded-[3px]">
        <Image src={src} alt="" fill sizes="140px" className="object-cover" />
      </span>
    </span>
  );
}
