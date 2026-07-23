import "server-only";

import { createClient } from "@supabase/supabase-js";

export async function getProfileApiContext(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return {
      error: "Employee profile service is not configured",
      status: 500,
    } as const;
  }

  const accessToken = authHeader.slice(7);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(accessToken);
  if (userError || !user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,employee_id")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile?.employee_id) {
    return {
      error: "Your employee profile is not configured",
      status: 403,
    } as const;
  }

  return {
    user,
    profile,
    userClient,
    admin,
    accessToken,
  } as const;
}
