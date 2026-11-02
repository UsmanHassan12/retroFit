/** Pure {{placeholder}} rendering for email templates (no I/O, unit-tested). */

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Replace {{name}} placeholders. Values are HTML-escaped; unknown placeholders are left empty. */
export function renderTemplate(template: string, variables: Record<string, string | number>, escape = true) {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, name: string) => {
    const value = variables[name];
    if (value === undefined) return "";
    return escape ? escapeHtml(String(value)) : String(value);
  });
}
