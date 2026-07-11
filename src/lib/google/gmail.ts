import "server-only";

import { google } from "googleapis";

export const GOOGLE_WORKSPACE_SENDER = "sales@despacho.io";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function getGmailClient() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const configuredSender = process.env.GOOGLE_WORKSPACE_SENDER;

  if (
    !serviceAccountEmail ||
    !privateKey ||
    configuredSender !== GOOGLE_WORKSPACE_SENDER
  ) {
    throw new Error("Google service-account configuration is missing.");
  }

  const auth = new google.auth.JWT({
    email: serviceAccountEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: [GMAIL_SEND_SCOPE],
    subject: GOOGLE_WORKSPACE_SENDER,
  });

  return google.gmail({
    version: "v1",
    auth,
  });
}
