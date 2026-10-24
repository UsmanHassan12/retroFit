/** Admin console seed data — replace with the operations / reporting APIs. */

export const ADMIN_STATS = {
  newToday: 2,
  activeProjects: 4,
  overdueTasks: 4,
  revenueMtd: 15054,
  avgCompletionDays: 4,
  compliance: 100,
};

export const TEAM_WORKLOAD = [
  { name: "Jane", value: 4 },
  { name: "Rob", value: 5.6 },
  { name: "Marie", value: 4.9 },
  { name: "Aron", value: 7.1 },
  { name: "Mila", value: 6.6 },
  { name: "Jon", value: 8.8 },
];

export const PROJECT_STATUS = [
  { label: "On Track", value: 55, color: "var(--color-brand)" },
  { label: "At Risk", value: 30, color: "var(--color-navy)" },
  { label: "Delayed", value: 15, color: "#c4c4c4" },
];

export const PROJECT_TOTAL = 142;

/** Fortnightly revenue (GBP) for the last six months; axis shows month labels. */
export const REVENUE_TREND = {
  months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  points: [3600, 5400, 4600, 7900, 7300, 7800, 3400, 5500, 2100, 9900],
  highlightIndex: 7,
};

export type Priority = "High" | "Medium" | "QA Reject";

export const PRIORITY_QUEUE: {
  id: string;
  property: string;
  issue: string;
  due: string;
  priority: Priority;
  assignee: string | null;
}[] = [
  { id: "PRJ-8821-OP", property: "23 Oak Avenue, Manchester", issue: "EPC report overdue", due: "2026-10-28", priority: "High", assignee: "John Smith" },
  { id: "PRJ-8822-OP", property: "7 Elm Road, Salford", issue: "Missing floor plan", due: "2026-10-29", priority: "Medium", assignee: null },
  { id: "PRJ-8830-OP", property: "51 Park Lane, Stockport", issue: "Design failed QA", due: "2026-10-30", priority: "QA Reject", assignee: "Aisha Khan" },
  { id: "PRJ-8834-OP", property: "12 Birch Close, Bolton", issue: "Survey not scheduled", due: "2026-10-31", priority: "High", assignee: "John Smith" },
  { id: "PRJ-8840-OP", property: "3 Cedar Way, Wigan", issue: "Funding evidence pending", due: "2026-11-02", priority: "High", assignee: "Rob Clarke" },
  { id: "PRJ-8843-OP", property: "88 Ash Street, Oldham", issue: "Installer sign-off missing", due: "2026-11-03", priority: "High", assignee: "Mila Novak" },
];

const team = [
  { name: "Mila Novak", src: "/images/avatars/staff-1.webp" },
  { name: "Rob Clarke", src: "/images/avatars/staff-2.webp" },
  { name: "Jane Doe", src: "/images/avatars/staff-3.webp" },
  { name: "Aron Patel" },
];

export type AdminProjectStatus = "In Progress" | "Delayed" | "Completed" | "Planning";

export const ADMIN_PROJECTS = Array.from({ length: 10 }, (_, index) => {
  const delayed = index % 3 === 1;
  const services = ["HVAC Retrofit", "Insulation Upgrade", "Air Source Heat Pump", "Solar PV", "Whole-House Assessment"];
  const cities = ["Manchester", "Leeds", "Bristol", "London", "Bolton"];
  return {
    id: `RET-2026-${String(9156 + index * 7)}`,
    client: { name: ["John Smith", "Priya Shah", "Tom Whitaker", "Aisha Rahman", "Daniel Okafor"][index % 5]!, email: `client${index + 1}@example.co.uk` },
    address: `${42 + index} Oakwood Drive, ${cities[index % 5]}`,
    service: services[index % services.length]!,
    progress: [65, 40, 82, 55, 30, 90, 65, 48, 72, 60][index]!,
    team: index === 1 ? team.slice(0, 1) : team,
    status: (delayed ? "Delayed" : "In Progress") as AdminProjectStatus,
    due: `2026-${String(11 + (index % 2)).padStart(2, "0")}-${String(8 + index).padStart(2, "0")}`,
    verified: index % 2 === 0,
  };
});

export const TASK_COLUMNS = ["Backlog", "Awaiting Client", "Assessment", "Design", "Coordination", "QA", "Done"] as const;

export const PROJECT_TASKS: { id: string; title: string; column: (typeof TASK_COLUMNS)[number]; tags: string[] }[] = [
  { id: "t1", title: "Collect proof of ownership", column: "Awaiting Client", tags: ["Client", "Docs"] },
  { id: "t2", title: "Book site survey", column: "Assessment", tags: ["Assessor"] },
  { id: "t3", title: "RdSAP energy model", column: "Assessment", tags: ["Assessor"] },
  { id: "t4", title: "Ventilation strategy", column: "Design", tags: ["Designer"] },
  { id: "t5", title: "Order created", column: "Done", tags: ["System", "Done"] },
  { id: "t6", title: "Funding eligibility check", column: "Done", tags: ["Funding", "Done"] },
];

export const ADMIN_SERVICES = [
  { id: "s1", title: "Whole-House Assessment", price: 450, days: 5, updated: "Just now", deliverables: 6, active: true },
  { id: "s2", title: "Retrofit Design Package", price: 690, days: 7, updated: "2 hours ago", deliverables: 6, active: true },
  { id: "s3", title: "Retrofit Coordination", price: 520, days: 10, updated: "Yesterday", deliverables: 6, active: true },
  { id: "s4", title: "ECO4 Funding Application", price: 295, days: 3, updated: "18 May 2026", deliverables: 6, active: false },
  { id: "s5", title: "Thermal & Energy Modelling", price: 380, days: 5, updated: "18 May 2026", deliverables: 6, active: true },
  { id: "s6", title: "House Thermal Inspection", price: 245, days: 3, updated: "18 May 2026", deliverables: 4, active: false },
];

export const STAFF = [
  { id: "u1", name: "John Smith", email: "john.smith@stepsoft.co.uk", role: "Super Admin", projects: "All", lastLogin: "Just now", online: true },
  { id: "u2", name: "John Hopkins", email: "john.hopkins@stepsoft.co.uk", role: "Coordinator", projects: "12", lastLogin: "2 hours ago", online: false },
  { id: "u3", name: "Mila Novak", email: "mila.novak@stepsoft.co.uk", role: "Designer", projects: "2", lastLogin: "Yesterday", online: true },
  { id: "u4", name: "Rob Clarke", email: "rob.clarke@stepsoft.co.uk", role: "Assessor", projects: "3", lastLogin: "18 May 2026", online: false },
  { id: "u5", name: "Aisha Khan", email: "aisha.khan@stepsoft.co.uk", role: "Designer", projects: "3", lastLogin: "18 May 2026", online: true },
  { id: "u6", name: "Aron Patel", email: "aron.patel@stepsoft.co.uk", role: "Designer", projects: "1", lastLogin: "18 May 2026", online: true },
];

export const INTEGRATIONS = [
  { name: "Stripe Payments", status: "Connected", detail: "Last ping: 2 mins ago" },
  { name: "AWS S3 Storage", status: "Operational", detail: "Healthy" },
  { name: "SendGrid API", status: "Operational", detail: "Queue: 0 messages" },
];

export const DEFAULT_EMAIL_TEMPLATE = `<div class="header">
  <h2>Project Update: {{project_name}}</h2>
</div>
<p>Hello {{user_name}},</p>
<p>Your recent project submission has passed the initial compliance checks and is now moving to the secondary review phase.</p>
<a href="{{link}}" class="btn">View Status</a>`;
