import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildEmailHtml,
  createDespachoLogoAttachment,
  escapeHtml,
  GOOGLE_WORKSPACE_SENDER,
  KAIRO_SENDER_NAME,
  sendEmail,
} from "@/lib/email";
import {
  buildLeaveApprovedEmail,
  buildLeaveCancellationApprovedEmail,
  buildLeaveCancellationRejectedEmail,
  buildLeaveCancellationRequestedEmail,
  buildLeaveRejectedEmail,
  buildLeaveRequestEmail,
  type LeaveEmailContent,
  type LeaveEmailDetails,
} from "@/lib/email/templates/leave";
import { addDateKeyDays, businessDateKey } from "@/lib/metrics/date-ranges";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

type NotificationRow = {
  id: string;
  recipient_user_id: string;
  subject: string;
  body: string;
  status: string;
  attempt_count: number;
  notification_type: string;
  leave_request_id: string | null;
};

type LeaveNotificationRequest = {
  id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  manager_comment: string | null;
  leave_types: { name: string } | null;
  employees: { name: string; title: string | null } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function leaveContent(type: string, details: LeaveEmailDetails): LeaveEmailContent | null {
  const builders: Record<string, (input: LeaveEmailDetails) => LeaveEmailContent> = {
    request_submitted: buildLeaveRequestEmail,
    cancellation_requested: buildLeaveCancellationRequestedEmail,
    approve: buildLeaveApprovedEmail,
    reject: buildLeaveRejectedEmail,
    approve_cancellation: buildLeaveCancellationApprovedEmail,
    reject_cancellation: buildLeaveCancellationRejectedEmail,
  };
  return builders[type]?.(details) || null;
}

async function queueReminders(admin: SupabaseClient) {
  const tomorrow = addDateKeyDays(businessDateKey(), 1);
  const [leaveResult, holidayResult, pendingResult] = await Promise.all([
    admin
      .from("leave_requests")
      .select("id,employee_id,start_date,leave_types(name),employees(reporting_manager_id)")
      .in("status", ["approved", "cancellation_rejected"])
      .eq("start_date", tomorrow),
    admin
      .from("holidays")
      .select("id,name,holiday_date")
      .eq("is_active", true)
      .eq("holiday_date", tomorrow),
    admin
      .from("leave_requests")
      .select("id,employee_id,submitted_at,employees(reporting_manager_id)")
      .eq("status", "pending")
      .lte("submitted_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString()),
  ]);
  const error = leaveResult.error || holidayResult.error || pendingResult.error;
  if (error) throw new Error(`Unable to prepare Time Off reminders: ${error.message}`);

  const employeeIds = new Set<string>();
  for (const leave of leaveResult.data || []) {
    employeeIds.add(leave.employee_id);
    const employee = leave.employees as unknown as { reporting_manager_id: string | null } | null;
    if (employee?.reporting_manager_id) employeeIds.add(employee.reporting_manager_id);
  }
  for (const request of pendingResult.data || []) {
    const employee = request.employees as unknown as { reporting_manager_id: string | null } | null;
    if (employee?.reporting_manager_id) employeeIds.add(employee.reporting_manager_id);
  }
  const profileResult = employeeIds.size
    ? await admin.from("profiles").select("user_id,employee_id").in("employee_id", [...employeeIds])
    : { data: [], error: null };
  if (profileResult.error) throw new Error(profileResult.error.message);
  const userByEmployee = new Map(
    (profileResult.data || []).map((profile) => [profile.employee_id, profile.user_id]),
  );
  const rows: Array<Record<string, unknown>> = [];
  for (const leave of leaveResult.data || []) {
    const recipient = userByEmployee.get(leave.employee_id);
    const type = leave.leave_types as unknown as { name: string } | null;
    if (recipient) rows.push({
      leave_request_id: leave.id,
      recipient_user_id: recipient,
      notification_type: "leave_start_reminder",
      subject: "Your approved leave starts tomorrow",
      body: `${type?.name || "Leave"} starts on ${tomorrow}. Review your handover before signing off.`,
      deduplication_key: `${leave.id}:leave_start_reminder:${tomorrow}:${recipient}`,
    });
    const employee = leave.employees as unknown as { reporting_manager_id: string | null } | null;
    const managerRecipient = employee?.reporting_manager_id
      ? userByEmployee.get(employee.reporting_manager_id)
      : null;
    if (managerRecipient) rows.push({
      leave_request_id: leave.id,
      recipient_user_id: managerRecipient,
      notification_type: "direct_report_leave_reminder",
      subject: "Direct-report leave starts tomorrow",
      body: `An approved direct-report leave starts on ${tomorrow}. Review team coverage in Kairo.`,
      deduplication_key: `${leave.id}:direct_report_leave_reminder:${tomorrow}:${managerRecipient}`,
    });
  }
  for (const request of pendingResult.data || []) {
    const employee = request.employees as unknown as { reporting_manager_id: string | null } | null;
    const recipient = employee?.reporting_manager_id
      ? userByEmployee.get(employee.reporting_manager_id)
      : null;
    if (recipient) rows.push({
      leave_request_id: request.id,
      recipient_user_id: recipient,
      notification_type: "approval_reminder",
      subject: "Leave request is awaiting your review",
      body: "A direct report's leave request has been pending for more than 24 hours.",
      deduplication_key: `${request.id}:approval_reminder:${businessDateKey()}:${recipient}`,
    });
  }
  if (holidayResult.data?.length) {
    const [profiles, activeEmployees] = await Promise.all([
      admin.from("profiles").select("user_id,employee_id").not("employee_id", "is", null),
      admin.from("employees").select("id").eq("status", "active"),
    ]);
    if (profiles.error || activeEmployees.error) throw new Error((profiles.error || activeEmployees.error)?.message);
    const active = new Set((activeEmployees.data || []).map((employee) => employee.id));
    for (const holiday of holidayResult.data) {
      for (const profile of profiles.data || []) if (active.has(profile.employee_id)) rows.push({
        recipient_user_id: profile.user_id,
        notification_type: "holiday_reminder",
        subject: `${holiday.name} is tomorrow`,
        body: `Despacho's holiday calendar marks ${holiday.holiday_date} as ${holiday.name}.`,
        deduplication_key: `${holiday.id}:holiday_reminder:${profile.user_id}`,
      });
    }
  }
  if (rows.length) {
    const result = await admin.from("leave_notifications").upsert(rows, {
      onConflict: "deduplication_key",
      ignoreDuplicates: true,
    });
    if (result.error) throw new Error(result.error.message);
  }
}

export async function dispatchTimeOffNotifications(admin: SupabaseClient) {
  await queueReminders(admin);
  const staleBefore = new Date(Date.now() - 10 * 60_000).toISOString();
  await admin
    .from("leave_notifications")
    .update({ status: "failed", error: "Recovered stale notification claim" })
    .eq("status", "processing")
    .lte("claimed_at", staleBefore);
  const pending = await admin
    .from("leave_notifications")
    .select("id,recipient_user_id,subject,body,status,attempt_count,notification_type,leave_request_id")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", 5)
    .order("created_at")
    .limit(50);
  if (pending.error) throw new Error(pending.error.message);
  const summary = { queued: pending.data?.length || 0, sent: 0, failed: 0 };
  const candidates = (pending.data || []) as NotificationRow[];
  if (!candidates.length) return summary;
  const requestIds = Array.from(
    new Set(candidates.flatMap((candidate) => candidate.leave_request_id ? [candidate.leave_request_id] : [])),
  );
  const requests = requestIds.length
    ? await admin
        .from("leave_requests")
        .select("id,start_date,end_date,working_days,reason,manager_comment,leave_types(name),employees(name,title)")
        .in("id", requestIds)
    : { data: [], error: null };
  if (requests.error) throw new Error(requests.error.message);
  const requestById = new Map(
    ((requests.data || []) as unknown as LeaveNotificationRequest[]).map((request) => [request.id, request]),
  );
  const settings = await loadCompanySettings(admin);
  const { buffer: logo } = await loadCompanyLogo(settings);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  const ctaUrl = `${appUrl}/time-off`;
  for (const candidate of candidates) {
    const claim = await admin
      .from("leave_notifications")
      .update({ status: "processing", claimed_at: new Date().toISOString(), error: null })
      .eq("id", candidate.id)
      .in("status", ["pending", "failed"])
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;
    try {
      const user = await admin.auth.admin.getUserById(candidate.recipient_user_id);
      const email = user.data.user?.email;
      if (!email) throw new Error("Recipient email is unavailable");
      const request = candidate.leave_request_id
        ? requestById.get(candidate.leave_request_id)
        : null;
      const employeeName = request
        ? [request.employees?.title, request.employees?.name].filter(Boolean).join(" ") || "Employee"
        : "Employee";
      const details: LeaveEmailDetails | null = request
        ? {
            employeeName,
            leaveType: request.leave_types?.name || "Leave",
            startDate: formatDate(request.start_date),
            endDate: formatDate(request.end_date),
            duration: `${request.working_days} ${request.working_days === 1 ? "day" : "days"}`,
            reason: request.reason || "Not provided",
            managerComments: request.manager_comment,
            companyName: settings.company_name,
            businessEmail: settings.business_email || GOOGLE_WORKSPACE_SENDER,
            website: settings.website || "https://www.despacho.io",
            ctaUrl,
          }
        : null;
      const templated = details ? leaveContent(candidate.notification_type, details) : null;
      const html = templated?.html || buildEmailHtml({
        companyName: settings.company_name,
        businessEmail: settings.business_email || GOOGLE_WORKSPACE_SENDER,
        website: settings.website || "https://www.despacho.io",
        eyebrow: "Kairo · Time Off",
        title: candidate.subject,
        introHtml: `<p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(candidate.body)}</p>`,
        status: { label: "Notification", tone: "blue" },
        cta: { label: "View Time Off", url: ctaUrl },
      });
      const gmailMessageId = await sendEmail({
        senderName: KAIRO_SENDER_NAME,
        to: email,
        subject: templated?.subject || candidate.subject,
        text: templated?.text || `${candidate.body}\n\nView Time Off: ${ctaUrl}`,
        html,
        attachments: [createDespachoLogoAttachment(logo)],
      });
      await admin.from("leave_notifications").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        gmail_message_id: gmailMessageId,
        attempt_count: candidate.attempt_count + 1,
      }).eq("id", candidate.id);
      summary.sent++;
    } catch (cause) {
      await admin.from("leave_notifications").update({
        status: "failed",
        error: cause instanceof Error ? cause.message : "Unknown email error",
        attempt_count: candidate.attempt_count + 1,
      }).eq("id", candidate.id);
      summary.failed++;
    }
  }
  return summary;
}
