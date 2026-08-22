import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { calculateExpectedLastWorkingDate, EXIT_NOTICE_POLICY, noticeDays } from "../src/lib/exit-policy";
import { exitMatchesStatus, selectVisibleExitId } from "../src/lib/exit-process/workflow";
import type { ExitCase } from "../src/lib/exit-process/types";

const root=process.cwd();
const migration=readFileSync(path.join(root,"supabase/migrations/202608200004_employee_exit_process.sql"),"utf8");
const route=readFileSync(path.join(root,"src/app/api/workforce/exits/route.ts"),"utf8");
const workforce=readFileSync(path.join(root,"src/app/(app)/team/page.tsx"),"utf8");

describe("Workforce exit process",()=>{
  it("centralizes policy notice rules",()=>{expect(EXIT_NOTICE_POLICY.employee.initialTerm).toBe(30);expect(noticeDays("employee","followingInitialTerm")).toBe(60);expect(noticeDays("company","initialTerm")).toBe(5);});
  it("calculates calendar and working-day expected LWD safely",()=>{expect(calculateExpectedLastWorkingDate("2026-08-20",5,"calendar")).toBe("2026-08-25");expect(calculateExpectedLastWorkingDate("2026-08-20",5,"working")).toBe("2026-08-27");expect(calculateExpectedLastWorkingDate("invalid",5,"calendar")).toBe("");});
  it("keeps exit data normalized and immutable audit history",()=>{for(const table of ["employee_exits","exit_handover_tasks","exit_project_clearances","exit_access_tasks","exit_clearances","exit_interviews","exit_documents","exit_audit_events"])expect(migration).toContain(`public.${table}`);expect(migration).not.toMatch(/on public\.exit_audit_events for (update|delete)/);});
  it("enforces employee, manager and administrative read scopes in RLS",()=>{expect(migration).toContain("employee_id=public.get_my_employee_id()");expect(migration).toContain("public.exit_is_manager_of(employee_id)");expect(migration).toContain("public.get_my_actual_role() in ('finance admin','super admin')");});
  it("uses canonical integrations and completion blockers",()=>{expect(route).toContain('from("project_resources")');expect(route).toContain('from("asset_assignments")');expect(route).toContain('from("leave_requests")');expect(route).toContain('from("payroll_entries")');expect(route).toContain("Outstanding assets must be returned");expect(route).toContain("Required clearances are incomplete");expect(route).toContain("active timer");});
  it("preserves history and employee activity rules",()=>{expect(route).toContain('status:"cancelled"');expect(route).not.toContain('from("employee_exits").delete');expect(route).toContain('status:"inactive",active:false');});
  it("loads Exit Process only when its tab is rendered",()=>{expect(workforce).toContain('dynamic(\n  () => import("@/components/team/ExitProcessWorkspace")');expect(workforce).toContain('tab === "exit" ? <div className="mt-8"><ExitProcessWorkspace/>');});
  it("keeps confidential notes out of non-admin responses",()=>{expect(route).toContain("if(!context.canAdminister)delete copy.internal_notes");});
  it("keeps closed exit cases out of the default active workspace",()=>{expect(exitMatchesStatus("submitted","active")).toBe(true);expect(exitMatchesStatus("completed","active")).toBe(false);expect(exitMatchesStatus("cancelled","active")).toBe(false);});
  it("does not preserve a closed selection after completion or cancellation",()=>{const cases=[{id:"closed",status:"completed"},{id:"active",status:"notice_period"}] as ExitCase[];expect(selectVisibleExitId(cases,"active","closed")).toBe("active");expect(selectVisibleExitId(cases,"completed","closed")).toBe("closed");});
});
