import { supabase } from "@/lib/supabase";
import type { AssetsPayload } from "./types";
async function headers(){const {data}=await supabase.auth.getSession();return {"Content-Type":"application/json",Authorization:`Bearer ${data.session?.access_token||""}`};}
async function response<T>(request:Promise<Response>){const result=await request;const body=await result.json();if(!result.ok)throw new Error(body.error||"Asset request failed");return body as T;}
export type AssetQuery = Record<string, string | number | boolean | null | undefined>;
export async function loadAssets(query:AssetQuery={}){
  const params=new URLSearchParams();
  Object.entries(query).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")params.set(key,String(value));});
  const suffix=params.size?`?${params.toString()}`:"";
  return response<AssetsPayload>(fetch(`/api/assets${suffix}`,{headers:await headers(),cache:"no-store"}));
}
export async function assetAction(body:Record<string,unknown>){return response<{ok:boolean;id?:string}>(fetch("/api/assets",{method:"POST",headers:await headers(),body:JSON.stringify(body)}));}
