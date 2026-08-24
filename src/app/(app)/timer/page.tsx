"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";
import { useShortcutCommand } from "@/components/shortcuts/ShortcutProvider";
import { getTimerWorkDate } from "@/lib/timer/work-date";
import TimeOffIcon, { type TimeOffIconName } from "@/components/time-off/TimeOffIcon";


type Profile = {
  role: string;
  employee_id: string | null;
};


type Employee = {
  id: string;
  name: string;
  employee_code: string | null;
};


type Project = {
  id: string;
  name: string;
  project_code: string | null;
  used_hours: number;
  remaining_hours: number;

  clients: {
    name: string;
  } | null;

  project_resources?: {
    employee_id: string;
  }[];
};


type ActiveTimer = {
  id: string;
  employee_id: string;
  project_id: string;

  started_at: string;
  work_date: string | null;
  paused_at: string | null;
  total_paused_seconds: number;

  status: string;
  description: string | null;
};


type LiveTimer = {
  id: string;

  employee_id: string;
  project_id: string;

  started_at: string;
  paused_at: string | null;
  total_paused_seconds: number;

  status: string;
  description: string | null;


  employees: {
    name: string;
  } | null;


  projects: {

    name: string;

    project_code: string | null;

    clients: {
      name: string;
    } | null;

  } | null;
};


type TimeEntry = {

  id: string;

  employee_id: string;

  project_id: string;

  entry_date: string;

  started_at: string | null;

  stopped_at: string | null;

  hours: number;

  description: string | null;


  employees: {
    name: string;
  } | null;


  projects: {

    id: string;

    name: string;

    project_code: string | null;

    clients: {
      name: string;
    } | null;

  } | null;

};

function hydrateLiveTimerEmployeeNames(
  timers: LiveTimer[],
  employeeNames: Record<string, string>,
) {
  return timers.map((timer) => ({
    ...timer,
    employees: timer.employees?.name
      ? timer.employees
      : { name: employeeNames[timer.employee_id] || "" },
  }));
}



export default function TimePage() {


  const [profile, setProfile] =
    useState<Profile | null>(null);


  const [employees, setEmployees] =
    useState<Employee[]>([]);


  const [projects, setProjects] =
    useState<Project[]>([]);

  const [loadingEntries, setLoadingEntries] = useState(false);

  const [stoppingTimerIds, setStoppingTimerIds] = useState<Set<string>>(
  new Set(),
);


  const [entries, setEntries] =
    useState<TimeEntry[]>([]);

  const [personalSummaryEntries, setPersonalSummaryEntries] =
    useState<Pick<TimeEntry, "employee_id" | "project_id" | "entry_date" | "hours">[]>([]);



  const [employeeId, setEmployeeId] =
    useState("");

    const [startingTimer, setStartingTimer] = useState(false);


  const [projectId, setProjectId] =
    useState("");

  const [timerClient, setTimerClient] =
    useState("");


  const [description, setDescription] =
    useState("");



  const [activeTimer, setActiveTimer] =
    useState<ActiveTimer | null>(null);


  const [liveTimers, setLiveTimers] =
    useState<LiveTimer[]>([]);
  const [directReporteeIds, setDirectReporteeIds] = useState<string[]>([]);
  const [directReporteeNames, setDirectReporteeNames] = useState<Record<string, string>>({});


  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);
    const [tick, setTick] = useState(0);
  
  const [editingEntry, setEditingEntry] =

  useState<TimeEntry | null>(null);

const [editProjectId, setEditProjectId] =
  useState("");

const [editDate, setEditDate] =
  useState("");


const [editStart, setEditStart] =
  useState("");


const [editStop, setEditStop] =
  useState("");


const [editDescription, setEditDescription] =
  useState("");

  const [showManualEntry, setShowManualEntry] =
  useState(false);


const [manualEmployeeId, setManualEmployeeId] =
  useState("");


const [manualProjectId, setManualProjectId] =
  useState("");

const [manualClient, setManualClient] =
  useState("");


const [manualDate, setManualDate] =
  useState(
    new Date().toISOString().slice(0, 10)
  );


const [manualStart, setManualStart] =
  useState("");


const [manualStop, setManualStop] =
  useState("");


const [manualDescription, setManualDescription] =
  useState("");

  const [isSavingManual, setIsSavingManual] = useState(false);

const [isSavingEdit, setIsSavingEdit] = useState(false);
const timerActionsInFlight = useRef(new Set<string>());
const startTimerInFlight = useRef(false);

const PAGE_SIZE = 10;
const [filterEmployee, setFilterEmployee] = useState("");
const [filterClient, setFilterClient] = useState("");
const [filterProject, setFilterProject] = useState("");
const [filterDateRange, setFilterDateRange] = useState("");
const [customFrom, setCustomFrom] = useState("");
const [customTo, setCustomTo] = useState("");
const [search, setSearch] = useState("");
const [hasSearchedEntries, setHasSearchedEntries] = useState(false);
const [entrySearchError, setEntrySearchError] = useState("");
const [entryPage, setEntryPage] = useState(0);
const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
const [showMobileFilters, setShowMobileFilters] = useState(false);
const [viewingEntry, setViewingEntry] = useState<TimeEntry | null>(null);

const normalizedRole = String(profile?.role || "").trim().toLowerCase();
const canFilterTeamEntries =
  normalizedRole === "finance admin" ||
  normalizedRole === "super admin" ||
  normalizedRole === "admin" ||
  normalizedRole === "manager";
const canEditTimeEntries =
  ["finance admin", "super admin", "admin"].includes(normalizedRole);


function markTimerStopping(timerId: string) {
  setStoppingTimerIds((current) => {
    const next = new Set(current);
    next.add(timerId);
    return next;
  });
}

function unmarkTimerStopping(timerId: string) {
  setStoppingTimerIds((current) => {
    const next = new Set(current);
    next.delete(timerId);
    return next;
  });
}  

function formatDate(date:string){

return new Date(date)
.toLocaleDateString(
"en-GB",
{
day:"2-digit",
month:"short",
year:"numeric",
}
)
.replace(/ /g,"-");

}



function formatTime(date:string | null){

if(!date) return "-";


return new Date(date)
.toLocaleTimeString(
"en-IN",
{
hour:"2-digit",
minute:"2-digit",
}
);

}



function formatTimer(seconds:number){

const h=Math.floor(seconds/3600);

const m=Math.floor(
(seconds%3600)/60
);

const s=seconds%60;


return [h,m,s]
.map(
(v)=>String(v).padStart(2,"0")
)
.join(":");

}



function calculateElapsed(
timer:ActiveTimer | LiveTimer
){

return calculateWorkedSeconds(timer, Date.now());

}

function calculateWorkedSeconds(
timer: ActiveTimer | LiveTimer,
currentTimeMs: number
){

const start =
new Date(timer.started_at).getTime();


const end =
timer.status==="paused" &&
timer.paused_at

?

new Date(timer.paused_at).getTime()

:

currentTimeMs;


const totalSeconds =
Math.floor(
(end-start)/1000
);


return Math.max(
totalSeconds -
Number(
timer.total_paused_seconds || 0
),
0
);

}

async function getLatestTimer(timerId: string) {
  const { data, error } = await supabase
    .from("active_timers")
    .select("*")
    .eq("id", timerId)
    .maybeSingle();

  if (error) {
    alert(error.message);
    return null;
  }

  return data as ActiveTimer | null;
}

function beginTimerAction(timerId: string) {
  if (timerActionsInFlight.current.has(timerId)) return false;
  timerActionsInFlight.current.add(timerId);
  return true;
}

function finishTimerAction(timerId: string) {
  timerActionsInFlight.current.delete(timerId);
}

function buildLocalDateTime(date: string, time: string) {

  const [year, month, day] =

    date.split("-").map(Number);

  const [hour, minute] =

    time.split(":").map(Number);

  return new Date(

    year,

    month - 1,

    day,

    hour,

    minute,

    0,

    0

  );

}



