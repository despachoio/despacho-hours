import { redirect } from "next/navigation";

// The Accounts workspace performs the visible-tab guard; every data operation is
// independently protected by the Work Orders API and Supabase RLS.
export default function WorkOrdersAliasPage(){redirect("/accounts?tab=work-orders");}
