import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/** Split-screen auth layout: photography left, form right (stacks on mobile). */
export function AuthShell({
  image,
  imageAlt,
  title,
  subtitle,
  children,
}: {
  image: string;
  imageAlt: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,760px)_1fr]">
      <div className="relative hidden lg:block">
        <Image src={image} alt={imageAlt} fill priority sizes="(min-width: 1024px) 760px, 0px" className="object-cover" />
      </div>

      <main className="flex items-center justify-center px-6 py-12 sm:px-12 lg:justify-start lg:px-[120px]">
        <div className="w-full max-w-[440px]">
          <Link href="/" aria-label="Retrofit Portal home" className="inline-block">
            <Logo className="w-[238px]" />
          </Link>
          <h1 className="mt-16 text-2xl font-medium text-navy sm:mt-24">{title}</h1>
          <p className="mt-1 text-base text-muted">{subtitle}</p>
          <div className="mt-12">{children}</div>
        </div>
      </main>
    </div>
  );
}
