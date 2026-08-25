import type {
  GuideRole,
  GuideSection,
  PermissionCell,
  PermissionRow,
  RoleCapability,
  UserGuidePayload,
} from "@/lib/user-guide/types";
import {
  ADMIN_LEVEL_ROLES,
  ALL_GUIDE_ROLES,
  LEADERSHIP_ROLES,
  TOP_LEVEL_ROLES,
  rolesVisibleTo,
} from "@/lib/user-guide/permissions";

const cell = (access: PermissionCell["access"], note: string): PermissionCell => ({
  access,
  note,
});

export const PERMISSION_MATRIX: PermissionRow[] = [
  {
    module: "Dashboard",
    feature: "Operational dashboard",
    permissions: {
      Employee: cell("limited", "Personal and assigned-work information"),
      Manager: cell("limited", "Own team and direct-report scope"),
      Admin: cell("full", "Authorised operational overview"),
      "Finance Admin": cell("full", "Operational and financial overview"),
      "Super Admin": cell("full", "Operational and financial overview"),
    },
  },
  {
    module: "Time",
    feature: "Timers and time entries",
    permissions: {
      Employee: cell("limited", "Own timer and assigned projects"),
      Manager: cell("limited", "Own timer plus direct-report visibility"),
      Admin: cell("full", "Company time visibility and authorised editing"),
      "Finance Admin": cell("full", "Company time visibility and authorised editing"),
      "Super Admin": cell("full", "Company time visibility and authorised editing"),
    },
  },
  {
    module: "Workforce",
    feature: "Employee records",
    permissions: {
      Employee: cell("limited", "Own profile and permitted self-service"),
      Manager: cell("limited", "Direct-report utilisation; protected profile details hidden"),
      Admin: cell("limited", "Manage employees except protected higher roles and finance data"),
      "Finance Admin": cell("full", "All employee and protected finance details"),
      "Super Admin": cell("limited", "Broad employee management; finance-only details remain protected"),
    },
  },
  {
    module: "Time Off",
    feature: "Leave requests and administration",
    permissions: {
      Employee: cell("limited", "Own requests, calendar, balances, and policy"),
      Manager: cell("limited", "Own leave plus direct-report approvals"),
      Admin: cell("limited", "Own leave plus reporting-employee approvals"),
      "Finance Admin": cell("full", "Leave administration, approvals, policies, and reports"),
      "Super Admin": cell("full", "Leave administration, approvals, policies, and reports"),
    },
  },
  {
    module: "Payroll",
    feature: "Payroll workspace",
    permissions: {
      Employee: cell("limited", "Own published payroll and policies"),
      Manager: cell("limited", "Own published payroll and policies"),
      Admin: cell("limited", "Own published payroll and policies"),
      "Finance Admin": cell("full", "Payroll administration, processing, reports, and settings"),
      "Super Admin": cell("limited", "Own published payroll and policies in the current implementation"),
    },
  },
  {
    module: "Invoices",
    feature: "Billing and collections",
    permissions: {
      Employee: cell("none", "Not available"),
      Manager: cell("none", "Not available"),
      Admin: cell("none", "Not available"),
      "Finance Admin": cell("full", "Invoices, recurring schedules, collections, and payments"),
      "Super Admin": cell("full", "Invoices, recurring schedules, collections, and payments"),
    },
  },
  {
    module: "Accounts",
    feature: "Clients, projects, and wallets",
    permissions: {
      Employee: cell("limited", "Assigned project cards only; project details and wallets are restricted"),
      Manager: cell("limited", "Clients and project details; wallets are view-only"),
      Admin: cell("full", "Manage clients, projects, assignments, and wallet hours"),
      "Finance Admin": cell("full", "Manage clients, projects, assignments, and wallet hours"),
      "Super Admin": cell("full", "Manage clients, projects, assignments, and wallet hours"),
    },
  },
  {
    module: "Accounts",
    feature: "Commercial Work Orders",
    permissions: {
      Employee: cell("none", "Not available"),
      Manager: cell("none", "Not available"),
      Admin: cell("none", "Not available"),
      "Finance Admin": cell("full", "Create, revise, download, progress, and onboard Work Orders"),
      "Super Admin": cell("full", "Create, revise, download, progress, and onboard Work Orders"),
    },
  },
  {
    module: "Settings",
    feature: "Company settings",
    permissions: {
      Employee: cell("none", "Not available"),
      Manager: cell("none", "Not available"),
      Admin: cell("limited", "Company, branding, and regional settings"),
      "Finance Admin": cell("full", "All available company and billing settings"),
      "Super Admin": cell("full", "All available company and billing settings"),
    },
  },
];

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "overview",
    title: "Overview",
    icon: "overview",
    description: "Understand Kairo's workspace and the information available to your role.",
    keywords: ["home", "modules", "access", "navigation", "role"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Kairo at a glance",
        description: "Kairo brings time, people, leave, payroll, billing, and delivery operations into one role-aware workspace.",
        bullets: [
          "The sidebar shows only the primary modules available to your role.",
          "Tabs and actions can be further limited inside a module.",
          "Your role badge appears in the profile card at the bottom of the sidebar.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "start",
    description: "Sign in, move around Kairo, and learn the essentials.",
    keywords: ["login", "profile", "keyboard shortcuts", "sidebar", "logout"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Your first steps",
        description: "Use your Despacho credentials and begin from the workspace suited to your role.",
        bullets: [
          "Use the sidebar to open modules available to you.",
          "Open your profile card for My Profile, this User Guide, keyboard shortcuts, and Sign out.",
          "Review My Profile and submit a correction request when an editable personal detail is wrong.",
          "Kairo continues to enforce server, API, and database permissions even when a direct URL is entered.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "dashboard",
    description: "Read the operational snapshot tailored to your access scope.",
    keywords: ["today", "coming up", "utilisation", "wallet health", "invoice overview"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Your operating snapshot",
        description: "Dashboard cards summarise authorised clients, projects, hours, utilisation, workforce moments, capacity, and wallet health.",
        bullets: [
          "Employees and managers see information constrained by assignment and reporting scope where applicable.",
          "Financial invoice intelligence appears only when the signed-in role has invoice access.",
          "Today at Despacho and Coming Up highlight leave, celebrations, and milestones.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
    ],
  },
  {
    id: "time",
    title: "Time",
    icon: "time",
    description: "Track work against assigned clients and projects and review authorised time entries.",
    keywords: ["timer", "start", "pause", "resume", "stop", "entry", "billable"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Timer essentials",
        description: "Each timer records a client, project, description, start time, and business-local entry date.",
        bullets: [
          "Select a client before selecting one of its projects.",
          "Only one active timer is allowed per employee.",
          "Pause and resume without creating a second active timer; stop to save the completed time entry.",
          "The entry date is determined independently when each timer starts, including immediately after midnight.",
          "Employees use assigned projects; managers see direct-report live timers; administrators receive their authorised wider view.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Time administration",
        description: "Editing controls are intentionally narrower than time visibility.",
        bullets: [
          "Admin, Super Admin, and Finance Admin can use the authorised time-entry editing controls.",
          "Managers can monitor direct reports but do not receive company-wide time-entry editing rights.",
        ],
        roles: ADMIN_LEVEL_ROLES,
      },
    ],
    workflows: [
      {
        title: "How do I start tracking time?",
        roles: ALL_GUIDE_ROLES,
        keywords: ["timer", "start"],
        steps: [
          "Open Time from the sidebar.",
          "Choose an assigned client, then choose an available project.",
          "Enter a clear work description.",
          "Select Start Timer. Use Pause, Resume, or Stop as needed.",
        ],
      },
    ],
  },
  {
    id: "workforce",
    title: "Workforce",
    icon: "workforce",
    description: "Use employee self-service, reporting hierarchy, reviews, assets, exits, and policies.",
    keywords: ["employee", "profile", "organization", "review", "asset", "exit", "policy"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Workforce sections",
        description: "The module includes Overview, Organization Chart, Reviews, Assets, Exit Process, and Policies for all roles.",
        bullets: [
          "Profile Approvals appears for Admin, Super Admin, and Finance Admin.",
          "Managers can open direct-report utilisation analytics while protected employee details remain hidden.",
          "My Assets and Request Item are available to every employee role.",
          "Reviews expose My Review to every role; broader review actions follow reporting and administrative scope.",
          "The Exit Process provides employee self-service and protected administrative workflows.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Employee administration",
        description: "Administrative actions depend on both the actor and target employee role.",
        bullets: [
          "Admin can manage employees except protected Super Admin and Finance Admin targets.",
          "Super Admin has broad employee administration but cannot grant or remove Finance Admin access.",
          "Finance Admin is the only role with protected employee finance-detail access and Finance Admin access control.",
        ],
        roles: ADMIN_LEVEL_ROLES,
      },
    ],
    workflows: [
      {
        title: "How do I find an employee?",
        roles: LEADERSHIP_ROLES,
        keywords: ["search employee", "team"],
        steps: [
          "Open Workforce and stay on Overview.",
          "Use the employee, status, department, period, or name filters.",
          "Open an accessible employee card to review utilisation analytics.",
        ],
      },
      {
        title: "How do I review an employee?",
        roles: LEADERSHIP_ROLES,
        keywords: ["performance", "annual review"],
        steps: [
          "Open Workforce → Reviews.",
          "Choose an employee within your authorised scope and the review year.",
          "Review billable utilisation, recognition, penalties, comments, and status before completing an available action.",
        ],
      },
    ],
  },
  {
    id: "time-off",
    title: "Time Off",
    icon: "time-off",
    description: "Request leave, view balances and calendars, and complete authorised approvals.",
    keywords: ["leave", "holiday", "approval", "balance", "calendar", "lop"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Employee self-service",
        description: "Overview, My Requests, Calendar, and Policy are available to every role.",
        bullets: [
          "Request Leave applies business-day, holiday, balance, gender, tenure, and policy validation.",
          "My Requests shows your current-year requests and their approval status.",
          "The Calendar combines personal leave, authorised team leave, holidays, pending requests, and approvals.",
          "Cancellation requests follow the same controlled approval path.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Approvals",
        description: "Managers and administrative roles receive an Approvals tab for reporting employees in their permitted hierarchy.",
        bullets: [
          "Select a request to inspect policy checks and employee details before approving or rejecting.",
          "Use reporting-employee filters and Direct-Report Balances to narrow the data.",
        ],
        roles: LEADERSHIP_ROLES,
      },
      {
        title: "Administration",
        description: "Only Finance Admin and Super Admin receive the Time Off Administration tab.",
        bullets: [
          "Manage leave types, policies, holiday calendars, balances, exceptions, year-end processing, reports, and audit history.",
        ],
        roles: TOP_LEVEL_ROLES,
      },
    ],
    workflows: [
      {
        title: "How do I request leave?",
        roles: ALL_GUIDE_ROLES,
        keywords: ["request leave"],
        steps: [
          "Open Time Off → Overview and select Request Leave.",
          "Choose an eligible leave type, dates, duration, and enter the reason.",
          "Review the live policy calculation and correct any validation issue.",
          "Submit the request for approval by the appropriate reporting authority.",
        ],
      },
      {
        title: "How do I approve a leave request?",
        roles: LEADERSHIP_ROLES,
        keywords: ["approve leave"],
        steps: [
          "Open Time Off → Approvals.",
          "Select a request in Requires My Action.",
          "Review the dates, balance, team context, and policy checks.",
          "Add comments where needed, then approve or reject.",
        ],
      },
    ],
  },
  {
    id: "payroll",
    title: "Payroll",
    icon: "payroll",
    description: "Access published salary information and, when authorised, administer payroll.",
    keywords: ["salary", "payslip", "ytd", "structure", "processing", "bank transfer"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "My Payroll",
        description: "All roles can access their own My Payroll, Payroll History, and Policies tabs.",
        bullets: [
          "View financial-year earnings, deductions, net pay, and the latest published salary slip.",
          "Search published salary slips by financial year and download available payslip or YTD PDFs.",
          "Downloads can use the configured employee PDF protection rules.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Payroll Administration",
        description: "The current implementation grants the Administration tab to Finance Admin only.",
        bullets: [
          "Use Payroll Dashboard, Salary Structures, Recurring Adjustments, Payroll Processing, Reports, and Settings.",
          "Payroll calculations, statutory values, exports, publishing, and bank transfer files remain controlled server actions.",
        ],
        roles: ["Finance Admin"],
      },
    ],
  },
  {
    id: "invoices",
    title: "Invoices",
    icon: "invoices",
    description: "Manage billing, recurring invoices, payments, reminders, and collections.",
    keywords: ["invoice", "payment", "receipt", "recurring", "reminder", "stripe"],
    roles: TOP_LEVEL_ROLES,
    blocks: [
      {
        title: "Billing and collections",
        description: "Invoices is available only to Finance Admin and Super Admin.",
        bullets: [
          "Overview summarises open, paid, paid-period, and overdue amounts.",
          "All Invoices provides searchable invoice records and detail pages.",
          "Recurring Invoices manages schedules and future occurrences.",
          "Authorised actions include sending, reminders, PDF download, payment recording/reversal, voiding, duplication, and supported online payments.",
        ],
        roles: TOP_LEVEL_ROLES,
      },
    ],
    workflows: [
      {
        title: "How do I create an invoice?",
        roles: TOP_LEVEL_ROLES,
        keywords: ["new invoice"],
        steps: [
          "Open Invoices and select New Invoice.",
          "Choose the client, contact, dates, currency, and line items.",
          "Save the invoice, verify the detail page, and use the available send action when ready.",
        ],
      },
      {
        title: "How do I create a recurring invoice?",
        roles: TOP_LEVEL_ROLES,
        keywords: ["recurring invoice"],
        steps: [
          "Open Invoices → Recurring Invoices.",
          "Create a schedule directly or from an eligible invoice.",
          "Set the recurrence, dates, client, currency, and items, then save the schedule.",
        ],
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    icon: "accounts",
    description: "Work with clients, assigned projects, service wallets, and authorised Work Orders.",
    keywords: ["client", "project", "wallet", "work order", "contract", "onboarding"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Clients and Projects",
        description: "Accounts adapts its tabs and actions to your role.",
        bullets: [
          "Employee accounts open assigned Projects and do not receive the Clients tab.",
          "Managers can access client and project information in scope and view project wallets without adjusting them.",
          "Admin, Finance Admin, and Super Admin can create and manage clients, projects, team assignments, and wallet-hour adjustments.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Commercial Work Orders",
        description: "Work Orders is restricted at UI, route, API, operation, PDF, and database layers to Finance Admin and Super Admin.",
        bullets: [
          "Create a draft from customer and engagement details, reserve a controlled Work Order number, and generate the document.",
          "Search generated Work Orders, download PDFs, create permitted revisions, and progress lifecycle statuses.",
          "Signed Work Orders can continue into controlled client and project onboarding.",
        ],
        roles: TOP_LEVEL_ROLES,
      },
    ],
    workflows: [
      {
        title: "How do I create a client?",
        roles: ADMIN_LEVEL_ROLES,
        keywords: ["new client"],
        steps: [
          "Open Accounts → Clients.",
          "Select New Client and complete the client details.",
          "Save, then maintain contacts, notes, and associated projects from the accessible client workspace.",
        ],
      },
      {
        title: "How do I create a project?",
        roles: ADMIN_LEVEL_ROLES,
        keywords: ["new project"],
        steps: [
          "Open Accounts → Projects and select New Project.",
          "Choose the client, enter project/service details, billable status, and purchased hours.",
          "Save the project and assign the appropriate team members.",
        ],
      },
      {
        title: "How do I generate a Work Order?",
        roles: TOP_LEVEL_ROLES,
        keywords: ["generate work order", "work order pdf"],
        steps: [
          "Open Accounts → Work Orders and begin a new Work Order.",
          "Complete customer, engagement, pricing, schedule, and approved terms information.",
          "Generate the Work Order, then open the generated record to review or download its PDF.",
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    icon: "settings",
    description: "Configure the company workspace within your administrative scope.",
    keywords: ["company", "branding", "payments", "reminders", "regional", "timezone"],
    roles: ADMIN_LEVEL_ROLES,
    blocks: [
      {
        title: "Company settings",
        description: "Settings is available to Admin, Finance Admin, and Super Admin.",
        bullets: [
          "Admin receives Company, Branding, and Regional sections.",
          "Finance Admin and Super Admin additionally receive Invoices, Payments, Reminders, and Recurring sections.",
          "Some sensitive values remain protected by action-level API checks even when a settings page is visible.",
        ],
        roles: ADMIN_LEVEL_ROLES,
      },
    ],
  },
  {
    id: "roles-permissions",
    title: "Roles & Permissions",
    icon: "roles",
    description: "See how Kairo scopes modules and actions for your role.",
    keywords: ["role", "permission", "access", "employee", "manager", "admin"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Defence in depth",
        description: "The guide describes access; it does not grant access.",
        bullets: [
          "Sidebar visibility is only the first layer of access control.",
          "Pages, APIs, server actions, queries, and Supabase RLS continue to enforce the real rules.",
          "Limited access can mean own records, assigned projects, direct reports, view-only information, or protected-field exclusions.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    icon: "faq",
    description: "Quick answers to common Kairo questions.",
    keywords: ["help", "problem", "missing", "access", "download", "sync"],
    roles: ALL_GUIDE_ROLES,
    blocks: [
      {
        title: "Why can’t I see a module or action?",
        description: "Kairo uses your authenticated role, reporting hierarchy, project assignments, record status, and protected-field rules.",
        bullets: [
          "Confirm you are signed into the correct account and check the role shown in your profile card.",
          "A visible record does not always mean you can edit it.",
          "Ask an authorised administrator when your assigned role or reporting relationship appears wrong.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
      {
        title: "Why is a download unavailable?",
        description: "Downloads follow the same role, publication, record-status, and password-protection rules as their source module.",
        bullets: [
          "Wait for processing to finish before trying again.",
          "Confirm the relevant payslip, review, invoice, report, asset list, or Work Order is eligible for download.",
        ],
        roles: ALL_GUIDE_ROLES,
      },
    ],
  },
];

const ROLE_SUMMARIES: Record<GuideRole, string> = {
  Employee: "Use personal self-service, assigned work, time, leave, payroll, workforce tools, and policies.",
  Manager: "Use personal self-service plus direct-report time, leave, utilisation, and review workflows.",
  Admin: "Administer operational workforce, client, project, settings, and authorised time functions without protected finance access.",
  "Finance Admin": "Use Kairo's highest finance-sensitive access, including payroll administration, billing, Work Orders, and protected employee finance data.",
  "Super Admin": "Administer most company operations, billing, Work Orders, leave, and workforce controls, subject to Finance Admin-only protections.",
};

function capabilityFor(role: GuideRole): RoleCapability {
  const modules = new Map<string, string[]>();
  for (const row of PERMISSION_MATRIX) {
    const permission = row.permissions[role];
    if (permission.access === "none") continue;
    const values = modules.get(row.module) || [];
    values.push(`${permission.access === "full" ? "Full" : "Scoped"}: ${permission.note}`);
    modules.set(row.module, values);
  }
  return {
    role,
    summary: ROLE_SUMMARIES[role],
    modules: [...modules.entries()].map(([module, capabilities]) => ({ module, capabilities })),
  };
}

function filterSection(section: GuideSection, role: GuideRole): GuideSection | null {
  if (!section.roles.includes(role)) return null;
  const blocks = section.blocks.filter((block) => block.roles.includes(role));
  const workflows = section.workflows?.filter((workflow) => workflow.roles.includes(role));
  return { ...section, blocks, workflows };
}

export function buildUserGuidePayload(input: {
  name: string;
  role: GuideRole;
}): UserGuidePayload {
  const allowedRoles = rolesVisibleTo(input.role);
  return {
    profile: input,
    allowedRoles,
    roleCapabilities: allowedRoles.map(capabilityFor),
    sections: GUIDE_SECTIONS.map((section) => filterSection(section, input.role)).filter(
      (section): section is GuideSection => Boolean(section),
    ),
    permissionMatrix: PERMISSION_MATRIX,
  };
}

export function searchGuideSections(sections: GuideSection[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return sections;
  return sections.filter((section) => {
    const text = [
      section.id,
      section.title,
      section.description,
      ...section.keywords,
      ...section.blocks.flatMap((block) => [
        block.title,
        block.description,
        ...block.bullets,
      ]),
      ...(section.workflows || []).flatMap((workflow) => [
        workflow.title,
        ...(workflow.keywords || []),
        ...workflow.steps,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return text.includes(needle);
  });
}
