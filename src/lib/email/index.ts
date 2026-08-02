import "server-only";

import { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "./gmail";
import {
  buildRawMimeMessage,
  encodeBase64Url,
  type EmailAttachment,
} from "./mime";

export const INVOICE_SENDER_NAME = "Despacho Sales";
export const KAIRO_SENDER_NAME = "Kairo";

export type SendEmailInput = {
  senderName: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
};

function recipients(value: string | string[] | undefined) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return Array.from(
    new Map(
      items
        .flatMap((item) => item.split(","))
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => [item.toLowerCase(), item]),
    ).values(),
  );
}

export async function sendEmail({
  senderName,
  to,
  cc,
  subject,
  text,
  html,
  attachments = [],
}: SendEmailInput) {
  const toRecipients = recipients(to);
  const ccRecipients = recipients(cc).filter(
    (email) => !toRecipients.some((recipient) => recipient.toLowerCase() === email.toLowerCase()),
  );
  if (!toRecipients.length) throw new Error("At least one email recipient is required");
  const raw = buildRawMimeMessage({
    senderName,
    senderEmail: GOOGLE_WORKSPACE_SENDER,
    to: toRecipients,
    cc: ccRecipients,
    subject,
    text,
    html,
    attachments,
  });
  const response = await getGmailClient().users.messages.send({
    userId: "me",
    requestBody: { raw: encodeBase64Url(raw) },
  });
  if (!response.data.id) throw new Error("Gmail did not return a message ID");
  return response.data.id;
}

export { getGmailClient, GOOGLE_WORKSPACE_SENDER } from "./gmail";
export {
  buildRawMimeMessage,
  encodeBase64Url,
  encodeMimeHeader,
  wrapBase64,
  type EmailAttachment,
} from "./mime";
export {
  buildEmailHtml,
  createDespachoLogoAttachment,
  escapeHtml,
} from "./template";
