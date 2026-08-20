import { supabase } from "@/lib/supabase";
import type { ExitWorkspaceData } from "./types";

async function token(){const {data}=await supabase.auth.getSession();if(!data.session?.access_token)throw new Error("Your session has expired");return data.session.access_token;}
export async function loadExitWorkspace(){const response=await fetch("/api/workforce/exits",{headers:{Authorization:`Bearer ${await token()}`},cache:"no-store"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Unable to load exit processes");return result as ExitWorkspaceData;}
export async function exitAction(action:string,payload:Record<string,unknown>={}){const response=await fetch("/api/workforce/exits",{method:"POST",headers:{Authorization:`Bearer ${await token()}`,"Content-Type":"application/json"},body:JSON.stringify({action,...payload})});const result=await response.json();if(!response.ok)throw new Error(result.error||"Exit process action failed");return result;}
