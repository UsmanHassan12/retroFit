import type { SocialName } from "@/lib/site";

/** Social glyphs exported from the Figma footer (stroke icons, 12×12). */
export function SocialIcon({ name, className }: { name: SocialName; className?: string }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    "aria-hidden": true,
    className,
  } as const;

  switch (name) {
    case "Instagram":
      return (
        <svg {...common} strokeWidth="1.07">
          <path
            strokeLinejoin="round"
            d="M.86 6C.86 3.58.86 2.36 1.61 1.61 2.36.86 3.57.86 6 .86c2.42 0 3.64 0 4.39.75.75.75.75 1.96.75 4.39 0 2.42 0 3.64-.75 4.39-.75.75-1.96.75-4.39.75-2.42 0-3.64 0-4.39-.75C.86 9.64.86 8.43.86 6Z"
          />
          <path d="M8.44 6a2.44 2.44 0 1 1-4.88 0 2.44 2.44 0 0 1 4.88 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.98 3.02h-.01" />
        </svg>
      );
    case "X":
      return (
        <svg {...common}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M1 11 5.19 6.81m0 0L1 1h2.78l3.03 4.19M5.19 6.81 8.22 11H11L6.81 5.19m0 0L11 1"
          />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg {...common} strokeWidth="0.86">
          <path d="M2.43 5h-.26c-.49 0-.73 0-.88.15-.15.15-.15.39-.15.88v4.37c0 .49 0 .73.15.88.15.15.39.15.88.15h.26c.49 0 .73 0 .88-.15.15-.15.15-.39.15-.88V6.03c0-.49 0-.73-.15-.88C3.16 5 2.91 5 2.43 5Zm1.03-2.7a1.16 1.16 0 1 1-2.32 0 1.16 1.16 0 0 1 2.32 0Z" />
          <path
            strokeLinejoin="round"
            d="M6.45 5h-.42c-.49 0-.73 0-.88.15C5 5.3 5 5.54 5 6.03v4.37c0 .49 0 .73.15.88.15.15.39.15.88.15h.26c.49 0 .73 0 .88-.15.15-.15.15-.39.15-.88V8.6c0-.85.27-1.54 1.07-1.54.4 0 .73.35.73.77v2.31c0 .49 0 .73.15.88.15.15.39.15.88.15h.26c.48 0 .73 0 .88-.15.15-.15.15-.39.15-.88l.001-2.83c0-1.28-1.22-2.31-2.42-2.31-.68 0-1.3.33-1.7.86 0-.32 0-.49-.07-.61a.52.52 0 0 0-.18-.18C6.94 5 6.78 5 6.45 5Z"
          />
        </svg>
      );
    case "Facebook":
      return (
        <svg {...common} viewBox="0 0 10 12" width={10} strokeWidth="0.86">
          <path
            strokeLinejoin="round"
            d="M1.75 5.43c-.5 0-.61.1-.61.57v.86c0 .47.1.57.61.57h1.22v3.43c0 .47.1.57.61.57h1.22c.5 0 .6-.1.6-.57V7.43h1.37c.38 0 .48-.07.58-.42l.26-.86c.18-.59.07-.73-.58-.73H5.4V4c0-.32.27-.57.6-.57h1.73c.5 0 .61-.1.61-.57V1.71c0-.47-.1-.57-.61-.57H6c-1.68 0-3.04 1.28-3.04 2.86v1.43H1.75Z"
          />
        </svg>
      );
  }
}
