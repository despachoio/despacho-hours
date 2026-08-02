import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRawMimeMessage } from "../src/lib/email/mime";
import {
  buildLeaveApprovedEmail,
  buildLeaveCancellationApprovedEmail,
  buildLeaveCancellationRejectedEmail,
  buildLeaveCancellationRequestedEmail,
  buildLeaveRejectedEmail,
  buildLeaveRequestEmail,
} from "../src/lib/email/templates/leave";

const details = {
  employeeName: "Ms. Example Employee",
  leaveType: "Planned Leave",
  startDate: "03 Aug 2026",
  endDate: "04 Aug 2026",
  duration: "2 days",
  reason: "Family event",
  managerComments: "Handover confirmed",
  companyName: "Despacho Inc.",
  businessEmail: "sales@despacho.io",
  website: "https://www.despacho.io",
  ctaUrl: "https://kairo.despacho.io/time-off",
};

describe("shared email engine", () => {
  it("uses the requested display name without changing the sender address", () => {
    const invoice = buildRawMimeMessage({
      senderName: "Despacho Sales",
      senderEmail: "sales@despacho.io",
      to: ["client@example.com"],
      subject: "Invoice",
      text: "Invoice",
      html: "<p>Invoice</p>",
    });
    const leave = buildRawMimeMessage({
      senderName: "Kairo",
      senderEmail: "sales@despacho.io",
      to: ["manager@example.com"],
      subject: "Leave",
      text: "Leave",
      html: "<p>Leave</p>",
    });

    expect(invoice).toContain(
      `From: =?UTF-8?B?${Buffer.from("Despacho Sales").toString("base64")}?= <sales@despacho.io>`,
    );
    expect(leave).toContain(
      `From: =?UTF-8?B?${Buffer.from("Kairo").toString("base64")}?= <sales@despacho.io>`,
    );
  });

  it("supports inline assets and optional file attachments", () => {
    const raw = buildRawMimeMessage({
      senderName: "Despacho Sales",
      senderEmail: "sales@despacho.io",
      to: ["client@example.com"],
      subject: "Invoice",
      text: "Invoice",
      html: '<img src="cid:despacho-logo" />',
      attachments: [
        {
          filename: "despacho-logo.png",
          contentType: "image/png",
          content: Buffer.from("logo"),
          disposition: "inline",
          contentId: "despacho-logo",
        },
        {
          filename: "Invoice-1.pdf",
          contentType: "application/pdf",
          content: Buffer.from("pdf"),
        },
      ],
    });

    expect(raw).toContain("Content-ID: <despacho-logo>");
    expect(raw).toContain('Content-Disposition: attachment; filename="Invoice-1.pdf"');
  });

  it("renders all six branded leave event templates with the required details", () => {
    const templates = [
      buildLeaveRequestEmail,
      buildLeaveApprovedEmail,
      buildLeaveRejectedEmail,
      buildLeaveCancellationRequestedEmail,
      buildLeaveCancellationApprovedEmail,
      buildLeaveCancellationRejectedEmail,
    ];

    for (const template of templates) {
      const email = template(details);
      expect(email.html).toContain("cid:despacho-logo");
      expect(email.html).toContain("Ms. Example Employee");
      expect(email.html).toContain("Planned Leave");
      expect(email.html).toContain("03 Aug 2026");
      expect(email.html).toContain("Handover confirmed");
      expect(email.html).toContain("#153e90");
      expect(email.text).toContain("https://kairo.despacho.io/time-off");
    }
  });

  it("keeps Gmail delivery and event mapping centralized", () => {
    const sender = readFileSync("src/lib/email/index.ts", "utf8");
    const notifications = readFileSync("src/lib/time-off/notifications.ts", "utf8");
    expect(sender).toContain("users.messages.send");
    expect(notifications).not.toContain("users.messages.send");
    for (const event of [
      "request_submitted",
      "cancellation_requested",
      "approve",
      "reject",
      "approve_cancellation",
      "reject_cancellation",
    ]) {
      expect(notifications).toContain(`${event}:`);
    }
  });
});
