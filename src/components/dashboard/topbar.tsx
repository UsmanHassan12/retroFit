import { Bell, Grip, Search } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";

type TopbarProps = {
  user: { name: string; avatar?: string };
  searchAction: string;
  searchPlaceholder?: string;
  hasUnread?: boolean;
  profileHref: string;
};

/** Dashboard top bar: global search, notifications, app switcher and account avatar. */
export function Topbar({
  user,
  searchAction,
  searchPlaceholder = "Search retrofit services...",
  hasUnread = true,
  profileHref,
}: TopbarProps) {
  return (
    <div className="flex flex-1 items-center justify-between gap-4">
      <form role="search" action={searchAction} className="relative mx-auto w-full max-w-[634px]">
        <label htmlFor="dashboard-search" className="sr-only">
          {searchPlaceholder}
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-faint" aria-hidden />
        <input
          id="dashboard-search"
          name="q"
          type="search"
          placeholder={searchPlaceholder}
          className="h-[52px] w-full rounded-[10px] border border-line-soft bg-white pr-4 pl-12 text-sm text-navy shadow-[0_2px_6px_rgb(11_28_48/0.08)] placeholder:text-faint focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:outline-none"
        />
      </form>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button type="button" aria-label={hasUnread ? "Notifications (unread)" : "Notifications"} className="relative rounded-lg p-2 text-navy hover:bg-white">
          <Bell className="size-5" aria-hidden />
          {hasUnread ? <span className="absolute top-1.5 right-2 size-2 rounded-full bg-danger ring-2 ring-canvas" /> : null}
        </button>
        <button type="button" aria-label="Apps" className="hidden rounded-lg p-2 text-navy hover:bg-white sm:block">
          <Grip className="size-5" aria-hidden />
        </button>
        <Link href={profileHref} aria-label="Your profile" className="rounded-full">
          <Avatar name={user.name} src={user.avatar} size={34} ring />
        </Link>
      </div>
    </div>
  );
}
