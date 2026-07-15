import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const {
      email,
      full_name,
      employee_code,
      designation,
      department,
      hourly_cost,
      access_role,
    } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const { data: authUser, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {

  data: { full_name },

  redirectTo: "https://kairo.despacho.io/auth/callback",

});

    if (inviteError) {
      throw inviteError;
    }

    const userId = authUser.user.id;

    const { data: employee, error: employeeError } =
  await supabaseAdmin
    .from("employees")
    .update({
      user_id: userId,
    })
    .eq("email", email)
    .select()
    .single();

    if (employeeError) {
      throw employeeError;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      employee_id: employee.id,
      full_name,
      role: access_role || "Employee",
    });

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});