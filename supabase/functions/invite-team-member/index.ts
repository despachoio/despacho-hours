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
      title,
      gender,
      designation,
      department,
      date_of_joining,
      date_of_birth,
      epf_number,
      uan_number,
      pan_number,
      aadhaar_number,
      reporting_manager_id,
      access_role,
    } = await req.json();

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(full_name || "").trim();
    const normalizedEmployeeCode = String(employee_code || "").trim();
    const normalizedTitle = String(title || "").trim();
    const normalizedGender = String(gender || "").trim();
    const normalizedDepartment = String(department || "").trim();
    const normalizedPan = String(pan_number || "")
      .trim()
      .toUpperCase();
    const normalizedAadhaar = String(aadhaar_number || "").replace(/\s+/g, "");
    const normalizedReportingManagerId = String(
      reporting_manager_id || "",
    ).trim();
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

    if (!normalizedEmployeeCode || !normalizedEmail || !normalizedName) {
      throw new Error("Employee code, name, and email are required.");
    }
    if (!["Mr", "Miss", "Mrs.", "Dr"].includes(normalizedTitle))
      throw new Error("Select a valid title.");
    if (!["Male", "Female", "Others"].includes(normalizedGender))
      throw new Error("Select a valid gender.");
    if (!requestedRole) throw new Error("Select a valid access role.");
    if (
      normalizedDepartment &&
      !["Operations", "HR", "Finance", "Management"].includes(
        normalizedDepartment,
      )
    ) {
      throw new Error("Select a valid department.");
    }
    if (
      normalizedPan &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizedPan)
    ) {
      throw new Error(
        "PAN must contain 5 letters, 4 digits, and 1 final letter.",
      );
    }
    if (normalizedAadhaar && !/^[0-9]{12}$/.test(normalizedAadhaar)) {
      throw new Error("Aadhaar must contain exactly 12 digits.");
    }

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

    if (normalizedReportingManagerId) {
      const { data: reportingManager, error: reportingManagerError } =
        await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("employee_id", normalizedReportingManagerId)
          .maybeSingle();
      const { data: reportingEmployee, error: reportingEmployeeError } =
        await supabaseAdmin
          .from("employees")
          .select("status")
          .eq("id", normalizedReportingManagerId)
          .maybeSingle();
      const reportingRole = String(reportingManager?.role || "")
        .trim()
        .toLowerCase();
      if (
        reportingManagerError ||
        reportingEmployeeError ||
        !reportingManager ||
        !reportingEmployee ||
        !["manager", "admin", "super admin"].includes(reportingRole) ||
        String(reportingEmployee?.status || "active").toLowerCase() !== "active"
      ) {
        throw new Error(
          "Reporting manager must be an active Manager, Admin, or Super Admin.",
        );
      }
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
            employee_code: normalizedEmployeeCode,
            title: normalizedTitle,
            name: normalizedName,
            gender: normalizedGender,
            role: designation || null,
            department: normalizedDepartment || null,
            date_of_joining: date_of_joining || null,
            date_of_birth: date_of_birth || null,
            epf_number: String(epf_number || "").trim() || null,
            uan_number: String(uan_number || "").trim() || null,
            reporting_manager_id: normalizedReportingManagerId || null,
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
            employee_code: normalizedEmployeeCode,
            title: normalizedTitle,
            name: normalizedName,
            gender: normalizedGender,
            email: normalizedEmail,
            role: designation || null,
            department: normalizedDepartment || null,
            date_of_joining: date_of_joining || null,
            date_of_birth: date_of_birth || null,
            epf_number: String(epf_number || "").trim() || null,
            uan_number: String(uan_number || "").trim() || null,
            reporting_manager_id: normalizedReportingManagerId || null,
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

    const { error: statutoryError } = await supabaseAdmin
      .from("employee_statutory_details")
      .upsert(
        {
          employee_id: employeeId,
          pan_number: normalizedPan || null,
          aadhaar_number: normalizedAadhaar || null,
        },
        { onConflict: "employee_id" },
      );
    if (statutoryError) {
      throw statutoryError;
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
