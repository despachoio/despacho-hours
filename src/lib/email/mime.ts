import { randomUUID } from "node:crypto";

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
  disposition?: "attachment" | "inline";
  contentId?: string;
};

export type RawMimeMessageInput = {
  senderName: string;
  senderEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

function safeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function safeFilename(value: string) {
  return safeHeaderValue(value).replace(/["\\]/g, "-");
}

export function encodeMimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(safeHeaderValue(value), "utf8").toString("base64")}?=`;
}

export function wrapBase64(value: Buffer | string) {
  const encoded = Buffer.isBuffer(value)
    ? value.toString("base64")
    : Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

export function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function attachmentLines(attachment: EmailAttachment) {
  const filename = safeFilename(attachment.filename);
  const disposition = attachment.disposition || "attachment";
  return [
    `Content-Type: ${safeHeaderValue(attachment.contentType)}; name="${filename}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: ${disposition}; filename="${filename}"`,
    ...(attachment.contentId
      ? [`Content-ID: <${safeHeaderValue(attachment.contentId)}>`]
      : []),
    "",
    wrapBase64(attachment.content),
    "",
  ];
}

export function buildRawMimeMessage({
  senderName,
  senderEmail,
  to,
  cc = [],
  subject,
  text,
  html,
  attachments = [],
}: RawMimeMessageInput) {
  const mixedBoundary = `mixed_${randomUUID()}`;
  const relatedBoundary = `related_${randomUUID()}`;
  const alternativeBoundary = `alternative_${randomUUID()}`;
  const inlineAttachments = attachments.filter(
    (attachment) => attachment.disposition === "inline",
  );
  const regularAttachments = attachments.filter(
    (attachment) => attachment.disposition !== "inline",
  );
  const lines = [
    `From: ${encodeMimeHeader(senderName)} <${safeHeaderValue(senderEmail)}>`,
    `To: ${to.map(safeHeaderValue).join(", ")}`,
    ...(cc.length ? [`Cc: ${cc.map(safeHeaderValue).join(", ")}`] : []),
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(text),
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(html),
    "",
    `--${alternativeBoundary}--`,
    "",
    ...inlineAttachments.flatMap((attachment) => [
      `--${relatedBoundary}`,
      ...attachmentLines(attachment),
    ]),
    `--${relatedBoundary}--`,
    "",
    ...regularAttachments.flatMap((attachment) => [
      `--${mixedBoundary}`,
      ...attachmentLines(attachment),
    ]),
    `--${mixedBoundary}--`,
    "",
  ];
  return lines.join("\r\n");
}
