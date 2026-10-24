import { Ban, LogIn, Pencil, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { STAFF } from "@/features/admin/data";

export const metadata: Metadata = { title: "User Directory" };

export default function UsersPage() {
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
      <div className="mt-8">
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
            {STAFF.map((user) => (
              <TR key={user.id}>
                <TD>
                  <p>{user.name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </TD>
                <TD>{user.role}</TD>
                <TD>{user.projects}</TD>
                <TD>{user.lastLogin}</TD>
                <TD className={user.online ? "text-brand" : "text-faint"}>{user.online ? "Active" : "Offline"}</TD>
                <TD>
                  <div className="flex gap-2">
                    <IconAction label={`Impersonate ${user.name}`}>
                      <LogIn aria-hidden />
                    </IconAction>
                    <IconAction label={`Edit ${user.name}`}>
                      <Pencil aria-hidden />
                    </IconAction>
                    <IconAction label={`Suspend ${user.name}`}>
                      <Ban aria-hidden />
                    </IconAction>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function IconAction({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-navy transition-colors hover:bg-canvas hover:text-brand [&_svg]:size-[18px]"
    >
      {children}
    </button>
  );
}