function getInitials(name:string){

return name
.split(" ")
.map((w)=>w[0])
.join("")
.slice(0,2)
.toUpperCase();

}



function getLoggedInEmployeeName(){

const employee =
employees.find(
(e)=>
e.id===profile?.employee_id
);


return employee?.name || "";

}

function toDateKey(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function getDateBounds(range: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  const end = new Date(today);

  if (range === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (range === "this_week" || range === "last_week") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset - (range === "last_week" ? 7 : 0));
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (range === "this_month" || range === "last_month") {
    const monthOffset = range === "last_month" ? -1 : 0;
    start.setDate(1);
    start.setMonth(start.getMonth() + monthOffset);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1, 0);
  }

  return { from: toDateKey(start), to: toDateKey(end) };
}




async function loadData(){


const {data:userData} =
await supabase.auth.getUser();



let currentProfile:
Profile | null=null;



if(userData.user){


const {data:profileData} =
await supabase

.from("profiles")

.select(
"role, employee_id"
)

.eq(
"user_id",
userData.user.id
)

.single();



currentProfile=profileData;

setProfile(profileData);



if(profileData?.employee_id){

setEmployeeId(
profileData.employee_id
);

const week = getDateBounds("this_week");
const { data: summaryData, error: summaryError } = await supabase
  .from("time_entries")
  .select("employee_id,project_id,entry_date,hours")
  .eq("employee_id", profileData.employee_id)
  .gte("entry_date", week.from)
  .lte("entry_date", week.to);

if (summaryError) {
  console.error("Failed to load personal time summary:", summaryError);
  setPersonalSummaryEntries([]);
} else {
  setPersonalSummaryEntries(
    (summaryData || []) as Pick<
      TimeEntry,
      "employee_id" | "project_id" | "entry_date" | "hours"
    >[],
  );
}

}

}



// Employees


let employeeQuery =
supabase

.from("employees")

.select(
"id,name,employee_code"
)

.eq(
"status",
"active"
)

.order("name");



if(
currentProfile?.role==="Employee" &&
currentProfile.employee_id
){

employeeQuery =
employeeQuery.eq(
"id",
currentProfile.employee_id
);

}



const {data:employeeData} =
await employeeQuery;


if(employeeData)
setEmployees(employeeData);



// Projects


const {data:projectData} =
await supabase

.from("projects")

.select(`
id,
name,
project_code,
used_hours,
remaining_hours,
clients(name),
project_resources(employee_id)
`)

.eq(
"status",
"active"
)

.order("name");



let filteredProjects =
projectData || [];



if(
currentProfile?.role==="Employee" &&
currentProfile.employee_id
){

filteredProjects =
filteredProjects.filter(
(project:any)=>

project.project_resources
?.some(
(resource:any)=>

resource.employee_id ===
currentProfile?.employee_id

)

);

}


setProjects(
filteredProjects as unknown as Project[]
);



// Time Entries






// Own active timer


let timerData=null;


if(currentProfile?.employee_id){


const { data, error: timerError } = await supabase
  .from("active_timers")
  .select("*")
  .eq("employee_id", currentProfile.employee_id)
  .in("status", ["running", "paused"])
  .order("started_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (timerError) {
  console.error("Failed to load active timer:", timerError);
}

timerData = data;


}



if (timerData) {

  setActiveTimer(timerData);

  setProjectId(timerData.project_id);

  setDescription(timerData.description || "");

  setElapsedSeconds(
    calculateElapsed(timerData)
  );

} else {

  if (activeTimer) {

    setActiveTimer(null);

    setElapsedSeconds(0);

    setTimerClient("");

    setProjectId("");

    setDescription("");

  }

}



// Admin / Manager Live timers


if(
currentProfile?.role === "Finance Admin" ||
currentProfile?.role === "Super Admin" ||
currentProfile?.role === "Admin" ||
currentProfile?.role==="Manager"
){

let managerReporteeIds: string[] = [];
let managerReporteeNames: Record<string, string> = {};
if (currentProfile.role === "Manager") {
  const reporteeResult = await supabase.rpc("get_team_metric_employees");
  const reportees = (reporteeResult.data || []) as Array<{
    id: string;
    name: string;
  }>;
  managerReporteeIds = reportees.map(
    (employee) => employee.id,
  );
  managerReporteeNames = Object.fromEntries(
    reportees.map((employee) => [employee.id, employee.name]),
  );
  setDirectReporteeIds(managerReporteeIds);
  setDirectReporteeNames(managerReporteeNames);
}

let liveTimerQuery = supabase

.from("active_timers")

.select(`
id,
employee_id,
project_id,
started_at,
paused_at,
total_paused_seconds,
status,
description,
employees(name),
projects(
name,
project_code,
clients(name)
)
`);

if (currentProfile.role === "Manager") {
  if (!managerReporteeIds.length) {
    setLiveTimers([]);
  } else {
    liveTimerQuery = liveTimerQuery.in("employee_id", managerReporteeIds);
  }
}

const {data:liveData} =
  currentProfile.role === "Manager" && !managerReporteeIds.length
    ? { data: [] }
    : await liveTimerQuery;

if(liveData) {
  const timers = liveData as unknown as LiveTimer[];
  setLiveTimers(
    currentProfile.role === "Manager"
      ? hydrateLiveTimerEmployeeNames(timers, managerReporteeNames)
      : timers,
  );
}


}else{

setLiveTimers([]);

}


}

