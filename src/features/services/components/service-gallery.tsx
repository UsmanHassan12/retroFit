"use client";

import { ShieldCheck } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function ServiceGallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];
  const thumbs = images.map((src, index) => ({ src, index })).filter((item) => item.index !== active).slice(0, 3);

  return (
    <div className="grid gap-5">
      <div className="relative aspect-[690/450] overflow-hidden rounded-xl bg-line-soft">
        {main ? (
          <Image
            key={main}
            src={main}
            alt={title}
            fill
            priority
            sizes="(min-width: 1024px) 690px, 100vw"
            className="object-cover"
          />
        ) : null}
        <span className="absolute top-5 left-5 inline-flex items-center gap-1.5 rounded-md bg-brand px-2 py-1 text-xs text-white">
          <ShieldCheck className="size-3.5" aria-hidden />
          TrustMark Certified
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-4 sm:gap-6" aria-label="More photos">
        {thumbs.map(({ src, index }) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              className={cn(
                "relative block aspect-[218/138] w-full overflow-hidden rounded-xl ring-brand transition hover:opacity-90 focus-visible:ring-2",
              )}
            >
              <Image src={src} alt="" fill sizes="220px" className="object-cover" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
