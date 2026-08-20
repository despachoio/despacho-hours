/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getProfileApiContext } from "@/lib/server/profile-auth";
import { normalizeRole } from "@/lib/roles";
import { calculateExpectedLastWorkingDate, EXIT_CLEARANCE_TYPES, noticeDays, type NoticeTerm } from "@/lib/exit-policy";
import { notifyExitEvent } from "@/lib/exit-process/notifications";

const ADMIN_ROLES=new Set(["finance admin","super admin"]);
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
const text=(value:unknown)=>String(value||"").trim();
const nullable=(value:unknown)=>text(value)||null;

type ProfileContext=Extract<Awaited<ReturnType<typeof getProfileApiContext>>,{user:unknown}>;
type ExitContext=ProfileContext&{role:string;employeeId:string;canAdminister:boolean};
type ActorResult=ExitContext|{error:string;status:number};
function isActorError(context:ActorResult):context is {error:string;status:number}{return typeof (context as {error?:unknown}).error==="string";}
async function actor(request:Request):Promise<ActorResult>{const context=await getProfileApiContext(request);if("error" in context&&context.error)return {error:context.error,status:context.status};const successful=context as ProfileContext;const role=normalizeRole(successful.profile.role);return {...successful,role,employeeId:String(successful.profile.employee_id),canAdminister:ADMIN_ROLES.has(role)};}
async function exitRecord(context:ExitContext,id:string){const result=await context.admin.from("employee_exits").select("*,employee:employees!employee_exits_employee_id_fkey(id,employee_code,name,role,department,reporting_manager_id,status)").eq("id",id).single();if(result.error)throw new Error(result.error.message);return result.data;}
function managerCan(role:string,actorEmployeeId:string,record:any){return role==="manager"&&record.employee?.reporting_manager_id===actorEmployeeId;}
function canRead(role:string,actorEmployeeId:string,canAdminister:boolean,record:any){return canAdminister||record.employee_id===actorEmployeeId||managerCan(role,actorEmployeeId,record);}
async function audit(context:any,record:any,action:string,previousValue?:unknown,newValue?:unknown,reason?:string){const result=await context.admin.from("exit_audit_events").insert({exit_id:record.id,employee_id:record.employee_id,action,actor_user_id:context.user.id,actor_role:context.role,reason:reason||null,previous_value:previousValue||null,new_value:newValue||null});if(result.error)throw new Error(result.error.message);}

async function seedCase(context:any,record:{id:string;employee_id:string}){
  const clearances=EXIT_CLEARANCE_TYPES.map((clearance_type)=>({exit_id:record.id,clearance_type}));
  const resources=await context.admin.from("project_resources").select("id").eq("employee_id",record.employee_id);
  if(resources.error)throw new Error(resources.error.message);
  const inserts=await Promise.all([
    context.admin.from("exit_clearances").insert(clearances),
    context.admin.from("exit_documents").insert(["resignation_acknowledgement","relieving_letter","experience_letter","full_and_final_statement"].map((document_type)=>({exit_id:record.id,document_type,status:"template_required"}))),
    context.admin.from("exit_interviews").insert({exit_id:record.id}),
    resources.data?.length?context.admin.from("exit_project_clearances").insert(resources.data.map((item:any)=>({exit_id:record.id,project_resource_id:item.id}))):Promise.resolve({error:null}),
  ]);
  const error=inserts.find((item:any)=>item.error)?.error;if(error)throw new Error(error.message);
}

