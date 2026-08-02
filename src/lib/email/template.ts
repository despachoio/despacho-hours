import type { EmailAttachment } from "./mime";

export const DESPACHO_LOGO_CONTENT_ID = "despacho-logo";

export type EmailDetail = {
  label: string;
  value: string;
  emphasis?: boolean;
};

export type BrandedEmailInput = {
  companyName: string;
  businessEmail: string;
  website: string;
  eyebrow: string;
  title: string;
  introHtml?: string;
  details?: EmailDetail[];
  status?: { label: string; tone: "blue" | "green" | "red" | "amber" | "slate" };
  cta?: { label: string; url: string };
  bodyHtml?: string;
  preheader?: string;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createDespachoLogoAttachment(buffer: Buffer): EmailAttachment {
  return {
    filename: "despacho-logo.png",
    contentType: "image/png",
    content: buffer,
    disposition: "inline",
    contentId: DESPACHO_LOGO_CONTENT_ID,
  };
}

function statusStyle(tone: NonNullable<BrandedEmailInput["status"]>["tone"]) {
  const styles = {
    blue: ["#dbeafe", "#1d4ed8"],
    green: ["#d1fae5", "#047857"],
    red: ["#fee2e2", "#b91c1c"],
    amber: ["#fef3c7", "#b45309"],
    slate: ["#e2e8f0", "#475569"],
  } as const;
  return styles[tone];
}

export function buildEmailHtml({
  companyName,
  businessEmail,
  website,
  eyebrow,
  title,
  introHtml = "",
  details = [],
  status,
  cta,
  bodyHtml = "",
  preheader = "",
}: BrandedEmailInput) {
  const statusColours = status ? statusStyle(status.tone) : null;
  const detailRows = details
    .map(
      (detail) => `<tr>
        <td style="padding:10px 14px;color:#64748b;font-size:12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(detail.label)}</td>
        <td align="right" style="padding:10px 14px;color:${detail.emphasis ? "#153e90" : "#0f172a"};font-size:13px;font-weight:700;border-bottom:1px solid #e2e8f0;">${escapeHtml(detail.value)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html>
  <head><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,.08);">
          <tr><td style="padding:26px 32px;border-bottom:1px solid #e2e8f0;">
            <img src="cid:${DESPACHO_LOGO_CONTENT_ID}" alt="${escapeHtml(companyName)}" width="180" style="display:block;width:180px;max-width:100%;height:auto;" />
          </td></tr>
          <tr><td style="padding:30px 32px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;color:#153e90;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:9px 0 12px;font-size:26px;line-height:1.25;color:#0f172a;">${escapeHtml(title)}</h1>
            ${status && statusColours ? `<span style="display:inline-block;margin:0 0 18px;padding:6px 11px;border-radius:999px;background:${statusColours[0]};color:${statusColours[1]};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">${escapeHtml(status.label)}</span>` : ""}
            ${introHtml}
            ${detailRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">${detailRows}</table>` : ""}
            ${bodyHtml}
            ${cta ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px auto 0;"><tr><td style="border-radius:12px;background:#153e90;"><a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:14px 26px;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">${escapeHtml(cta.label)}</a></td></tr></table>` : ""}
          </td></tr>
          <tr><td style="padding:21px 32px;background:#0f172a;color:#cbd5e1;font-size:12px;line-height:1.65;">
            <strong style="color:#ffffff;">${escapeHtml(companyName)}</strong><br />
            <a href="mailto:${escapeHtml(businessEmail)}" style="color:#93c5fd;text-decoration:none;">${escapeHtml(businessEmail)}</a><br />
            <a href="${escapeHtml(website)}" style="color:#93c5fd;text-decoration:none;">${escapeHtml(website)}</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
