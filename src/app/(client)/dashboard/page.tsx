import { CalendarCheck, CircleCheck, ChevronRight, Star, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { StatCard } from "@/components/dashboard/page-header";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getClientOverview } from "@/features/projects/queries";
import { requireSession } from "@/lib/auth/guards";
import { formatPrice } from "@/lib/format";

export default async function ClientDashboardPage() {
  const [session, overview] = await Promise.all([requireSession(), getClientOverview()]);
  const { stats, activeProjects } = overview;
  const firstName = session.name.split(" ")[0] ?? session.name;

  return (
    <div className="mx-auto max-w-[1120px]">
      <div className="relative">
        <WelcomeBanner
          name={firstName}
          highlight={`${stats.active} active projects`}
          suffix="that require attention today."
        />
        <div className="relative -mt-24 grid grid-cols-2 gap-4 sm:-mt-[66px] lg:grid-cols-4 lg:gap-6">
          <StatCard icon={<CalendarCheck />} value={String(stats.active)} label="Active Projects" />
          <StatCard icon={<CircleCheck />} value={String(stats.completed)} label="Completed" />
          <StatCard icon={<Star />} value={formatPrice(stats.fundingSecured)} label="Funding Secured" />
          <StatCard icon={<Zap />} value={`${stats.compliance}%`} label="Compliance" />
        </div>
      </div>

      <section aria-labelledby="active-projects" className="mt-14">
        <div className="flex items-center justify-between">
          <h2 id="active-projects" className="text-2xl font-semibold text-navy">
            Your Active Projects
          </h2>
          <Link href="/dashboard/projects?status=active" className="inline-flex items-center gap-1 text-base text-navy hover:text-brand">
            View All <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>

        <ul className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {activeProjects.map((project) => (
            <li key={project.id}>
              <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-card">
                <div className="relative aspect-[357/192]">
                  <Image src={project.image} alt="" fill sizes="(min-width: 1280px) 357px, (min-width: 768px) 50vw, 100vw" className="object-cover" />
                  <Badge tone="success" dot className="absolute top-4 left-4 bg-brand-200/90 px-3 py-1.5 text-xs text-brand-700">
                    In Progress
                  </Badge>
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-[17px]">
                  <h3 className="text-xl font-medium text-navy">{project.address.line1}</h3>
                  <p className="mt-2 text-base text-muted">{project.service}</p>
                  <Progress value={project.progress} label="Progress" showValue className="mt-6" />
                  <div className="mt-6 flex items-center gap-3">
                    <Avatar name={project.coordinator.name} src={project.coordinator.avatar} size={48} />
                    <div>
                      <p className="font-semibold text-navy">{project.coordinator.name}</p>
                      <p className="text-muted">{project.coordinator.role}</p>
                    </div>
                  </div>
                  <ButtonLink href={`/dashboard/projects/${project.id}`} size="lg" fullWidth className="mt-8 text-base font-semibold">
                    Open Project
                  </ButtonLink>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#e6e6e6] p-5 shadow-card sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-navy">Upgrade to Priority Support</h2>
          <p className="mt-2 text-base text-muted">Get Priority Support for £29/mo — faster responses + 15% off</p>
        </div>
        <ButtonLink href="/dashboard/billing/plans" variant="brand" size="lg" className="shadow-none">
          Upgrade Now
        </ButtonLink>
      </section>
    </div>
  );
}