async function searchTimeEntries() {
  if (loadingEntries) return;

  const selectedEmployeeId = canFilterTeamEntries
    ? filterEmployee
    : profile?.employee_id || "";
  const bounds =
    filterDateRange && filterDateRange !== "custom"
      ? getDateBounds(filterDateRange)
      : null;
  const hasDatabaseFilter = Boolean(
    selectedEmployeeId ||
      filterProject ||
      bounds ||
      (filterDateRange === "custom" && (customFrom || customTo)),
  );

  if (!hasDatabaseFilter) {
    setEntries([]);
    setHasSearchedEntries(false);
    setEntrySearchError(
      "Select an employee, project, or date range before searching.",
    );
    return;
  }

  setLoadingEntries(true);
  setEntrySearchError("");
  try {
    let query = supabase
      .from("time_entries")
      .select(`
        id,
        employee_id,
        project_id,
        entry_date,
        started_at,
        stopped_at,
        hours,
        description,
        employees(name),
        projects(
          id,
          name,
          project_code,
          clients(name)
        )
      `)
      .order("entry_date", { ascending: false })
      .order("stopped_at", { ascending: false });

    if (selectedEmployeeId) {
      query = query.eq("employee_id", selectedEmployeeId);
    }
    if (filterProject) {
      query = query.eq("project_id", filterProject);
    }
    if (bounds) {
      query = query
        .gte("entry_date", bounds.from)
        .lte("entry_date", bounds.to);
    } else if (filterDateRange === "custom") {
      if (customFrom) query = query.gte("entry_date", customFrom);
      if (customTo) query = query.lte("entry_date", customTo);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Time entry search failed:", error);
      setEntries([]);
      setHasSearchedEntries(true);
      setEntrySearchError(error.message);
      return;
    }

    let results = (data || []) as unknown as TimeEntry[];
    if (filterClient) {
      results = results.filter(
        (entry) => entry.projects?.clients?.name === filterClient,
      );
    }

    const searchTerm = search.trim().toLowerCase();
    if (searchTerm) {
      results = results.filter((entry) =>
        [
          entry.employees?.name,
          entry.projects?.clients?.name,
          entry.projects?.project_code,
          entry.projects?.name,
          entry.description,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(searchTerm),
      );
    }

    setEntries(results);
    setHasSearchedEntries(true);
    setEntryPage(0);
  } finally {
    setLoadingEntries(false);
  }
}
async function handleStartTimer() {
  // Immediate protection against double-clicks.
  if (startTimerInFlight.current) return;

  if (!employeeId) {
    alert("Employee login is not configured.");
    return;
  }

  if (!projectId) {
    alert("Please select a project.");
    return;
  }

  startTimerInFlight.current = true;
  setStartingTimer(true);

  try {
    // Check whether the employee already has a running or paused timer.
    const { data: existingTimers, error: existingTimerError } =
      await supabase
        .from("active_timers")
        .select("id, status, project_id")
        .eq("employee_id", employeeId)
        .in("status", ["running", "paused"])
        .order("started_at", { ascending: false })
        .limit(1);

    if (existingTimerError) {
      alert(existingTimerError.message);
      return;
    }

    const existingTimer = existingTimers?.[0];

    if (existingTimer) {
      alert(
        existingTimer.status === "paused"
          ? "You already have a paused timer. Resume or stop it before starting another timer."
          : "You already have an active timer."
      );

      await loadData();
      return;
    }

    const { data: newTimer, error: insertError } = await supabase
      .from("active_timers")
      .insert({
        employee_id: employeeId,
        project_id: projectId,
        description: description.trim() || null,
        status: "running",
      })
      .select("*")
      .single();

    if (insertError) {
      // PostgreSQL unique-constraint violation.
      if (insertError.code === "23505") {
        alert("You already have an active timer.");
        await loadData();
        return;
      }

      alert(insertError.message);
      return;
    }

    setActiveTimer(newTimer as ActiveTimer);
    setElapsedSeconds(0);

    await loadData();
  } finally {
    startTimerInFlight.current = false;
    setStartingTimer(false);
  }
}




async function pauseTimer() {
  if (!activeTimer || !beginTimerAction(activeTimer.id)) return;

  try {
    const latestTimer = await getLatestTimer(activeTimer.id);
    if (!latestTimer || latestTimer.status !== "running") return;

    const pausedAt = new Date().toISOString();
    const { error } = await supabase
      .from("active_timers")
      .update({
        status: "paused",
        paused_at: pausedAt,
      })
      .eq("id", latestTimer.id)
      .eq("status", "running");

    if (error) {
      alert(error.message);
      return;
    }

    loadData();
  } finally {
    finishTimerAction(activeTimer.id);
  }
}

async function resumeTimer() {
  if (!activeTimer || !beginTimerAction(activeTimer.id)) return;

  try {
    const latestTimer = await getLatestTimer(activeTimer.id);
    if (!latestTimer || latestTimer.status !== "paused" || !latestTimer.paused_at) return;

    const resumedAtMs = Date.now();
    const pausedDurationSeconds = Math.max(
      Math.floor((resumedAtMs - new Date(latestTimer.paused_at).getTime()) / 1000),
      0
    );

    const { error } = await supabase
      .from("active_timers")
      .update({
        status: "running",
        paused_at: null,
        total_paused_seconds:
          Number(latestTimer.total_paused_seconds || 0) + pausedDurationSeconds,
      })
      .eq("id", latestTimer.id)
      .eq("status", "paused");

    if (error) {
      alert(error.message);
      return;
    }

    loadData();
  } finally {
    finishTimerAction(activeTimer.id);
  }
}
async function stopTimer() {
  if (!activeTimer || !beginTimerAction(activeTimer.id)) return;

  const timerId = activeTimer.id;
  markTimerStopping(timerId);

  try {
    const latestTimer = await getLatestTimer(timerId);

    // Another request may already have stopped and deleted it.
    if (!latestTimer) {
      await loadData();
      return;
    }

    const stoppedAtMs = Date.now();
    const stoppedAt = new Date(stoppedAtMs).toISOString();

    const workedSeconds = calculateWorkedSeconds(
      latestTimer,
      stoppedAtMs,
    );

    const workedHours = Number(
      (workedSeconds / 3600).toFixed(2),
    );

    if (workedHours <= 0) {
      alert("Timer is too short to save.");
      return;
    }

    const selectedProject = projects.find(
      (project) => project.id === latestTimer.project_id,
    );

    if (!selectedProject) {
      alert("Project not found.");
      return;
    }

    const { error: insertError } = await supabase
      .from("time_entries")
      .insert({
        employee_id: latestTimer.employee_id,
        project_id: latestTimer.project_id,
        entry_date: getTimerWorkDate(latestTimer),
        started_at: latestTimer.started_at,
        stopped_at: stoppedAt,
        hours: workedHours,
        description:
          latestTimer.description || description || null,

        // Prevent the same timer from creating two entries.
        source_timer_id: latestTimer.id,
      });

    if (insertError) {
      // Another request has already created the entry.
      if (insertError.code === "23505") {
  console.warn(
    `Time entry already exists for timer ${latestTimer.id}`,
  );

  // Clear a stale active timer left behind by an earlier successful insert.
  const { error: cleanupError } = await supabase
    .from("active_timers")
    .delete()
    .eq("id", latestTimer.id);

  if (cleanupError) {
    console.error(
      "Duplicate entry exists, but timer cleanup failed:",
      cleanupError,
    );

    alert(
      "This time entry was already saved, but the active timer could not be cleared. Please refresh and contact an administrator if it remains visible.",
    );

    return;
  }

  setActiveTimer(null);
  setElapsedSeconds(0);
  setTimerClient("");
  setProjectId("");
  setDescription("");

  await loadData();
  return;
}

      alert(insertError.message);
      return;
    }

    const { error: deleteTimerError } = await supabase
      .from("active_timers")
      .delete()
      .eq("id", latestTimer.id);

    if (deleteTimerError) {
      console.error(
        "Time entry saved, but active timer deletion failed:",
        deleteTimerError,
      );
      alert(
        "Time was saved, but the timer could not be cleared. Please refresh the page.",
      );
      return;
    }

    setActiveTimer(null);
    setElapsedSeconds(0);
    setTimerClient("");
    setProjectId("");
    setDescription("");

    await loadData();
  } finally {
    finishTimerAction(timerId);
      unmarkTimerStopping(timerId);

  }
}
async function adminStopTimer(timer: LiveTimer) {
  if (!confirm("Stop this timer and save?")) return;
  if (!beginTimerAction(timer.id)) return;
  markTimerStopping(timer.id);

  try {
    const latestTimer = await getLatestTimer(timer.id);

    // Employee or another admin may already have stopped it.
    if (!latestTimer) {
      await loadData();
      return;
    }

    const stoppedAtMs = Date.now();
    const stoppedAt = new Date(stoppedAtMs).toISOString();

    const workedSeconds = calculateWorkedSeconds(
      latestTimer,
      stoppedAtMs,
    );

    const workedHours = Number(
      (workedSeconds / 3600).toFixed(2),
    );

    if (workedHours <= 0) {
      alert("Timer is too short to save.");
      return;
    }

    const { error: insertError } = await supabase
      .from("time_entries")
      .insert({
        employee_id: latestTimer.employee_id,
        project_id: latestTimer.project_id,
        entry_date: getTimerWorkDate(latestTimer),
        started_at: latestTimer.started_at,
        stopped_at: stoppedAt,
        hours: workedHours,
        description: latestTimer.description || null,

        // Prevent duplicate entries from the same timer.
        source_timer_id: latestTimer.id,
      });

    if (insertError) {
      if (insertError.code === "23505") {
  console.warn(
    `Time entry already exists for timer ${latestTimer.id}`,
  );

  const { error: cleanupError } = await supabase
    .from("active_timers")
    .delete()
    .eq("id", latestTimer.id);

  if (cleanupError) {
    console.error(
      "Duplicate entry exists, but timer cleanup failed:",
      cleanupError,
    );

    alert(
      "This time entry was already saved, but the active timer could not be cleared.",
    );

    return;
  }

  await loadData();
  return;
}

      alert(insertError.message);
      return;
    }

    const { error: deleteTimerError } = await supabase
      .from("active_timers")
      .delete()
      .eq("id", latestTimer.id);

    if (deleteTimerError) {
      console.error(
        "Time entry saved, but active timer deletion failed:",
        deleteTimerError,
      );
      alert(
        "Time was saved, but the active timer could not be cleared.",
      );
      return;
    }

    await loadData();
  } finally {
    finishTimerAction(timer.id);
      unmarkTimerStopping(timer.id);

  }
}
async function deleteTimeEntry(entry: TimeEntry) {
  if (!confirm("Are you sure you want to delete this time entry?")) return;

  const projectId = entry.projects?.id;

  if (!projectId) {
    alert("Project not found for this entry.");
    return;
  }

  const { error: deleteError } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", entry.id);

  if (deleteError) {
    alert(deleteError.message);
    console.error(deleteError);
    return;
  }

  alert("Time entry deleted and project hours updated.");

  setEntries((current) => current.filter((item) => item.id !== entry.id));
  setEntryPage((current) =>
    Math.min(
      current,
      Math.max(0, Math.ceil((entries.length - 1) / PAGE_SIZE) - 1),
    ),
  );
  loadData();
}

async function saveManualEntry() {
  if (isSavingManual) return;
  setIsSavingManual(true);

  try {
    if (!manualEmployeeId || !manualProjectId || !manualDate || !manualStart || !manualStop) {
      alert("Please fill all required fields.");
      return;
    }

    const startDate = buildLocalDateTime(manualDate, manualStart);
    const stopDate = buildLocalDateTime(manualDate, manualStop);

    if (stopDate.getTime() === startDate.getTime()) {
      alert("Stop time must be different from start time.");
      return;
    }

    if (stopDate < startDate) {
      stopDate.setDate(stopDate.getDate() + 1);
    }

    if (startDate > new Date()) {
      alert("Start time cannot be in the future.");
      return;
    }

    if (stopDate > new Date()) {
      alert("Stop time cannot be in the future.");
      return;
    }

    const hours = Number(
      ((stopDate.getTime() - startDate.getTime()) / 3600000).toFixed(2)
    );

    const { error } = await supabase.from("time_entries").insert({
      employee_id: manualEmployeeId,
      project_id: manualProjectId,
      entry_date: manualDate,
      started_at: startDate.toISOString(),
      stopped_at: stopDate.toISOString(),
      hours,
      description: manualDescription || null,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setShowManualEntry(false);
    setManualClient("");
    setManualProjectId("");
    setManualStart("");
    setManualStop("");
    setManualDescription("");

    loadData();
  } finally {
    setIsSavingManual(false);
  }
}

async function saveEditedEntry() {
  if (isSavingEdit) return;
  setIsSavingEdit(true);

  try {
    if (!editingEntry) return;

    const oldProjectId = editingEntry.projects?.id || editProjectId;

    if (!oldProjectId || !editProjectId || !editDate || !editStart || !editStop) {
      alert("Please fill all required fields.");
      return;
    }

    const startDate = buildLocalDateTime(editDate, editStart);
    const stopDate = buildLocalDateTime(editDate, editStop);

    if (stopDate.getTime() === startDate.getTime()) {
      alert("Stop time must be different from start time.");
      return;
    }

    if (stopDate < startDate) {
      stopDate.setDate(stopDate.getDate() + 1);
    }

    if (startDate > new Date()) {
      alert("Start time cannot be in the future.");
      return;
    }

    if (stopDate > new Date()) {
      alert("Stop time cannot be in the future.");
      return;
    }

    const hours = Number(
      ((stopDate.getTime() - startDate.getTime()) / 3600000).toFixed(2)
    );

    const { error: updateError } = await supabase
      .from("time_entries")
      .update({
        project_id: editProjectId,
        entry_date: editDate,
        started_at: startDate.toISOString(),
        stopped_at: stopDate.toISOString(),
        hours,
        description: editDescription || null,
      })
      .eq("id", editingEntry.id);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    setEditingEntry(null);
    setEditProjectId("");
    setEditDate("");
    setEditStart("");
    setEditStop("");
    setEditDescription("");

    const updatedProject = projects.find(
      (project) => project.id === editProjectId,
    );
    setEntries((current) =>
      current.map((entry) =>
        entry.id === editingEntry.id
          ? {
              ...entry,
              project_id: editProjectId,
              entry_date: editDate,
              started_at: startDate.toISOString(),
              stopped_at: stopDate.toISOString(),
              hours,
              description: editDescription || null,
              projects: updatedProject
                ? {
                    id: updatedProject.id,
                    name: updatedProject.name,
                    project_code: updatedProject.project_code,
                    clients: updatedProject.clients,
                  }
                : entry.projects,
            }
          : entry,
      ),
    );
    loadData();
  } finally {
    setIsSavingEdit(false);
  }
}

async function syncOwnActiveTimer() {
  if (!profile?.employee_id) return;

  const { data } = await supabase
    .from("active_timers")
    .select("*")
    .eq("employee_id", profile.employee_id)
    .maybeSingle();

  if (data) {
    setActiveTimer(data as ActiveTimer);
    setElapsedSeconds(calculateElapsed(data as ActiveTimer));
    setProjectId(data.project_id);
    setDescription(data.description || "");
  } else {
    setActiveTimer(null);
    setElapsedSeconds(0);
  }
}


useEffect(()=>{

loadData();

},[]);

useEffect(() => {

  if (!profile?.employee_id) return;

  const interval = setInterval(() => {

    syncOwnActiveTimer();

  }, 1000);

  return () => clearInterval(interval);

}, [profile?.employee_id]);

useEffect(() => {

  const interval = setInterval(() => {

    setTick((value) => value + 1);

  }, 1000);

  return () => clearInterval(interval);

}, []);




useEffect(() => {

  if (!activeTimer) {

    setElapsedSeconds(0);

    return;

  }

  if (activeTimer.status === "paused") {

    setElapsedSeconds(

      calculateElapsed(activeTimer)

    );

    return;

  }

  if (activeTimer.status === "running") {

    const interval = setInterval(() => {

      setElapsedSeconds(

        calculateElapsed(activeTimer)

      );

    }, 1000);

    return () => clearInterval(interval);

  }

}, [

  activeTimer?.id,

  activeTimer?.status,

  activeTimer?.paused_at,

]);







useEffect(() => {
  if (
    profile?.role !== "Finance Admin" &&
    profile?.role !== "Super Admin" &&
    profile?.role !== "Admin" &&
    profile?.role !== "Manager"
  )
    return;

  const interval = setInterval(async () => {
    if (profile.role === "Manager" && !directReporteeIds.length) {
      setLiveTimers([]);
      return;
    }
    let liveTimerQuery = supabase
      .from("active_timers")
      .select(`
        id,
        employee_id,
        project_id,
        started_at,
        paused_at,
        total_paused_seconds,
        status,
        description,
        employees(name),
        projects(
          name,
          project_code,
          clients(name)
        )
      `);
    if (profile.role === "Manager") {
      liveTimerQuery = liveTimerQuery.in(
        "employee_id",
        directReporteeIds,
      );
    }
    const { data: liveData } = await liveTimerQuery;

    if (liveData) {
      const timers = liveData as unknown as LiveTimer[];
      setLiveTimers(
        profile.role === "Manager"
          ? hydrateLiveTimerEmployeeNames(timers, directReporteeNames)
          : timers,
      );
    }
  }, 5000);

  return () => clearInterval(interval);
}, [profile?.role, directReporteeIds, directReporteeNames]);

const timerAssignedProjects = useMemo(
  () => profile?.employee_id
    ? projects.filter((project) => project.project_resources?.some((resource) => resource.employee_id === profile.employee_id))
    : [],
  [projects, profile?.employee_id]
);

const timerClients = useMemo(
  () => Array.from(new Set(timerAssignedProjects.map((project) => project.clients?.name).filter(Boolean) as string[])).sort(),
  [timerAssignedProjects]
);

const timerProjects = useMemo(
  () => timerClient
    ? timerAssignedProjects.filter((project) => project.clients?.name === timerClient)
    : [],
  [timerAssignedProjects, timerClient]
);

const manualAssignedProjects = useMemo(
  () => manualEmployeeId
    ? projects.filter((project) => project.project_resources?.some((resource) => resource.employee_id === manualEmployeeId))
    : [],
  [projects, manualEmployeeId]
);

const manualClients = useMemo(
  () => Array.from(new Set(manualAssignedProjects.map((project) => project.clients?.name).filter(Boolean) as string[])).sort(),
  [manualAssignedProjects]
);

const manualProjects = useMemo(
  () => manualClient
    ? manualAssignedProjects.filter((project) => project.clients?.name === manualClient)
    : [],
  [manualAssignedProjects, manualClient]
);

const entryFilterEmployeeId = canFilterTeamEntries
  ? filterEmployee
  : profile?.employee_id || "";

const selectedEmployeeProjects = useMemo(() => {
  if (!entryFilterEmployeeId) return [];

  return projects.filter((project) =>
    project.project_resources?.some(
      (resource) => resource.employee_id === entryFilterEmployeeId
    )
  );
}, [projects, entryFilterEmployeeId]);

const selectedEmployeeClients = useMemo(() => {
  return Array.from(
    new Set(
      selectedEmployeeProjects
        .map((project) => project.clients?.name)
        .filter(Boolean) as string[]
    )
  ).sort();
}, [selectedEmployeeProjects]);

const selectedEmployeeFilteredProjects = useMemo(() => {
  if (!filterClient) return selectedEmployeeProjects;

  return selectedEmployeeProjects.filter(
    (project) => project.clients?.name === filterClient
  );
}, [selectedEmployeeProjects, filterClient]);

const visibleLiveTimers = useMemo<LiveTimer[]>(() => {
  let visible: LiveTimer[] = [];

  if (profile?.role === "Manager") {
    visible = liveTimers.filter((timer) =>
      directReporteeIds.includes(timer.employee_id),
    );
  } else if (
    profile?.role === "Finance Admin" ||
    profile?.role === "Super Admin" ||
    profile?.role === "Admin"
  ) {
    visible = [...liveTimers];
  } else if (profile?.role === "Employee" && activeTimer) {
    const timerProject = projects.find((project) => project.id === activeTimer.project_id);
    visible = [{
      ...activeTimer,
      employees: { name: getLoggedInEmployeeName() },
      projects: timerProject ? {
        name: timerProject.name,
        project_code: timerProject.project_code,
        clients: timerProject.clients,
      } : null,
    }];
  }

  return visible.sort((first, second) => {
    if (first.status !== second.status) return first.status === "running" ? -1 : 1;
    return calculateElapsed(second) - calculateElapsed(first);
  });
}, [profile?.role, liveTimers, activeTimer, projects, employees, tick, directReporteeIds]);

const runningLiveTimerCount = visibleLiveTimers.filter((timer) => timer.status === "running").length;

const paginatedEntries = useMemo(
  () => entries.slice(entryPage * PAGE_SIZE, (entryPage + 1) * PAGE_SIZE),
  [entries, entryPage]
);

const totalEntryPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
const visibleEntryPages = useMemo(() => {
  const firstPage = Math.max(0, Math.min(entryPage - 2, totalEntryPages - 5));
  const lastPage = Math.min(totalEntryPages, firstPage + 5);
  return Array.from(
    { length: lastPage - firstPage },
    (_, index) => firstPage + index,
  );
}, [entryPage, totalEntryPages]);

const groupedEntries = useMemo(
  () => paginatedEntries.reduce<Record<string, TimeEntry[]>>((groups, entry) => {
    (groups[entry.entry_date] ||= []).push(entry);
    return groups;
  }, {}),
  [paginatedEntries]
);

const summary = useMemo(() => {
  const today = toDateKey(new Date());
  const week = getDateBounds("this_week");
  const weekEntries = personalSummaryEntries.filter(
    (entry) => entry.entry_date >= week.from && entry.entry_date <= week.to,
  );
  return {
    today: personalSummaryEntries
      .filter((entry) => entry.entry_date === today)
      .reduce((total, entry) => total + Number(entry.hours || 0), 0),
    week: weekEntries.reduce((total, entry) => total + Number(entry.hours || 0), 0),
    projects: new Set(weekEntries.map((entry) => entry.project_id)).size,
    running:
      profile?.role === "Finance Admin" ||
      profile?.role === "Super Admin" ||
      profile?.role === "Admin" ||
      profile?.role === "Manager"
        ? liveTimers.length
        : activeTimer
          ? 1
          : 0,
  };
}, [personalSummaryEntries, liveTimers.length, activeTimer, profile?.role]);

function resetFilters() {
  setFilterEmployee("");
  setFilterClient("");
  setFilterProject("");
  setFilterDateRange("");
  setCustomFrom("");
  setCustomTo("");
  setSearch("");
  setEntries([]);
  setHasSearchedEntries(false);
  setEntrySearchError("");
  setEntryPage(0);
}

function beginEdit(entry: TimeEntry) {
  setEditingEntry(entry);
  setEditProjectId(entry.projects?.id || "");
  setEditDate(entry.entry_date);
  setEditStart(entry.started_at ? new Date(entry.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
  setEditStop(entry.stopped_at ? new Date(entry.stopped_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
  setEditDescription(entry.description || "");
}

async function toggleTeamTimer(timer: LiveTimer) {
  if (!beginTimerAction(timer.id)) return;

  try {
    const latestTimer = await getLatestTimer(timer.id);
    if (!latestTimer) return;

    if (latestTimer.status === "running") {
      const pausedAt = new Date().toISOString();
      const { error } = await supabase
        .from("active_timers")
        .update({ status: "paused", paused_at: pausedAt })
        .eq("id", latestTimer.id)
        .eq("status", "running");
      if (error) alert(error.message);
    } else if (latestTimer.status === "paused" && latestTimer.paused_at) {
      const resumedAtMs = Date.now();
      const pausedDurationSeconds = Math.max(
        Math.floor((resumedAtMs - new Date(latestTimer.paused_at).getTime()) / 1000),
        0
      );
      const { error } = await supabase
        .from("active_timers")
        .update({
          status: "running",
          paused_at: null,
          total_paused_seconds:
            Number(latestTimer.total_paused_seconds || 0) + pausedDurationSeconds,
        })
        .eq("id", latestTimer.id)
        .eq("status", "paused");
      if (error) alert(error.message);
    }

    loadData();
  } finally {
    finishTimerAction(timer.id);
  }
}

useEffect(() => {
  if (!canEditTimeEntries) return;
  const openManualEntry = () => {
    setShowManualEntry(true);
    if (profile?.employee_id) setManualEmployeeId(profile.employee_id);
  };
  window.addEventListener("kairo:manual-time", openManualEntry);
  return () => window.removeEventListener("kairo:manual-time", openManualEntry);
}, [canEditTimeEntries, profile?.employee_id]);

useShortcutCommand({
  id: "timer.start",
  label: "Start timer",
  category: "Timer",
  shortcut: { code: "KeyS", alt: true, label: "S" },
  disabled:
    Boolean(activeTimer) ||
    startingTimer ||
    !employeeId ||
    !timerClient ||
    !projectId ||
    !description.trim(),
  handler: () => void handleStartTimer(),
});

useShortcutCommand({
  id: "timer.pause-resume",
  label: activeTimer?.status === "paused" ? "Resume timer" : "Pause timer",
  category: "Timer",
  shortcut: { code: "KeyP", alt: true, label: "P" },
  disabled: !activeTimer,
  handler: () => {
    if (activeTimer?.status === "paused") void resumeTimer();
    else if (activeTimer) void pauseTimer();
  },
});

useShortcutCommand({
  id: "timer.stop",
  label: "Stop timer",
  category: "Timer",
  shortcut: { code: "KeyX", alt: true, label: "X" },
  disabled:
    !activeTimer ||
    stoppingTimerIds.has(activeTimer.id),
  handler: () => void stopTimer(),
});

useShortcutCommand({
  id: "timer.manual-entry",
  label: "Add time entry",
  category: "Timer",
  shortcut: { code: "KeyM", alt: true, label: "M" },
  disabled: !canEditTimeEntries,
  handler: () => {
    setShowManualEntry(true);
    if (profile?.employee_id) setManualEmployeeId(profile.employee_id);
  },
});

useShortcutCommand({
  id: "timer.close-overlay",
  label: "Close current dialog",
  category: "General",
  shortcut: { code: "Escape", label: "Esc", allowWhileTyping: true },
  disabled: !editingEntry && !showManualEntry && !viewingEntry,
  handler: () => {
    if (editingEntry) setEditingEntry(null);
    else if (showManualEntry) setShowManualEntry(false);
    else if (viewingEntry) setViewingEntry(null);
  },
});
return (

<main className="min-h-screen bg-[#F8FAFC] px-5 py-7 sm:px-8">
  <div className="mx-auto max-w-[1500px]">
    <header className="relative min-h-[250px] overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#0F172A] via-[#172554] to-[#153E90] px-8 py-10 text-white shadow-xl shadow-slate-300/50 lg:px-12">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/70 blur-3xl" />
      <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
      <div className="relative flex min-h-[170px] flex-col justify-between gap-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.24em] text-cyan-200">
            Despacho workforce
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Time Tracking</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100">
            Track project time and monitor live work.
          </p>
        </div>
        {["Finance Admin", "Super Admin", "Admin"].includes(profile?.role || "") && (
          <button
            onClick={() => {
              setShowManualEntry(true);
              if (profile?.employee_id)
                setManualEmployeeId(profile.employee_id);
            }}
            aria-keyshortcuts="Alt+M"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#0F172A] shadow-lg transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          >
            + Add Time
          </button>
        )}
      </div>
    </header>

    <section className="relative z-10 mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 sm:mx-4 sm:p-6">
  {!activeTimer ? (
        <>
          <div>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">Timer</h2>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[250px_0.9fr_1fr_1.35fr_auto]">
            <div className="flex items-center gap-3 rounded-xl bg-slate-30 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">{getInitials(getLoggedInEmployeeName())}</div>
              <div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Logged in as</p><p className="truncate font-bold">{getLoggedInEmployeeName()}</p></div>
            </div>
            <label className="block">
              <span className="sr-only">Client</span>
              <select
                value={timerClient}
                onChange={(event) => {
                  setTimerClient(event.target.value);
                  setProjectId("");
                }}
                className="h-full w-full rounded-xl border border-slate-500 px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">Select client</option>
                {timerClients.map((client) => <option key={client} value={client}>{client}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Project</span>
              <select value={projectId} disabled={!timerClient} onChange={(event) => setProjectId(event.target.value)} className="h-full w-full rounded-xl border border-slate-500 px-4 py-3 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400">
                <option value="">Select project</option>
                {timerProjects.map((project) => <option key={project.id} value={project.id}>[{project.project_code}] {project.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Description</span>
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you working on?" className="h-full w-full rounded-xl border border-slate-500 px-4 py-3 outline-none focus:border-blue-500" />
            </label>
            <button
              type="button"
              onClick={handleStartTimer}
              disabled={startingTimer || !projectId}
              aria-keyshortcuts="Alt+S"
              className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {startingTimer ? "Starting..." : "Start"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="mt-2 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{activeTimer.status === "paused" ? "Paused" : "Running"}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                [{projects.find((project) => project.id === activeTimer.project_id)?.project_code}] {projects.find((project) => project.id === activeTimer.project_id)?.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{activeTimer.description || "No description"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-2 font-mono text-3xl font-bold tracking-tight text-[#153e90]">{formatTimer(elapsedSeconds)}</p>
            {activeTimer.status === "running" ? (
              <button onClick={pauseTimer} aria-keyshortcuts="Alt+P" className="rounded-xl border border-slate-300 px-5 py-3 font-bold">Pause</button>
            ) : (
              <button onClick={resumeTimer} aria-keyshortcuts="Alt+P" className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white">Resume</button>
            )}
            <button
  type="button"
  onClick={stopTimer}
  disabled={stoppingTimerIds.has(activeTimer.id)}
  aria-keyshortcuts="Alt+X"
  className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
>
  {stoppingTimerIds.has(activeTimer.id)
    ? "Stopping..."
    : "Stop"}
</button>
          </div>
        </div>
      )}
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {([
        { label: "Today’s Hours", value: formatDecimalHours(summary.today), note: "Recorded today", icon: "clock", accent: "from-[#153E90] to-cyan-400", surface: "from-white via-white to-blue-50/80", badge: "border-blue-100 bg-blue-50 text-[#153E90]", valueTone: "text-[#153E90]" },
        { label: "This Week’s Hours", value: formatDecimalHours(summary.week), note: "Recorded this week", icon: "calendar", accent: "from-emerald-600 to-teal-300", surface: "from-white via-white to-emerald-50/80", badge: "border-emerald-100 bg-emerald-50 text-emerald-700", valueTone: "text-emerald-700" },
        { label: "Running Timers", value: String(summary.running), note: "Live right now", icon: "monitor", accent: "from-cyan-600 to-sky-300", surface: "from-white via-white to-cyan-50/80", badge: "border-cyan-100 bg-cyan-50 text-cyan-700", valueTone: "text-cyan-700" },
        { label: "Projects Worked", value: String(summary.projects), note: "Worked this week", icon: "folder", accent: "from-violet-600 to-fuchsia-300", surface: "from-white via-white to-violet-50/75", badge: "border-violet-100 bg-violet-50 text-violet-700", valueTone: "text-violet-700" },
      ] as Array<{ label: string; value: string; note: string; icon: TimeOffIconName; accent: string; surface: string; badge: string; valueTone: string }>).map((card) => (
        <article key={card.label} className={`relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br ${card.surface} p-5 shadow-lg shadow-slate-200/55`}>
          <span aria-hidden="true" className={`absolute inset-x-5 top-0 h-1 rounded-b-full bg-gradient-to-r ${card.accent}`} />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">{card.label}</p><p className={`mt-4 text-3xl font-bold tracking-tight ${card.valueTone}`}>{card.value}</p></div>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${card.badge}`}><TimeOffIcon name={card.icon} className="h-5 w-5" /></span>
          </div>
          <div className="mt-5 border-t border-slate-200/70 pt-3"><p className="text-xs font-semibold text-slate-500">{card.note}</p></div>
        </article>
      ))}
    </section>

    {profile?.role !== "Employee" && (

    <section className="mt-7">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          &nbsp;
          <h2 className="text-xl font-bold text-[#153E90]">Live Operations</h2>
          &nbsp;
        </div>
        <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
          <span>{visibleLiveTimers.length} {visibleLiveTimers.length === 1 ? "Timer" : "Timers"}</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-600">● {runningLiveTimerCount} Running</span>
        </div>
      </div>
      {visibleLiveTimers.length > 0 ? (
        <div>
          <div className="hidden grid-cols-[1.45fr_0.9fr_1.2fr_1.2fr_0.85fr_1fr_0.8fr_1.15fr] gap-4 px-5 pb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-700 xl:grid">
            <span className="text-left pl-6">Employee</span><span className="text-left pl-3">Client</span><span className="text-left pl-6">Project</span><span>Description</span><span>Started</span><span>Duration</span><span>Status</span>
          </div>
          <div className="space-y-3">
            {visibleLiveTimers.map((timer) => {
              const isRunning = timer.status === "running";
              return (
                <article key={timer.id} className={"grid gap-4 rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition hover:shadow-md xl:min-h-[116px] xl:grid-cols-[1.45fr_0.9fr_1.2fr_1.2fr_0.85fr_1fr_0.8fr_1.15fr] xl:items-center " + (isRunning ? "border-l-emerald-400" : "border-l-amber-400")}>
                  <div className="flex items-center gap-3">
                    <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold " + (isRunning ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{getInitials(timer.employees?.name || "")}</div>
                    <p className="min-w-0 truncate font-bold text-slate-950">{timer.employees?.name || "Unknown employee"}</p>
                  </div>
                  <div><p className="font-semibold text-slate-900">{timer.projects?.clients?.name || "—"}</p></div>
                  <div className="flex items-center gap-2 min-w-0">

  <span className="shrink-0 text-sm font-bold text-[#153E90]">

    [{timer.projects?.project_code || "—"}]

  </span>

  <span className="truncate font-semibold text-slate-900">

    {timer.projects?.name || "—"}

  </span>

</div>
                  <p className="font-semibold text-slate-900">{timer.description || <span className="text-slate-400">No description</span>}</p>
                  <div><p className="font-semibold text-slate-900">{formatTime(timer.started_at)}</p></div>
                  <p className={"font-mono text-xl font-bold tracking-tight " + (isRunning ? "text-emerald-600" : "text-amber-600")}>{formatTimer(calculateElapsed(timer) + tick * 0)}</p>
                  <span className={"w-fit rounded-full px-3 py-1.5 text-xs font-bold ring-1 " + (isRunning ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-700 ring-amber-200")}>● {isRunning ? "Running" : "Paused"}</span>
                  <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                    <button onClick={() => { if (profile?.role === "Employee") { if (isRunning) void pauseTimer(); else void resumeTimer(); } else { void toggleTeamTimer(timer); } }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50">{isRunning ? "Pause" : "Resume"}</button> &nbsp;
                    <button
  type="button"
  disabled={stoppingTimerIds.has(timer.id)}
  onClick={() => {
    if (profile?.role === "Employee") {
      void stopTimer();
    } else {
      void adminStopTimer(timer);
    }
  }}
  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {stoppingTimerIds.has(timer.id)
    ? "Stopping..."
    : "Stop"}
</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">No active timers right now.</div>
      )}
    </section>

    )}
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between lg:hidden">
        <p className="font-bold text-slate-950">Filters</p>
        <button onClick={() => setShowMobileFilters(!showMobileFilters)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">{showMobileFilters ? "Hide" : "Show"}</button>
      </div>
      <div className={(showMobileFilters ? "mt-4 grid" : "hidden") + " gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-5"}>
        {canFilterTeamEntries && (
          <select
  value={filterEmployee}
  onChange={(event) => {
    setFilterEmployee(event.target.value);
    setFilterClient("");
    setFilterProject("");
    setEntryPage(0);
  }}
  className="rounded-xl border border-slate-500 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-500"
>
  <option value="">Select Employee</option>
  {employees.map((employee) => (
    <option key={employee.id} value={employee.id}>
      {employee.name}
    </option>
  ))}
</select>
        )}
        <select value={filterDateRange} onChange={(event) => setFilterDateRange(event.target.value)} className="rounded-xl border border-slate-500 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-500">
          <option value="">Select Date Range</option>
          <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="this_week">This Week</option><option value="last_week">Last Week</option><option value="this_month">This Month</option><option value="last_month">Last Month</option><option value="custom">Custom Range</option>
        </select>
        <select
  value={filterClient}
  disabled={!entryFilterEmployeeId}
  onChange={(event) => {
    setFilterClient(event.target.value);
    setFilterProject("");
  }}
  className="rounded-xl border border-slate-500 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
>
  <option value="">
    {entryFilterEmployeeId ? "Select Client" : "Select Employee First"}
  </option>

  {selectedEmployeeClients.map((client) => (
    <option key={client} value={client}>
      {client}
    </option>
  ))}
</select>
        <select
  value={filterProject}
  disabled={!entryFilterEmployeeId || !filterClient}
  onChange={(event) => setFilterProject(event.target.value)}
  className="rounded-xl border border-slate-500 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
>
  <option value="">
    {!entryFilterEmployeeId
      ? "Select Employee First"
      : !filterClient
        ? "Select Client First"
        : "Select Project"}
  </option>

  {selectedEmployeeFilteredProjects.map((project) => (
    <option key={project.id} value={project.id}>
      [{project.project_code || "—"}] {project.name}
    </option>
  ))}
</select>
        <input data-shortcut-search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, client, project…" className="rounded-xl border border-slate-500 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500" />
      </div>
      {filterDateRange === "custom" && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:w-1/3">
          <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => void searchTimeEntries()}
          disabled={loadingEntries}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingEntries ? "Searching..." : "Search"}
        </button>
        <button onClick={resetFilters} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Reset Filters</button>
      </div>
      {entrySearchError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
          {entrySearchError}
        </p>
      ) : null}
    </section>

    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-xl font-bold text-slate-950">Time Entries</h2>
        <p className="mt-1 text-sm text-slate-500">Completed entries grouped by date.</p>
      </div>
      {loadingEntries ? (
  <div className="px-6 py-16 text-center">
    <h3 className="font-bold text-slate-950">
      Searching...
    </h3>
  </div>
) : !hasSearchedEntries ? (
        <div className="px-6 py-16 text-center"><h3 className="font-bold text-slate-950">Select filters and click Search.</h3></div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-16 text-center"><h3 className="font-bold text-slate-950">No time entries match your filters.</h3><button onClick={resetFilters} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">Clear Filters</button></div>
      ) : (
        Object.entries(groupedEntries).map(([date, dateEntries]) => {
          const expanded = !collapsedDates.has(date);
          const totalHours = dateEntries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
          return (
            <div key={date} className="border-b border-slate-100 last:border-0">
              <button onClick={() => setCollapsedDates((current) => { const next = new Set(current); if (expanded) next.add(date); else next.delete(date); return next; })} className="flex w-full items-center justify-between bg-slate-50/80 px-5 py-3 text-left hover:bg-slate-100">
                <span className="font-bold text-slate-900">{expanded ? "⌄" : "›"} <span className="ml-2">{formatDate(date)}</span></span>
                <span className="text-sm font-bold text-[#153e90]">{formatDecimalHours(totalHours)} Hours</span>
              </button>
              {expanded && (
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full min-w-[1050px]">
                    <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-wide text-white">
                      <tr><th className="px-5 py-3 text-left">Employee</th><th className="px-5 py-3 text-left">Client</th><th className="px-5 py-3 text-left">Project</th><th className="px-5 py-3 text-left">Description</th><th className="px-5 py-3 text-center">Start</th><th className="px-5 py-3 text-center">End</th><th className="px-5 py-3 text-right">Hours</th><th className="px-5 py-3 text-center">Actions</th></tr>
                    </thead>
                    <tbody>
                      {dateEntries.map((entry, index) => (
                        <tr key={entry.id} data-shortcut-row className={"border-b border-slate-100 last:border-0 " + (index % 2 ? "bg-slate-50/60" : "bg-white")}>
                          <td className="px-5 py-4 font-semibold">{entry.employees?.name}</td>
                          <td className="px-5 py-4 text-slate-600">{entry.projects?.clients?.name || "—"}</td>
                          <td className="px-5 py-4"><p className="font-semibold">{entry.projects?.name}</p><p className="text-xs text-blue-700">{entry.projects?.project_code}</p></td>
                          <td className="max-w-xs px-5 py-4 text-sm text-slate-600">{entry.description || "—"}</td>
                          <td className="px-5 py-4 text-center text-sm">{formatTime(entry.started_at)}</td>
                          <td className="px-5 py-4 text-center text-sm">{formatTime(entry.stopped_at)}</td>
                          <td className="px-5 py-4 text-right font-bold">{formatDecimalHours(entry.hours)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                data-shortcut-open
                                onClick={() => setViewingEntry(entry)}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-100"
                              >
                                View
                              </button>
                              {canEditTimeEntries && (
                                <>
                                  <button
                                    data-shortcut-edit
                                    onClick={() => beginEdit(entry)}
                                    className="rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-xs font-bold text-[#153E90] shadow-sm transition hover:border-blue-300 hover:bg-blue-100"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteTimeEntry(entry)}
                                    className="rounded-full border border-red-200 bg-red-50 px-3.5 py-1.5 text-xs font-bold text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-100"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Showing {entries.length ? entryPage * PAGE_SIZE + 1 : 0}–{Math.min((entryPage + 1) * PAGE_SIZE, entries.length)} of {entries.length.toLocaleString()} entries</p>
        <nav aria-label="Time entry pagination" className="flex flex-wrap gap-2">
          <button disabled={entryPage === 0} onClick={() => setEntryPage((page) => Math.max(0, page - 1))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:opacity-40">Previous</button>
          {visibleEntryPages.map((page) => (
            <button
              key={page}
              type="button"
              aria-current={page === entryPage ? "page" : undefined}
              onClick={() => setEntryPage(page)}
              className={`min-w-10 rounded-xl px-3 py-2 text-sm font-bold ${page === entryPage ? "bg-[#153E90] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {page + 1}
            </button>
          ))}
          <button disabled={entryPage + 1 >= totalEntryPages} onClick={() => setEntryPage((page) => Math.min(totalEntryPages - 1, page + 1))} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next</button>
        </nav>
      </div>
    </section>

    {viewingEntry && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={() => setViewingEntry(null)}>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Time Entry</h2><button onClick={() => setViewingEntry(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-slate-400">Employee</dt><dd className="mt-1 font-bold">{viewingEntry.employees?.name}</dd></div><div><dt className="text-slate-400">Date</dt><dd className="mt-1 font-bold">{formatDate(viewingEntry.entry_date)}</dd></div><div><dt className="text-slate-400">Client</dt><dd className="mt-1 font-bold">{viewingEntry.projects?.clients?.name}</dd></div><div><dt className="text-slate-400">Project</dt><dd className="mt-1 font-bold">{viewingEntry.projects?.name}</dd></div><div><dt className="text-slate-400">Time</dt><dd className="mt-1 font-bold">{formatTime(viewingEntry.started_at)} – {formatTime(viewingEntry.stopped_at)}</dd></div><div><dt className="text-slate-400">Hours</dt><dd className="mt-1 font-bold">{formatDecimalHours(viewingEntry.hours)}</dd></div><div className="col-span-2"><dt className="text-slate-400">Description</dt><dd className="mt-1 font-medium">{viewingEntry.description || "—"}</dd></div></dl>
        </div>
      </div>
    )}

{/* MANUAL TIME ENTRY MODAL */}

{showManualEntry && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-950">Add Time Entry</h2>

      <div className="mt-6 space-y-4">
        {["Finance Admin", "Super Admin", "Admin"].includes(profile?.role || "") ? (
          <div>
            <label className="text-sm font-semibold text-slate-500">
              Employee
            </label>

            <select
              value={manualEmployeeId}
              onChange={(e) => {
                setManualEmployeeId(e.target.value);
                setManualClient("");
                setManualProjectId("");
              }}
              className="mt-2 w-full rounded-2xl border px-5 py-3"
            >
              <option value="">Select Employee</option>

              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-sm font-semibold text-slate-500">
              Employee
            </label>

            <div className="mt-2 rounded-2xl bg-slate-50 px-5 py-3 font-bold">
              {getLoggedInEmployeeName()}
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-semibold text-slate-500">
            Client
          </label>

          <select
            value={manualClient}
            disabled={!manualEmployeeId}
            onChange={(e) => {
              setManualClient(e.target.value);
              setManualProjectId("");
            }}
            className="mt-2 w-full rounded-2xl border px-5 py-3 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select Client</option>
            {manualClients.map((client) => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-500">
            Project
          </label>

          <select
            value={manualProjectId}
            disabled={!manualClient}
            onChange={(e) => setManualProjectId(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-5 py-3 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Select Project</option>

            {manualProjects.map((project) => (
              <option key={project.id} value={project.id}>
                [{project.project_code}] {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-500">Date</label>

          <input
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-5 py-3"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-500">
              Start Time
            </label>

            <input
              type="time"
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-5 py-3"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-500">
              Stop Time
            </label>

            <input
              type="time"
              value={manualStop}
              onChange={(e) => setManualStop(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-5 py-3"
            />

            {manualStart && manualStop && manualStop < manualStart && (
              <p className="mt-2 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                🌙 Next Day
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-5 py-3">

  <p className="text-sm font-semibold text-slate-500">
    Calculated Hours
  </p>


  <p className="mt-1 text-xl font-bold text-slate-950">

    {manualStart && manualStop

  ? (() => {

      const startDate =

        buildLocalDateTime(

          manualDate,

          manualStart

        );

      const stopDate =

        buildLocalDateTime(

          manualDate,

          manualStop

        );

      if (stopDate <= startDate) {

        stopDate.setDate(

          stopDate.getDate() + 1

        );

      }

      return (

        (

          (

            stopDate.getTime() -

            startDate.getTime()

          ) / 3600000

        ).toFixed(2)

      );

    })()

  : "0.00"}

  </p>

</div>

        <div>
          <label className="text-sm font-semibold text-slate-500">
            Description
          </label>

          <textarea
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            className="mt-2 h-24 w-full rounded-2xl border px-5 py-3"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => setShowManualEntry(false)}
          className="rounded-xl border px-6 py-3 font-bold"
        >
          Cancel
        </button>

        <button

  type="button"
  data-shortcut-primary
  data-shortcut-save
  aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"

  disabled={isSavingManual}

  onClick={saveManualEntry}

  className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50"

>

  {isSavingManual ? "Saving..." : "Save Entry"}

</button>
      </div>
    </div>
  </div>
)}

{/* EDIT TIME ENTRY MODAL */}

{editingEntry && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-950">Edit Time Entry</h2>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-500">
            Employee
          </label>

          <div className="mt-2 rounded-2xl bg-slate-50 px-5 py-3 font-bold">
            {editingEntry.employees?.name}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-500">
            Project
          </label>

          <select
            value={editProjectId}
            onChange={(e) => setEditProjectId(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-5 py-3"
          >
            <option value="">Select Project</option>

            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                [{project.project_code}] {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-500">Date</label>

          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="mt-2 w-full rounded-2xl border px-5 py-3"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-500">
              Start Time
            </label>

            <input
              type="time"
              value={editStart}
              onChange={(e) => setEditStart(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-5 py-3"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-500">
              Stop Time
            </label>

            <input
              type="time"
              value={editStop}
              onChange={(e) => setEditStop(e.target.value)}
              className="mt-2 w-full rounded-2xl border px-5 py-3"
            />

            {editStart && editStop && editStop < editStart && (
              <p className="mt-2 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                🌙 Next Day
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-5 py-3">
          <p className="text-sm font-semibold text-slate-500">
            Calculated Hours
          </p>

          <p className="mt-1 text-xl font-bold text-slate-950">
            {editStart && editStop
              ? (() => {
                  const startDate = new Date(`${editDate}T${editStart}`);
                  const stopDate = new Date(`${editDate}T${editStop}`);

                  if (stopDate <= startDate) {
                    stopDate.setDate(stopDate.getDate() + 1);
                  }
                  

                  return (
                    (
                      (stopDate.getTime() - startDate.getTime()) /
                      3600000
                    ).toFixed(2)
                  );
                })()
              : "0.00"}
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-500">
            Description
          </label>

          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            className="mt-2 h-24 w-full rounded-2xl border px-5 py-3"
          />
        </div>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button
          onClick={() => setEditingEntry(null)}
          className="rounded-xl border px-6 py-3 font-bold"
        >
          Cancel
        </button>

        <button

  type="button"
  data-shortcut-primary
  data-shortcut-save
  aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"

  disabled={isSavingEdit}

  onClick={saveEditedEntry}

  className="rounded-xl bg-slate-950 px-6 py-3 font-bold text-white disabled:opacity-50"

>

  {isSavingEdit ? "Saving..." : "Save Changes"}

</button>
      </div>
    </div>
  </div>
)}

</div>


</main>


);


}