export async function GET(request:Request){
  const context=await actor(request);if(isActorError(context))return fail(context.error,context.status);
  let query=context.admin.from("employee_exits").select("*,employee:employees!employee_exits_employee_id_fkey(id,employee_code,name,role,department,reporting_manager_id,status)").order("created_at",{ascending:false});
  if(!context.canAdminister){const assigned=await context.admin.from("exit_handover_tasks").select("exit_id").eq("assigned_to",context.employeeId);const assignedIds=(assigned.data||[]).map((row:any)=>row.exit_id);if(context.role==="manager"){const direct=await context.admin.from("employees").select("id").eq("reporting_manager_id",context.employeeId);const employeeIds=[context.employeeId,...(direct.data||[]).map((row:any)=>row.id)];query=assignedIds.length?query.or(`employee_id.in.(${employeeIds.join(",")}),id.in.(${assignedIds.join(",")})`):query.in("employee_id",employeeIds);}else query=assignedIds.length?query.or(`employee_id.eq.${context.employeeId},id.in.(${assignedIds.join(",")})`):query.eq("employee_id",context.employeeId);}
  const casesResult=await query;if(casesResult.error)return fail(casesResult.error.message,500);
  const cases=(casesResult.data||[]) as any[];const ids=cases.map((item)=>item.id),employeeIds=Array.from(new Set(cases.map((item)=>item.employee_id)));
  const empty={data:[],error:null};const [clearances,handovers,projects,access,documents,interviews,assets,leave,payroll,auditResult]=await Promise.all([
    ids.length?context.admin.from("exit_clearances").select("*").in("exit_id",ids):empty,
    ids.length?context.admin.from("exit_handover_tasks").select("*").in("exit_id",ids).order("created_at"):empty,
    ids.length?context.admin.from("exit_project_clearances").select("*,project_resource:project_resources!exit_project_clearances_project_resource_id_fkey(project:projects!project_resources_project_id_fkey(id,name,project_code,status,client:clients!projects_client_id_fkey(name)))").in("exit_id",ids):empty,
    ids.length?context.admin.from("exit_access_tasks").select("*").in("exit_id",ids):empty,
    ids.length?context.admin.from("exit_documents").select("*").in("exit_id",ids):empty,
    ids.length?context.admin.from("exit_interviews").select("*").in("exit_id",ids):empty,
    employeeIds.length?context.admin.from("asset_assignments").select("*,asset:assets!asset_assignments_asset_id_fkey(asset_tag,brand,model,status,item:asset_items!assets_item_id_fkey(name))").in("employee_id",employeeIds).eq("status","assigned"):empty,
    employeeIds.length?context.admin.from("leave_requests").select("id,employee_id,start_date,end_date,working_days,status,leave_type:leave_types!leave_requests_leave_type_id_fkey(name)").in("employee_id",employeeIds).in("status",["pending","approved","cancellation_requested"]):empty,
    employeeIds.length?context.admin.from("payroll_entries").select("id,employee_id,payroll_month,status,total_earnings,total_deductions,net_salary").in("employee_id",employeeIds).order("payroll_month",{ascending:false}):empty,
    context.canAdminister&&ids.length?context.admin.from("exit_audit_events").select("*").in("exit_id",ids).order("created_at",{ascending:false}):empty,
  ] as any[]);
  const failure=[clearances,handovers,projects,access,documents,interviews,assets,leave,payroll,auditResult].find((item:any)=>item.error);if(failure?.error)return fail(failure.error.message,500);
  const enriched=cases.map((item)=>{
    const owns=item.employee_id===context.employeeId;
    const manages=context.role==="manager"&&item.employee?.reporting_manager_id===context.employeeId;
    const assignedOnly=!context.canAdminister&&!owns&&!manages;
    const copy={...item};
    if(!context.canAdminister)delete copy.internal_notes;
    if(!context.canAdminister&&!manages)delete copy.manager_comments;
    if(assignedOnly){delete copy.employee_comments;delete copy.employee_visible_comments;delete copy.reason_code;}
    return {
      ...copy,
      clearances:assignedOnly?[]:clearances.data.filter((x:any)=>x.exit_id===item.id).map((x:any)=>context.canAdminister?x:({...x,override_reason:null})),
      handovers:handovers.data.filter((x:any)=>x.exit_id===item.id&&(!assignedOnly||x.assigned_to===context.employeeId)),
      projectClearances:assignedOnly?[]:projects.data.filter((x:any)=>x.exit_id===item.id),
      accessTasks:context.canAdminister||owns?access.data.filter((x:any)=>x.exit_id===item.id):[],
      documents:context.canAdminister||owns?documents.data.filter((x:any)=>x.exit_id===item.id):[],
      interview:context.canAdminister?interviews.data.find((x:any)=>x.exit_id===item.id)||null:owns?sanitizeEmployeeInterview(interviews.data.find((x:any)=>x.exit_id===item.id)):null,
      activeAssets:context.canAdminister||owns?assets.data.filter((x:any)=>x.employee_id===item.employee_id):[],
      pendingLeave:assignedOnly?[]:leave.data.filter((x:any)=>x.employee_id===item.employee_id&&(!item.approved_last_working_date||x.end_date>item.approved_last_working_date)),
      latestPayroll:context.canAdminister||owns?payroll.data.find((x:any)=>x.employee_id===item.employee_id)||null:null,
      audit:context.canAdminister?auditResult.data.filter((x:any)=>x.exit_id===item.id):[],
    };
  });
  const employees=context.canAdminister?await context.admin.from("employees").select("id,employee_code,name,email,role,department,reporting_manager_id,status").eq("status","active").order("employee_code"):{data:[],error:null};
  if(employees.error)return fail(employees.error.message,500);
  const handoverEmployees=await context.admin.from("employees").select("id,employee_code,name").eq("status","active").order("employee_code");
  if(handoverEmployees.error)return fail(handoverEmployees.error.message,500);
  return NextResponse.json({role:context.profile.role,employeeId:context.employeeId,canAdminister:context.canAdminister,canManageDirectReports:context.role==="manager",cases:enriched,employees:employees.data||[],handoverEmployees:handoverEmployees.data||[]});
}

