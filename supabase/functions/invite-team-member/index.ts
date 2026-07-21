import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new Error("Unauthorized.");
    }

    const {
      email,
      full_name,
      employee_code,
      designation,
      department,
      hourly_cost,
      access_role,
    } = await req.json();

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(full_name || "").trim();
    const roleLookup: Record<string, string> = {
      employee: "Employee",
      manager: "Manager",
      admin: "Admin",
      "super admin": "Super Admin",
    };
    const requestedRole =
      roleLookup[
        String(access_role || "Employee")
          .trim()
          .toLowerCase()
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
      ];

    if (!normalizedEmail || !normalizedName) {
      throw new Error("Name and email are required.");
    }
    if (!requestedRole) throw new Error("Select a valid access role.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error(
        "Supabase Edge Function environment variables are missing.",
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice(7);
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser(token);
    if (callerError || !caller) throw new Error("Unauthorized.");

    const { data: callerProfile, error: callerProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("user_id", caller.id)
        .single();
    if (callerProfileError) throw new Error("Unable to verify permissions.");
    const callerRole = String(callerProfile?.role || "").trim().toLowerCase();
    if (!["super admin", "admin"].includes(callerRole)) {
      throw new Error("Forbidden.");
    }
    if (requestedRole === "Super Admin" && callerRole !== "super admin") {
      throw new Error("Only a Super Admin can assign the Super Admin role.");
    }

    // Check whether this employee already exists in Kairo.
    const { data: existingEmployee, error: lookupError } =
      await supabaseAdmin
        .from("employees")
        .select("id, user_id, name, email")
        .ilike("email", normalizedEmail)
        .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (existingEmployee?.user_id) {
      throw new Error("This employee already has login access configured.");
    }

    // Send Supabase invitation and create the Auth user.
    const { data: authUser, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { full_name: normalizedName },
        redirectTo: "https://kairo.despacho.io/auth/callback",
      });

    if (inviteError) {
      throw inviteError;
    }

    const userId = authUser.user.id;

    let employeeId: string;

    if (existingEmployee) {
      // Imported/existing employee: link the new Auth account.
      const { data: updatedEmployee, error: updateError } =
        await supabaseAdmin
          .from("employees")
          .update({
            user_id: userId,
            employee_code: employee_code || null,
            name: normalizedName,
            role: designation || null,
            department: department || null,
            hourly_cost: Number(hourly_cost || 0),
            status: "active",
          })
          .eq("id", existingEmployee.id)
          .select("id")
          .single();

      if (updateError) {
        throw updateError;
      }

      employeeId = updatedEmployee.id;
    } else {
      // Brand-new employee: create the employee record.
      const { data: newEmployee, error: insertError } =
        await supabaseAdmin
          .from("employees")
          .insert({
            user_id: userId,
            employee_code: employee_code || null,
            name: normalizedName,
            email: normalizedEmail,
            role: designation || null,
            department: department || null,
            hourly_cost: Number(hourly_cost || 0),
            status: "active",
            active: true,
          })
          .select("id")
          .single();

      if (insertError) {
        throw insertError;
      }

      employeeId = newEmployee.id;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          employee_id: employeeId,
          full_name: normalizedName,
          role: requestedRole,
        },
        {
          onConflict: "user_id",
        },
      );

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        employee_id: employeeId,
        user_id: userId,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("invite-team-member error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unable to invite team member.",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
