"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import OrganizationChart from "./OrganizationChart";
import type { TeamEmployee } from "./types";

type OrganizationEmployeeRow = {
  id: string;
  employee_code: string | null;
  title: string | null;
  name: string;
  email: string;
  role: string | null;
  department: string | null;
  reporting_manager_id: string | null;
  reporting_manager_name: string | null;
  reporting_manager_title: string | null;
  status: string | null;
};

function toTeamEmployee(row: OrganizationEmployeeRow): TeamEmployee {
  return {
    id: row.id,
    employee_code: row.employee_code,
    title: row.title,
    name: row.name,
    gender: null,
    email: row.email,
    role: row.role,
    level: null,
    department: row.department,
    date_of_joining: null,
    date_of_birth: null,
    epf_number: null,
    uan_number: null,
    reporting_manager_id: row.reporting_manager_id,
    reporting_manager: row.reporting_manager_id
      ? {
          id: row.reporting_manager_id,
          name: row.reporting_manager_name || "Reporting manager",
          title: row.reporting_manager_title,
        }
      : null,
    status: row.status,
    hourly_cost: null,
  };
}

export default function OrganizationChartLoader() {
  const [employees, setEmployees] = useState<TeamEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await supabase.rpc("get_workforce_overview_employees");
      if (cancelled) return;
      if (result.error) setError(result.error.message);
      else {
        setEmployees(
          ((result.data || []) as OrganizationEmployeeRow[]).map(
            toTeamEmployee,
          ),
        );
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-label="Loading organization chart">
        <div className="h-24 animate-pulse rounded-3xl bg-white" />
        <div className="h-[520px] animate-pulse rounded-3xl bg-white" />
      </div>
    );
  }
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700"
      >
        Unable to load the organization chart. {error}
      </p>
    );
  }
  return <OrganizationChart employees={employees} />;
}
