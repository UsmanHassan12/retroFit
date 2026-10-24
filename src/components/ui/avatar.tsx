import Image from "next/image";

import { cn, initials } from "@/lib/utils";

type AvatarProps = {
  name: string;
  src?: string;
  size?: number;
  className?: string;
  ring?: boolean;
};

export function Avatar({ name, src, size = 40, className, ring = false }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-navy",
        ring && "ring-2 ring-brand ring-offset-2 ring-offset-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? (
        <Image src={src} alt={name} fill sizes={`${size * 2}px`} className="object-cover" />
      ) : (
        <span aria-label={name}>{initials(name)}</span>
      )}
    </span>
  );
}

/** Overlapping stack of avatars with an optional "+N" counter. */
export function AvatarStack({
  people,
  max = 2,
  size = 28,
}: {
  people: { name: string; src?: string }[];
  max?: number;
  size?: number;
}) {
  const visible = people.slice(0, max);
  const extra = people.length - visible.length;
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((person) => (
        <Avatar key={person.name} {...person} size={size} className="ring-2 ring-white" />
      ))}
      {extra > 0 ? (
        <span
          className="relative inline-flex items-center justify-center rounded-full bg-navy text-[10px] font-semibold text-white ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      ) : null}
    </div>
  );
}
