import { buildEmailHtml, escapeHtml } from "../template";

export type LeaveEmailDetails = {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: string;
  reason: string;
  managerComments?: string | null;
  companyName: string;
  businessEmail: string;
  website: string;
  ctaUrl: string;
};

export type LeaveEmailContent = { subject: string; text: string; html: string };

type LeaveTemplateOptions = {
  subject: string;
  eyebrow: string;
  title: string;
  intro: string;
  status: { label: string; tone: "blue" | "green" | "red" | "amber" | "slate" };
  ctaLabel: "Review Leave Request" | "View Leave Request";
};

function buildLeaveEmail(
  details: LeaveEmailDetails,
  options: LeaveTemplateOptions,
): LeaveEmailContent {
  const rows = [
    ["Employee Name", details.employeeName],
    ["Leave Type", details.leaveType],
    ["Start Date", details.startDate],
    ["End Date", details.endDate],
    ["Duration", details.duration],
    ["Reason", details.reason],
    ...(details.managerComments
      ? [["Manager Comments", details.managerComments]]
      : []),
  ];
  const text = [
    options.title,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    `${options.ctaLabel}: ${details.ctaUrl}`,
  ].join("\n");
  const html = buildEmailHtml({
    companyName: details.companyName,
    businessEmail: details.businessEmail,
    website: details.website,
    eyebrow: options.eyebrow,
    title: options.title,
    preheader: `${details.employeeName} · ${details.leaveType}`,
    introHtml: `<p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(options.intro)}</p>`,
    status: options.status,
    details: rows.map(([label, value]) => ({
      label,
      value,
      emphasis: label === "Duration",
    })),
    cta: { label: options.ctaLabel, url: details.ctaUrl },
  });
  return { subject: options.subject, text, html };
}

export function buildLeaveRequestEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: `Leave request from ${details.employeeName}`,
    eyebrow: "Time Off · Review required",
    title: "A leave request requires your review",
    intro: `${details.employeeName} submitted a leave request for your approval.`,
    status: { label: "Pending", tone: "amber" },
    ctaLabel: "Review Leave Request",
  });
}

export function buildLeaveApprovedEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: "Your leave request was approved",
    eyebrow: "Time Off · Decision",
    title: "Your leave request has been approved",
    intro: "Your manager approved this leave request.",
    status: { label: "Approved", tone: "green" },
    ctaLabel: "View Leave Request",
  });
}

export function buildLeaveRejectedEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: "Your leave request was rejected",
    eyebrow: "Time Off · Decision",
    title: "Your leave request was not approved",
    intro: "Your manager rejected this leave request. Review the comments below for details.",
    status: { label: "Rejected", tone: "red" },
    ctaLabel: "View Leave Request",
  });
}

export function buildLeaveCancellationRequestedEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: `Leave cancellation requested by ${details.employeeName}`,
    eyebrow: "Time Off · Review required",
    title: "A leave cancellation requires your review",
    intro: `${details.employeeName} requested cancellation of approved leave.`,
    status: { label: "Cancellation requested", tone: "amber" },
    ctaLabel: "Review Leave Request",
  });
}

export function buildLeaveCancellationApprovedEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: "Your leave cancellation was approved",
    eyebrow: "Time Off · Decision",
    title: "Your leave cancellation has been approved",
    intro: "Your manager approved the cancellation request.",
    status: { label: "Cancelled", tone: "slate" },
    ctaLabel: "View Leave Request",
  });
}

export function buildLeaveCancellationRejectedEmail(details: LeaveEmailDetails) {
  return buildLeaveEmail(details, {
    subject: "Your leave cancellation was rejected",
    eyebrow: "Time Off · Decision",
    title: "Your leave cancellation was not approved",
    intro: "Your approved leave remains in effect. Review the manager comments below.",
    status: { label: "Cancellation rejected", tone: "red" },
    ctaLabel: "View Leave Request",
  });
}