function sanitizeEmployeeInterview(interview:any){if(!interview)return null;const copy={...interview};delete copy.confidential_notes;delete copy.rehire_eligible;return copy;}

export async function POST(request:Request){
  const context=await actor(request);if(isActorError(context))return fail(context.error,context.status);
  try{
    const body=await request.json() as Record<string,unknown>;const action=text(body.action);
    if(action==="submit_resignation"){
      const existing=await context.admin.from("employee_exits").select("id").eq("employee_id",context.employeeId).not("status","in","(completed,cancelled)").maybeSingle();if(existing.data)throw new Error("An active exit process already exists");
      const term=text(body.term) as NoticeTerm;if(!["initialTerm","followingInitialTerm"].includes(term))throw new Error("An authorized administrator must confirm whether the Initial Term applies");
      const basis=text(body.noticeDayBasis);if(!["calendar","working"].includes(basis))throw new Error("Confirm whether notice uses calendar or working days");
      const initiation=text(body.initiationDate)||new Date().toISOString().slice(0,10);const days=noticeDays("employee",term);const expected=calculateExpectedLastWorkingDate(initiation,days,basis as any);const comments=text(body.comments);if(!comments)throw new Error("Resignation reason is required");
      const created=await context.admin.from("employee_exits").insert({employee_id:context.employeeId,exit_source:"employee",exit_type:"resignation",status:"submitted",initiation_date:initiation,resignation_date:initiation,reason_code:nullable(body.reasonCode),employee_comments:comments,requested_last_working_date:nullable(body.requestedLastWorkingDate),expected_last_working_date:expected,notice_days:days,notice_day_basis:basis,initial_term_confirmed:null,created_by:context.user.id,updated_by:context.user.id,submitted_at:new Date().toISOString()}).select("id,employee_id").single();if(created.error)throw new Error(created.error.message);await seedCase(context,created.data);await audit(context,created.data,"resignation_submitted",null,{provisionalNoticeTerm:term,noticeDays:days,expectedLastWorkingDate:expected});await notifyExitEvent(context.admin,{type:"resignation_submitted",exitId:created.data.id}).catch(console.error);return NextResponse.json({ok:true,id:created.data.id});
    }
    if(action==="initiate_company_exit"){
      if(!context.canAdminister)return fail("Only Finance Admin or Super Admin can initiate a company exit",403);const employeeId=text(body.employeeId),initiation=text(body.initiationDate)||new Date().toISOString().slice(0,10),immediate=Boolean(body.immediateTermination),requestedNotice=Number(body.noticeDays??noticeDays("company","followingInitialTerm")),days=immediate?0:Number.isFinite(requestedNotice)?Math.max(0,Math.floor(requestedNotice)):noticeDays("company","followingInitialTerm"),basis=["calendar","working"].includes(text(body.noticeDayBasis))?text(body.noticeDayBasis):"calendar",exitType=text(body.exitType)||"termination",allowedExitTypes=new Set(["termination","performance","policy_violation","client_escalation","absconding","mutual_separation","layoff","end_of_contract","retirement","other"]);const expected=text(body.lastWorkingDate)||calculateExpectedLastWorkingDate(initiation,days,basis as any);if(!employeeId||!text(body.internalNotes))throw new Error("Employee and internal reason are required");if(!allowedExitTypes.has(exitType))throw new Error("Invalid company exit type");
      const created=await context.admin.from("employee_exits").insert({employee_id:employeeId,exit_source:"company",exit_type:exitType,status:immediate?"clearance_in_progress":"notice_period",initiation_date:initiation,reason_code:nullable(body.reasonCode),employee_visible_comments:nullable(body.employeeVisibleComments),internal_notes:text(body.internalNotes),expected_last_working_date:expected,approved_last_working_date:expected,notice_days:days,notice_day_basis:basis,notice_waived:immediate,notice_waiver_reason:immediate?text(body.internalNotes):null,immediate_termination:immediate,created_by:context.user.id,updated_by:context.user.id,submitted_at:new Date().toISOString()}).select("id,employee_id").single();if(created.error)throw new Error(created.error.message);await seedCase(context,created.data);await audit(context,created.data,immediate?"immediate_termination_initiated":"company_exit_initiated",null,{expectedLastWorkingDate:expected},text(body.internalNotes));await notifyExitEvent(context.admin,{type:"company_exit_initiated",exitId:created.data.id}).catch(console.error);return NextResponse.json({ok:true,id:created.data.id});
    }
    const id=text(body.exitId);if(!id)throw new Error("Exit case is required");const record=await exitRecord(context,id);const assignedTaskAction=action==="update_handover"?await context.admin.from("exit_handover_tasks").select("id").eq("id",text(body.taskId)).eq("exit_id",id).eq("assigned_to",context.employeeId).maybeSingle():{data:null};if(!canRead(context.role,context.employeeId,context.canAdminister,record)&&!assignedTaskAction.data)return fail("Forbidden",403);const isManager=managerCan(context.role,context.employeeId,record);
    if(action==="save_manager_comment"){
      if(!context.canAdminister&&!isManager)return fail("Manager or administrator access required",403);const comment=text(body.comment);if(!comment)throw new Error("Manager comment is required");const update=await context.admin.from("employee_exits").update({manager_comments:comment,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",id);if(update.error)throw new Error(update.error.message);await audit(context,record,"manager_comment_updated",{managerComments:record.manager_comments||null},{managerComments:comment});return NextResponse.json({ok:true});
    }
    if(action==="update_lwd"){
      if(!context.canAdminister)return fail("Only Finance Admin or Super Admin can change the Last Working Day",403);const date=text(body.lastWorkingDate),reason=text(body.reason),term=text(body.term) as NoticeTerm;if(!date||!reason)throw new Error("Last Working Day and change reason are required");if(!["initialTerm","followingInitialTerm"].includes(term))throw new Error("Confirm the employee's applicable notice category");const previous=record.approved_last_working_date,days=noticeDays(record.exit_source,term);const updated=await context.admin.from("employee_exits").update({approved_last_working_date:date,notice_days:record.notice_waived?0:days,initial_term_confirmed:term==="initialTerm",status:"notice_period",updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",id);if(updated.error)throw new Error(updated.error.message);await audit(context,record,"last_working_date_changed",{approvedLastWorkingDate:previous,initialTermConfirmed:record.initial_term_confirmed},{approvedLastWorkingDate:date,initialTermConfirmed:term==="initialTerm",noticeDays:record.notice_waived?0:days},reason);return NextResponse.json({ok:true});
    }
    if(action==="save_handover"){
      if(!context.canAdminister&&!isManager&&record.employee_id!==context.employeeId)return fail("Forbidden",403);const title=text(body.title);if(!title)throw new Error("Handover title is required");const values={exit_id:id,title,description:nullable(body.description),assigned_to:nullable(body.assignedTo)||record.employee_id,due_date:nullable(body.dueDate),created_by:context.user.id,updated_at:new Date().toISOString()};const result=await context.admin.from("exit_handover_tasks").insert(values).select("id").single();if(result.error)throw new Error(result.error.message);await audit(context,record,"handover_task_created",null,{id:result.data.id,title});return NextResponse.json({ok:true});
    }
    if(action==="update_handover"){
      const task=await context.admin.from("exit_handover_tasks").select("*").eq("id",text(body.taskId)).eq("exit_id",id).single();if(task.error)throw new Error(task.error.message);if(!context.canAdminister&&!isManager&&task.data.assigned_to!==context.employeeId)return fail("Forbidden",403);const status=text(body.status);if(!["pending","in_progress","completed","waived"].includes(status))throw new Error("Invalid handover status");const update=await context.admin.from("exit_handover_tasks").update({status,completion_notes:nullable(body.notes),completed_at:status==="completed"?new Date().toISOString():null,completed_by:status==="completed"?context.user.id:null,updated_at:new Date().toISOString()}).eq("id",task.data.id);if(update.error)throw new Error(update.error.message);await audit(context,record,"handover_task_updated",{status:task.data.status},{status});return NextResponse.json({ok:true});
    }
    if(action==="update_project_clearance"){
      if(!context.canAdminister&&!isManager)return fail("Manager or administrator access required",403);const status=text(body.status);const result=await context.admin.from("exit_project_clearances").update({status,handover_to:nullable(body.handoverTo),notes:nullable(body.notes),cleared_at:["cleared","waived"].includes(status)?new Date().toISOString():null,cleared_by:["cleared","waived"].includes(status)?context.user.id:null,updated_at:new Date().toISOString()}).eq("id",text(body.projectClearanceId)).eq("exit_id",id);if(result.error)throw new Error(result.error.message);await audit(context,record,"project_clearance_updated",null,{status});return NextResponse.json({ok:true});
    }
    if(action==="return_asset"){
      if(!context.canAdminister)return fail("Only Finance Admin or Super Admin can record an asset return",403);const assignmentId=text(body.assignmentId);const assignment=await context.admin.from("asset_assignments").select("*").eq("id",assignmentId).eq("employee_id",record.employee_id).eq("status","assigned").single();if(assignment.error)throw new Error(assignment.error.message);const condition=text(body.condition)||"good",assetStatus=condition==="damaged"?"damaged":"returned";const [returned,assetUpdated]=await Promise.all([context.admin.from("asset_assignments").update({status:"returned",returned_date:text(body.returnedDate)||new Date().toISOString().slice(0,10),condition_at_return:condition,returned_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",assignmentId),context.admin.from("assets").update({status:assetStatus,condition,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",assignment.data.asset_id)]);if(returned.error||assetUpdated.error)throw new Error((returned.error||assetUpdated.error)!.message);await context.admin.from("asset_audit_log").insert({entity_type:"assignment",entity_id:assignmentId,employee_id:record.employee_id,action:"asset_returned_during_exit",new_value:{exitId:id,assetStatus},actor_user_id:context.user.id,actor_role:context.role});await audit(context,record,"asset_return_recorded",null,{assignmentId,assetStatus});return NextResponse.json({ok:true});
    }
    if(action==="update_clearance"){
      const type=text(body.clearanceType),status=text(body.status),overrideReason=text(body.overrideReason);if(!context.canAdminister&&!(isManager&&["manager","project"].includes(type)))return fail("Forbidden",403);if(type==="asset"&&["cleared","waived"].includes(status)){const outstanding=await context.admin.from("asset_assignments").select("id",{count:"exact",head:true}).eq("employee_id",record.employee_id).eq("status","assigned");if((outstanding.count||0)>0&&!overrideReason)throw new Error("Outstanding assigned assets block clearance. Return them or enter an override reason");}
      const update=await context.admin.from("exit_clearances").update({status,notes:nullable(body.notes),blocker:status==="blocked"?text(body.notes):null,override_reason:overrideReason||null,cleared_at:["cleared","waived"].includes(status)?new Date().toISOString():null,cleared_by:["cleared","waived"].includes(status)?context.user.id:null,updated_at:new Date().toISOString()}).eq("exit_id",id).eq("clearance_type",type);if(update.error)throw new Error(update.error.message);await audit(context,record,"clearance_updated",null,{type,status,overrideReason:overrideReason||null},overrideReason||undefined);return NextResponse.json({ok:true});
    }
    if(action==="save_access_task"){
      if(!context.canAdminister)return fail("Administrator access required",403);const systemName=text(body.systemName);if(!systemName)throw new Error("System name is required");const result=await context.admin.from("exit_access_tasks").insert({exit_id:id,system_name:systemName,owner_employee_id:nullable(body.ownerEmployeeId),due_at:nullable(body.dueAt),notes:nullable(body.notes),created_by:context.user.id}).select("id").single();if(result.error)throw new Error(result.error.message);await audit(context,record,"access_task_created",null,{systemName});return NextResponse.json({ok:true});
    }
    if(action==="save_interview"){
      const isSelf=record.employee_id===context.employeeId;if(!context.canAdminister&&!isSelf)return fail("Forbidden",403);const values:any={updated_at:new Date().toISOString()};if(isSelf)values.employee_feedback=nullable(body.employeeFeedback);if(context.canAdminister){values.scheduled_at=nullable(body.scheduledAt);values.conducted_at=nullable(body.conductedAt);values.rehire_eligible=typeof body.rehireEligible==="boolean"?body.rehireEligible:null;if(body.confidentialNotes!==undefined)values.confidential_notes=nullable(body.confidentialNotes);}const update=await context.admin.from("exit_interviews").update(values).eq("exit_id",id);if(update.error)throw new Error(update.error.message);await audit(context,record,"exit_interview_updated",null,{employeeFeedbackUpdated:Boolean(values.employee_feedback),administrativeUpdate:context.canAdminister});return NextResponse.json({ok:true});
    }
    if(action==="update_access_task"){
      if(!context.canAdminister)return fail("Administrator access required",403);const status=text(body.status);const result=await context.admin.from("exit_access_tasks").update({status,notes:nullable(body.notes),completed_at:["revoked","waived"].includes(status)?new Date().toISOString():null,completed_by:["revoked","waived"].includes(status)?context.user.id:null,updated_at:new Date().toISOString()}).eq("id",text(body.taskId)).eq("exit_id",id);if(result.error)throw new Error(result.error.message);await audit(context,record,"access_task_updated",null,{status});return NextResponse.json({ok:true});
    }
    if(action==="final_settlement"){
      if(!context.canAdminister)return fail("Administrator access required",403);const status=text(body.status);if(!["pending","ready","completed","waived"].includes(status))throw new Error("Invalid final settlement status");await context.admin.from("employee_exits").update({final_settlement_status:status,status:status==="ready"?"ready_for_final_settlement":record.status,updated_by:context.user.id,updated_at:new Date().toISOString()}).eq("id",id);await audit(context,record,"final_settlement_updated",{status:record.final_settlement_status},{status});return NextResponse.json({ok:true});
    }
    if(action==="cancel"){
      if(!context.canAdminister)return fail("Administrator access required",403);const reason=text(body.reason);if(!reason)throw new Error("Cancellation reason is required");await context.admin.from("employee_exits").update({status:"cancelled",cancelled_at:new Date().toISOString(),cancelled_by:context.user.id,cancellation_reason:reason,updated_by:context.user.id}).eq("id",id);await audit(context,record,"exit_cancelled",{status:record.status},{status:"cancelled"},reason);await notifyExitEvent(context.admin,{type:"exit_cancelled",exitId:id}).catch(console.error);return NextResponse.json({ok:true});
    }
    if(action==="reopen"){
      if(!context.canAdminister)return fail("Administrator access required",403);const reason=text(body.reason);if(record.status!=="completed"||!reason)throw new Error("Only a completed exit can be reopened with a reason");const payroll=await context.admin.from("payroll_entries").select("id").eq("employee_id",record.employee_id).gte("payroll_month",record.approved_last_working_date||record.initiation_date).in("status",["locked","published"]).limit(1).maybeSingle();if(payroll.data)throw new Error("This exit cannot be reopened because post-exit payroll is locked or published");await context.admin.from("employee_exits").update({status:"clearance_in_progress",reopened_at:new Date().toISOString(),reopened_by:context.user.id,reopen_reason:reason,completed_at:null,completed_by:null,updated_by:context.user.id}).eq("id",id);await context.admin.from("employees").update({status:"active"}).eq("id",record.employee_id);await audit(context,record,"exit_reopened",{status:"completed"},{status:"clearance_in_progress"},reason);return NextResponse.json({ok:true});
    }
    if(action==="complete"){
      if(!context.canAdminister)return fail("Administrator access required",403);const lwd=record.approved_last_working_date||record.expected_last_working_date;if(!lwd)throw new Error("Approve the Last Working Day before completion");if(lwd>new Date().toISOString().slice(0,10))throw new Error("Exit cannot be completed before the approved Last Working Day");const clearances=await context.admin.from("exit_clearances").select("clearance_type,status,required").eq("exit_id",id);const blocked=(clearances.data||[]).filter((item:any)=>item.required&&!["cleared","waived"].includes(item.status));if(blocked.length)throw new Error(`Required clearances are incomplete: ${blocked.map((item:any)=>item.clearance_type).join(", ")}`);if(!["ready","completed","waived"].includes(record.final_settlement_status))throw new Error("Final settlement must be ready before completion");const assigned=await context.admin.from("asset_assignments").select("id",{count:"exact",head:true}).eq("employee_id",record.employee_id).eq("status","assigned");if((assigned.count||0)>0)throw new Error("Outstanding assets must be returned before completion");const activeTimer=await context.admin.from("active_timers").select("id").eq("employee_id",record.employee_id).in("status",["running","paused"]).limit(1).maybeSingle();if(activeTimer.data)throw new Error("Stop the employee's active timer before completion");await context.admin.from("employees").update({status:"inactive",active:false}).eq("id",record.employee_id);await context.admin.from("employee_exits").update({status:"completed",completed_at:new Date().toISOString(),completed_by:context.user.id,updated_by:context.user.id}).eq("id",id);await audit(context,record,"exit_completed",{status:record.status},{status:"completed",employeeStatus:"inactive"});await notifyExitEvent(context.admin,{type:"exit_completed",exitId:id}).catch(console.error);return NextResponse.json({ok:true});
    }
    throw new Error("Unsupported exit action");
  }catch(cause){return fail(cause instanceof Error?cause.message:"Exit process operation failed",400);}
}
