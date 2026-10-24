import { notFound } from "next/navigation";

import { UrlTabs } from "@/components/ui/url-tabs";
import { ChatPanel } from "@/features/projects/components/chat-panel";
import { ProjectHeader } from "@/features/projects/components/project-header";
import {
  ProjectDeliverablesPanel,
  ProjectDocumentsPanel,
  ProjectOverviewPanel,
  ProjectTimelinePanel,
} from "@/features/projects/components/project-panels";
import { getClientProfile, getProject } from "@/features/projects/queries";
import { requireSession } from "@/lib/auth/guards";

/**
 * Project detail shell. All five tab panels render here and switch instantly in the browser;
 * each tab keeps its own URL (/documents, /messages, …). Child pages only supply metadata.
 */
export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const [project, session, profile] = await Promise.all([getProject(projectId), requireSession(), getClientProfile()]);
  if (!project) notFound();

  const base = `/dashboard/projects/${project.id}`;
  const unread = project.messages.filter((message) => !message.mine).length;

  return (
    <div className="mx-auto max-w-[1120px]">
      <ProjectHeader project={project} />
      <div className="mt-9">
        <UrlTabs
          label="Project sections"
          variant="boxed"
          tabs={[
            { href: base, label: "Overview", exact: true, content: <ProjectOverviewPanel project={project} /> },
            { href: `${base}/documents`, label: "Task & Docs", content: <ProjectDocumentsPanel project={project} /> },
            {
              href: `${base}/messages`,
              label: "Communication",
              badge: unread || undefined,
              content: (
                <ChatPanel
                  initialMessages={project.messages}
                  me={{ name: session.name, role: "Client", avatar: profile.avatar }}
                />
              ),
            },
            { href: `${base}/timeline`, label: "Timeline", content: <ProjectTimelinePanel project={project} /> },
            { href: `${base}/deliverables`, label: "Deliverables", content: <ProjectDeliverablesPanel project={project} /> },
          ]}
        />
      </div>
      {children}
    </div>
  );
}
