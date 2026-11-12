/** Partner status pills (list and detail pages). */
export const PARTNER_STATUS_LABELS: Record<string, { text: string; tone: string }> = {
  APPLIED: { text: "New application", tone: "bg-warning-soft text-[#9a6b00]" },
  OFFERED: { text: "Awaiting signature", tone: "bg-[#e3ecf7] text-ocean" },
  ACTIVE: { text: "Active", tone: "bg-brand-100/80 text-brand-700" },
  SUSPENDED: { text: "Suspended", tone: "bg-danger/10 text-danger" },
  CANCELLED: { text: "Cancelled", tone: "bg-canvas text-muted" },
  REJECTED: { text: "Rejected", tone: "bg-canvas text-muted" },
};

