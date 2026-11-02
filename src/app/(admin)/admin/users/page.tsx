import { Ban, LogIn, RotateCcw, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { impersonateUser, setUserStatus } from "@/features/admin/actions";
import { getUsers } from "@/features/admin/queries";
import { requireAdmin } from "@/lib/auth/guards";
import { ROLE_LABELS, type Role } from "@/lib/auth/types";
import { formatDate, formatRelative } from "@/lib/format";
import { cn, firstParam } from "@/lib/utils";

export const metadata: Metadata = { title: "User Directory" };

const TABS = [
  { id: "staff", label: "Staff" },
  { id: "clients", label: "Clients" },
  { id: "all", label: "Everyone" },
] as const;

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdmin();
  const params = await searchParams;
  const tab = TABS.find((item) => item.id === firstParam(params.view))?.id ?? "staff";
  const q = firstParam(params.q);
  const { users, invites } = await getUsers({
    ...(tab === "staff" ? { staffOnly: "true" } : tab === "clients" ? { role: "CLIENT" } : {}),
    ...(q ? { q } : {}),
  });

  return (
    <div className="mx-auto max-w-[1120px]">
      <PageHeader
        title="User Directory"
        description="Manage platform access, roles, and impersonate accounts."
        actions={
          <ButtonLink href="/admin/users/invite" size="lg" className="text-sm">
            <UserPlus aria-hidden />
            Invite New Staff
          </ButtonLink>
        }
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter users" className="flex gap-3">
          {TABS.map((item) => (
            <Link
              key={item.id}
              href={item.id === "staff" ? "/admin/users" : `/admin/users?view=${item.id}`}
              aria-current={item.id === tab ? "page" : undefined}
              className={cn(
                "inline-flex h-[38px] items-center rounded-full border px-6 text-sm transition-colors",
                item.id === tab ? "border-brand bg-brand text-white" : "border-line-soft bg-white text-navy hover:border-brand/40",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/admin/users" role="search">
          {tab !== "staff" ? <input type="hidden" name="view" value={tab} /> : null}
          <label htmlFor="user-search" className="sr-only">
            Search users
          </label>
          <input
            id="user-search"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name or email…"
            className="h-[38px] w-64 rounded-full border border-line-soft bg-white px-4 text-sm text-navy placeholder:text-faint focus-visible:border-brand focus-visible:outline-none"
          />
        </form>
      </div>

      <div className="mt-6">
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Role</TH>
              <TH># Projects</TH>
              <TH>Last Login</TH>
              <TH>Status</TH>
              <TH>Action</TH>
            </tr>
          </THead>
          <TBody>
            {users.length === 0 ? (
              <TR>
                <TD colSpan={6} className="py-10 text-center text-muted">
                  No users found.
                </TD>
              </TR>
            ) : null}
            {users.map((user) => {
              const role = user.role.toLowerCase() as Role;
              const self = user.id === session.userId;
              const suspended = user.status === "SUSPENDED";
              return (
                <TR key={user.id}>
                  <TD>
                    <p>{user.name}</p>
                    <p className="text-xs text-muted">{user.email}</p>
                  </TD>
                  <TD>{role === "admin" ? "Super Admin" : ROLE_LABELS[role]}</TD>
                  <TD>{role === "admin" || user.canViewAllProjects ? "All" : user.projectCount}</TD>
                  <TD>{user.lastLoginAt ? formatRelative(user.lastLoginAt) : "Never"}</TD>
                  <TD className={suspended ? "text-danger" : "text-brand"}>{suspended ? "Suspended" : "Active"}</TD>
                  <TD>
                    {self ? (
                      <span className="text-xs text-faint">You</span>
                    ) : (
                      <div className="flex gap-2">
                        {role !== "admin" && !suspended ? (
                          <form action={impersonateUser.bind(null, user.id)}>
                            <IconAction label={`Impersonate ${user.name}`}>
                              <LogIn aria-hidden />
                            </IconAction>
                          </form>
                        ) : null}
                        <form
                          action={async () => {
                            "use server";
                            await setUserStatus(user.id, suspended ? "ACTIVE" : "SUSPENDED");
                          }}
                        >
                          <IconAction label={suspended ? `Reactivate ${user.name}` : `Suspend ${user.name}`}>
                            {suspended ? <RotateCcw aria-hidden /> : <Ban aria-hidden />}
                          </IconAction>
                        </form>
                      </div>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {invites.length && tab !== "clients" ? (
        <section aria-labelledby="pending-invites" className="mt-10">
          <h2 id="pending-invites" className="text-xl font-medium text-navy">
            Pending invitations
          </h2>
          <ul className="mt-4 grid gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm shadow-card">
                <span className="text-navy">{invite.email}</span>
                <span className="text-muted">
                  {ROLE_LABELS[invite.role.toLowerCase() as Role]} · expires {formatDate(invite.expiresAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function IconAction({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-navy transition-colors hover:bg-canvas hover:text-brand [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}
