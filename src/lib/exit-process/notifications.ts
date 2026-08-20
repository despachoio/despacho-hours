import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEmailHtml, createDespachoLogoAttachment, escapeHtml, GOOGLE_WORKSPACE_SENDER, KAIRO_SENDER_NAME, sendEmail } from "@/lib/email";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

type ExitEvent="resignation_submitted"|"company_exit_initiated"|"exit_cancelled"|"exit_completed";

export async function notifyExitEvent(admin:SupabaseClient,input:{type:ExitEvent;exitId:string}){
  const result=await admin.from("employee_exits").select("id,status,exit_source,approved_last_working_date,expected_last_working_date,employee:employees!employee_exits_employee_id_fkey(id,name,email,reporting_manager_id)").eq("id",input.exitId).single();
  if(result.error)return;const record=result.data;const employee=Array.isArray(record.employee)?record.employee[0]:record.employee;if(!employee)return;
  const recipientIds:string[]=[];
  if(input.type==="resignation_submitted"&&employee.reporting_manager_id){const manager=await admin.from("employees").select("user_id").eq("id",employee.reporting_manager_id).maybeSingle();if(manager.data?.user_id)recipientIds.push(manager.data.user_id);}
  if(["resignation_submitted","company_exit_initiated"].includes(input.type)){const profiles=await admin.from("profiles").select("user_id").in("role",["Finance Admin","Super Admin","finance admin","super admin"]);recipientIds.push(...(profiles.data||[]).map((item)=>item.user_id).filter(Boolean));}
  if(["exit_cancelled","exit_completed","company_exit_initiated"].includes(input.type)){const profile=await admin.from("profiles").select("user_id").eq("employee_id",employee.id).maybeSingle();if(profile.data?.user_id)recipientIds.push(profile.data.user_id);}
  const unique=[...new Set(recipientIds)];if(!unique.length)return;const emails=(await Promise.all(unique.map(async(id)=>{const user=await admin.auth.admin.getUserById(id);return user.data.user?.email||null;}))).filter((value):value is string=>Boolean(value));if(!emails.length)return;
  const titles:Record<ExitEvent,string>={resignation_submitted:"Resignation submitted for review",company_exit_initiated:"An employee exit process has been initiated",exit_cancelled:"Exit process cancelled",exit_completed:"Employee exit completed"};
  const settings=await loadCompanySettings(admin),logo=await loadCompanyLogo(settings);const url=`${process.env.NEXT_PUBLIC_APP_URL||"https://kairo.despacho.io"}/team?tab=exit`;
  const html=buildEmailHtml({companyName:settings.company_name,businessEmail:settings.business_email||GOOGLE_WORKSPACE_SENDER,website:settings.website||"https://www.despacho.io",eyebrow:"Kairo · Workforce Exit Process",title:titles[input.type],preheader:titles[input.type],introHtml:`<p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(employee.name)}</p>`,status:{label:String(record.status).replaceAll("_"," "),tone:input.type==="exit_cancelled"?"amber":input.type==="exit_completed"?"green":"blue"},details:[{label:"Employee",value:employee.name},{label:"Last Working Day",value:record.approved_last_working_date||record.expected_last_working_date||"Pending confirmation"}],cta:{label:"View Exit Process",url}});
  await sendEmail({senderName:KAIRO_SENDER_NAME,to:emails,subject:`${titles[input.type]} · ${employee.name}`,text:`${titles[input.type]}\n${employee.name}\n${url}`,html,attachments:[createDespachoLogoAttachment(logo.buffer)]});
}
