import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { KAIRO_SENDER_NAME, GOOGLE_WORKSPACE_SENDER, buildEmailHtml, createDespachoLogoAttachment, escapeHtml, sendEmail } from "@/lib/email";
import { loadCompanyLogo, loadCompanySettings } from "@/lib/settings/companySettings";

type AssetEvent="created"|"approved"|"rejected"|"issued";
export async function notifyAssetRequest(admin:SupabaseClient,input:{type:AssetEvent;requestId:string}){
  const result=await admin.from("asset_requests").select("request_code,status,quantity_requested,quantity_approved,reason,admin_comment,employee:employees!asset_requests_employee_id_fkey(id,name,title),item:asset_items!asset_requests_item_id_fkey(name),request_type:asset_request_types!asset_requests_request_type_id_fkey(name)").eq("id",input.requestId).single();
  if(result.error)return;const record=result.data;const employee=Array.isArray(record.employee)?record.employee[0]:record.employee;const item=Array.isArray(record.item)?record.item[0]:record.item;const requestType=Array.isArray(record.request_type)?record.request_type[0]:record.request_type;
  const recipientIds:string[]=[];
  if(input.type==="created"){
    const profiles=await admin.from("profiles").select("user_id").in("role",["Admin","Super Admin","Finance Admin","admin","super admin","finance admin"]);recipientIds.push(...(profiles.data||[]).map((profile)=>profile.user_id).filter(Boolean));
  }else if(employee?.id){const profile=await admin.from("profiles").select("user_id").eq("employee_id",employee.id).maybeSingle();if(profile.data?.user_id)recipientIds.push(profile.data.user_id);}
  if(!recipientIds.length)return;
  const emails=(await Promise.all(recipientIds.map(async(id)=>{const user=await admin.auth.admin.getUserById(id);return user.data.user?.email||null;}))).filter((email):email is string=>Boolean(email));if(!emails.length)return;
  const settings=await loadCompanySettings(admin);const logo=await loadCompanyLogo(settings);const employeeName=[employee?.title,employee?.name].filter(Boolean).join(" ")||"Employee";
  const titles={created:"New asset request requires review",approved:"Your asset request was approved",rejected:"Your asset request was rejected",issued:"Your requested item was issued"};
  const tones={created:"amber",approved:"green",rejected:"red",issued:"blue"} as const;const ctaUrl=`${process.env.NEXT_PUBLIC_APP_URL||"https://kairo.despacho.io"}/team?tab=assets`;
  const html=buildEmailHtml({companyName:settings.company_name,businessEmail:settings.business_email||GOOGLE_WORKSPACE_SENDER,website:settings.website||"https://www.despacho.io",eyebrow:"Kairo · Assets & Supplies",title:titles[input.type],preheader:titles[input.type],introHtml:`<p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(employeeName)} · ${escapeHtml(record.request_code)}</p>`,status:{label:record.status.replaceAll("_"," "),tone:tones[input.type]},details:[{label:"Employee",value:employeeName},{label:"Item",value:item?.name||"Item"},{label:"Request Type",value:requestType?.name||"Request"},{label:"Quantity",value:String(record.quantity_approved||record.quantity_requested)},{label:"Reason",value:record.reason},{label:"Admin Comment",value:record.admin_comment||"—"}],cta:{label:input.type==="created"?"Review Request":"View Request",url:ctaUrl}});
  await sendEmail({senderName:KAIRO_SENDER_NAME,to:emails,subject:`${titles[input.type]} · ${record.request_code}`,text:`${titles[input.type]}\n${employeeName}\n${item?.name||"Item"}\n${ctaUrl}`,html,attachments:[createDespachoLogoAttachment(logo.buffer)]});
}
