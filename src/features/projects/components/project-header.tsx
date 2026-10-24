import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import type { Project } from "../types";

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-3 text-sm">
          <li>
            <Link href="/dashboard/projects" className="text-muted hover:text-navy">
              Projects
            </Link>
          </li>
          <li aria-hidden>
            <ChevronRight className="size-4 text-navy" />
          </li>
          <li aria-current="page" className="font-medium text-navy">
            {project.id}
          </li>
        </ol>
      </nav>

      <h1 className="font-display mt-6 text-[34px] leading-tight font-bold text-navy sm:text-[40px]">{project.id}</h1>
      <p className="mt-2 text-lg text-muted sm:text-xl">{project.title}</p>

      <section
        aria-label="Project summary"
        className="mt-8 grid gap-6 rounded-2xl bg-white p-4 shadow-card sm:p-6 md:grid-cols-[258px_1fr]"
      >
        <div className="relative aspect-[258/194] overflow-hidden rounded-xl">
          <Image src={project.image} alt="" fill sizes="(min-width: 768px) 258px, 100vw" className="object-cover" priority />
        </div>
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-medium text-navy">{project.address.line1}</h2>
              <p className="mt-3 text-sm text-muted">
                {project.address.city}, {project.address.postcode}, UK
              </p>
            </div>
            <Badge tone="success" className="px-3 py-2 text-xs">
              {project.scheme}
            </Badge>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-dotted border-line pt-4">
            <Avatar name={project.coordinator.name} src={project.coordinator.avatar} size={48} />
            <div>
              <p className="font-semibold text-navy">{project.coordinator.name}</p>
              <p className="text-sm text-muted">{project.coordinator.role}</p>
              {project.coordinator.email ? (
                <a href={`mailto:${project.coordinator.email}`} className="text-xs text-navy hover:text-brand">
                  {project.coordinator.email}
                </a>
              ) : null}
            </div>
          </div>
          <Progress value={project.progress} label="Progress" showValue className="mt-auto pt-4" />
        </div>
      </section>
    </>
  );
}
