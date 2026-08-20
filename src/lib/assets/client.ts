import { supabase } from "@/lib/supabase";
import type { AssetsPayload } from "./types";
async function headers(){const {data}=await supabase.auth.getSession();return {"Content-Type":"application/json",Authorization:`Bearer ${data.session?.access_token||""}`};}
async function response<T>(request:Promise<Response>){const result=await request;const body=await result.json();if(!result.ok)throw new Error(body.error||"Asset request failed");return body as T;}
export async function loadAssets(){return response<AssetsPayload>(fetch("/api/assets",{headers:await headers(),cache:"no-store"}));}
export async function assetAction(body:Record<string,unknown>){return response<{ok:boolean;id?:string}>(fetch("/api/assets",{method:"POST",headers:await headers(),body:JSON.stringify(body)}));}
