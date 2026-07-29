"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatDecimalHours } from "@/lib/format-hours";
import { businessDateKey } from "@/lib/metrics/date-ranges";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";


type TeamMember = {
  id: string;
  name: string;
  employee_code: string | null;
};


type Resource = {
  id: string;
  employee_id: string;

  employees: TeamMember | null;
};


type ProjectNote = {
  id: string;
  note: string;
  created_at: string;
};


type Project = {

  id: string;

  name: string;

  project_code: string | null;

  start_date: string | null;

  description: string | null;

  purchased_hours: number;

  used_hours: number;

  remaining_hours: number;

  status: string;
  is_billable: boolean;


  clients: {

    id: string;

    name: string;

  } | null;


  project_resources: Resource[];


  time_entries: {

    id: string;

    entry_date: string;

    hours: number;

    description: string | null;


    employees: {

      name: string;

    } | null;

  }[];

};




function ProjectDetailPageContent() {


const params =
useParams();


const router =
useRouter();


const searchParams =
useSearchParams();



const action =
searchParams.get("action");


const projectId =
params.id as string;



const [project,setProject] =
useState<Project | null>(null);


const [team,setTeam] =
useState<TeamMember[]>([]);


const [notes,setNotes] =
useState<ProjectNote[]>([]);
const [upcomingLeave, setUpcomingLeave] = useState<Record<string, { start_date: string; end_date: string }>>({});

const [notesText, setNotesText] = useState("");
const [role, setRole] = useState("");
const [accessChecked, setAccessChecked] = useState(false);
const canAdministerProject = [
  "Finance Admin",
  "Super Admin",
  "Admin",
].includes(role);



const [projectCode,setProjectCode] =
useState("");


const [projectName,setProjectName] =
useState("");


const [startDate,setStartDate] =
useState("");

const [isBillable,setIsBillable] =
useState(true);





const [extraHours,setExtraHours] =
useState("");


const [resource,setResource] =
useState("");




function formatDate(date:string){

if(!date) return "";


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

function todayFormatted(){

return new Date()
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






async function loadProject(){


const {data} =
await supabase

.from("projects")

.select(`

*,

clients(
id,
name
),

project_resources(
id,
employee_id,
employees(
id,
name,
employee_code
)
),

time_entries(
id,
entry_date,
hours,
description,
employees(
name
)
)

`)

.eq(
"id",
projectId
)

.single();




if(data){

setProject(
data as Project
);

const employeeIds = (data.project_resources || []).map((item: Resource) => item.employee_id);
if (employeeIds.length) {
  const leaveResult = await supabase
    .from("leave_requests")
    .select("employee_id,start_date,end_date")
    .in("employee_id", employeeIds)
    .in("status", ["approved", "cancellation_rejected"])
    .gte("end_date", businessDateKey())
    .order("start_date");
  const nextByEmployee: Record<string, { start_date: string; end_date: string }> = {};
  for (const leave of leaveResult.data || []) {
    if (!nextByEmployee[leave.employee_id]) nextByEmployee[leave.employee_id] = leave;
  }
  setUpcomingLeave(nextByEmployee);
} else setUpcomingLeave({});


setProjectCode(
data.project_code || ""
);


setProjectName(
data.name
);


setStartDate(
data.start_date || ""
);

setIsBillable(data.is_billable !== false);






}





const {data:noteData} =
await supabase

.from("project_notes")

.select(
"id,note,created_at"
)

.eq(
"project_id",
projectId
)

.order(
"created_at",
{
ascending:false,
}
);



if (noteData) {
  setNotes(noteData as ProjectNote[]);

  setNotesText(
    noteData
      .map((item) => item.note)
      .join("\n\n")
  );
}




}






async function loadTeam(){


const {data} =
await supabase

.from("employees")

.select(
"id,name,employee_code"
)

.eq(
"status",
"active"
)

.order(
"name"
);



if(data){

setTeam(
data as TeamMember[]
);

}


}







async function saveProject() {
  if (!project || !canAdministerProject) return;

  const purchased = project.purchased_hours || 0;

  await supabase
    .from("projects")
    .update({
      project_code: projectCode,
      name: projectName,
      start_date: startDate || null,
      is_billable: isBillable,
      purchased_hours: purchased,
      remaining_hours: purchased - project.used_hours,
    })
    .eq("id", project.id);

  await supabase
    .from("project_notes")
    .delete()
    .eq("project_id", project.id);

  const noteRows = notesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((note) => ({
      project_id: project.id,
      note,
    }));

  if (noteRows.length) {
    await supabase
      .from("project_notes")
      .insert(noteRows);
  }

  router.push("/projects");
}






async function addHours() {
  if (!project || !canAdministerProject) return;

  const hours = Number(extraHours || 0);

  if (!hours || hours <= 0) {
    alert("Please enter valid hours.");
    return;
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error: transactionError } = await supabase
    .from("project_hour_transactions")
    .insert({
      project_id: project.id,
      transaction_type: "manual_credit",
      hours_delta: Number(hours.toFixed(2)),
      notes: `${todayFormatted()} - ${hours.toFixed(2)} hours purchased`,
      created_by: userData.user?.id || null,
    });

  if (transactionError) {
    alert(transactionError.message);
    console.error("Wallet adjustment error:", transactionError);
    return;
  }

  const { error: noteError } = await supabase
    .from("project_notes")
    .insert({
      project_id: project.id,
      note: `${todayFormatted()} - ${hours.toFixed(2)} hours purchased`,
    });

  if (noteError) {
    console.error("Project note error:", noteError);
  }

  setExtraHours("");

  router.push(`/projects/${project.id}/wallet`);
}
async function addResource(){

if(!resource || !canAdministerProject) return;


await supabase

.from("project_resources")

.insert({

project_id:
projectId,


employee_id:
resource,

});


setResource("");

loadProject();

}





async function removeResource(id:string){

if (!canAdministerProject) return;

await supabase

.from("project_resources")

.delete()

.eq(
"id",
id
);



loadProject();


}






async function archiveProject(){

if (!canAdministerProject) return;

await supabase

.from("projects")

.update({

status:"archived",

})

.eq(
"id",
projectId
);



router.push(
"/projects"
);


}






async function unarchiveProject(){

if (!canAdministerProject) return;

await supabase

.from("projects")

.update({

status:"active",

})

.eq(
"id",
projectId
);



router.push(
"/projects"
);


}







useEffect(()=>{

async function loadAuthorizedProject() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    router.replace("/login");
    return;
  }
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .single();
  const currentRole = String(profileData?.role || "");
  if (currentRole === "Manager") {
    router.replace(`/projects/${projectId}/wallet`);
    return;
  }
  if (
    !["Finance Admin", "Super Admin", "Admin"].includes(currentRole)
  ) {
    router.replace("/projects");
    return;
  }
  setRole(currentRole);
  setAccessChecked(true);
  await Promise.all([loadProject(), loadTeam()]);
}

void loadAuthorizedProject();

// eslint-disable-next-line react-hooks/exhaustive-deps
},[]);




if(!accessChecked || !project) return null;




return (

<main className="min-h-screen bg-[#f8fafc] px-8 py-7">


<div className="mx-auto max-w-5xl">


<Link

href="/projects"

className="mb-6 text-sm font-semibold text-slate-500 transition hover:-translate-x-0.5 hover:text-[#153E90]"

>

← Back to Projects

</Link>





<div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">

<div className="relative -m-8 mb-0 overflow-hidden bg-[#0F172A] p-8 text-white">
<div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#153E90]/60 blur-3xl" />
<div className="relative">


<p className="text-sm font-semibold text-blue-200">

Project Code: {project.project_code}

</p>



<h1 className="mt-2 text-4xl font-bold tracking-tight">

{project.name}

</h1>

<span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${project.is_billable ? "bg-blue-100 text-blue-800" : "bg-violet-100 text-violet-800"}`}>
  {project.is_billable ? "Billable" : "Non-billable"}
</span>



{project.clients && (

<Link

href={`/clients/${project.clients.id}`}

className="mt-3 text-sm font-semibold text-slate-300 underline decoration-blue-400 underline-offset-4 hover:text-white"

>

Client: {project.clients.name}

</Link>

)}

</div>
</div>






{!action && (

<div className="mt-8 space-y-6">


<div className="grid gap-4 sm:grid-cols-3">


<div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">

<p className="text-sm text-slate-500">
Purchased
</p>

<p className="text-2xl font-bold">

{formatDecimalHours(project.purchased_hours)}

</p>

</div>




<div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">

<p className="text-sm text-slate-500">
Used
</p>

<p className="text-2xl font-bold">

{formatDecimalHours(project.used_hours)}

</p>

</div>





<div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">

<p className="text-sm text-slate-500">
Remaining
</p>

<p className="text-2xl font-bold">

{formatDecimalHours(project.remaining_hours)}

</p>

</div>


</div>





<div className="rounded-2xl bg-slate-50 p-5">


<p className="text-sm font-semibold text-slate-600">

Project Start Date:

{" "}

{formatDate(
project.start_date || ""
)}

</p>


</div>






<div className="rounded-2xl bg-slate-50 p-5">


<p className="text-sm font-semibold text-slate-600">

Assigned Team

</p>



<div className="mt-3 flex flex-wrap gap-2">


{project.project_resources.length ? (

project.project_resources.map((r)=>(


<span

key={r.id}

className="rounded-full bg-white px-4 py-2 text-sm font-semibold"

>

{r.employees?.name}

{upcomingLeave[r.employee_id] ? (
  <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
    Leave {formatDate(upcomingLeave[r.employee_id].start_date)}
  </span>
) : null}

</span>


))


) : (

<p className="text-sm text-slate-500">

No team assigned.

</p>

)}


</div>


</div>








<div className="rounded-2xl bg-slate-50 p-5">


<p className="text-sm font-semibold text-slate-600">

Activity / Notes

</p>



<div className="mt-3 space-y-3">


{notes.length ? (

notes.map((item)=>(


<div

key={item.id}

className="rounded-xl bg-white p-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"

>

{item.note}

</div>


))


) : (

<p className="text-sm text-slate-500">

No activity yet.

</p>

)}


</div>


</div>





</div>

)}

{action === "edit" && (
  <div className="mt-8 space-y-5">
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">
        Project Code
      </label>
      <input
        value={projectCode}
        onChange={(e) => setProjectCode(e.target.value)}
        className="w-full rounded-2xl border px-5 py-3"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">
        Project Name
      </label>
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="w-full rounded-2xl border px-5 py-3"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">
        Project Start Date
      </label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="w-full rounded-2xl border px-5 py-3"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-600">
        Billing Type
      </label>
      <select
        value={isBillable ? "billable" : "non_billable"}
        onChange={(event) => setIsBillable(event.target.value === "billable")}
        className="w-full rounded-2xl border px-5 py-3"
      >
        <option value="billable">Billable</option>
        <option value="non_billable">Non-billable</option>
      </select>
    </div>

    <div>
  <label className="text-sm font-semibold text-slate-700">
    Purchased Hours
  </label>

  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <p className="text-lg font-bold text-slate-900">
      {formatDecimalHours(project.purchased_hours)} hrs
    </p>

    <p className="mt-1 text-sm text-slate-500">
      Hours are added automatically when client payments are received.
    </p>
  </div>
</div>

    <div>

  <label className="mb-2 block text-sm font-semibold text-slate-600">

    Activity / Notes

  </label>


  <textarea

    value={notesText}

    onChange={(e) =>
      setNotesText(e.target.value)
    }

    className="h-40 w-full rounded-2xl border px-5 py-3"

  />

</div>

    <div className="flex gap-3">
      <button
        type="button"
        data-shortcut-save
        data-shortcut-primary
        aria-keyshortcuts="Control+S Meta+S Control+Enter Meta+Enter"
        onClick={saveProject}
        className="rounded-2xl bg-slate-950 px-6 py-3 text-white"
      >
        Save
      </button>

      <button
        onClick={() => router.push("/projects")}
        className="rounded-2xl border px-6"
      >
        Cancel
      </button>
    </div>
  </div>
)}






{action==="hours" && (

<div className="mt-8 space-y-5">


<input

  type="number"

  value={extraHours}

  onChange={(e)=>
    setExtraHours(e.target.value)
  }

  placeholder="Hours to credit"

  className="w-full rounded-2xl border px-5 py-3"

/>



<div className="flex gap-3">


<button

  onClick={addHours}

  className="rounded-2xl bg-slate-950 px-6 py-3 text-white"

>

  Manual Hour Adjustment

</button>



<button

  onClick={() =>
    router.push("/projects")
  }

  className="rounded-2xl border px-6 py-3 font-semibold"

>

  Cancel

</button>


</div>


</div>

)}

{action==="team" && (

<div className="mt-8 space-y-6">


  <div className="rounded-2xl bg-slate-50 p-5">

    <p className="text-sm font-semibold text-slate-600">

      Assigned Team

    </p>


    <div className="mt-4 flex flex-wrap gap-3">


      {project.project_resources.length ? (

        project.project_resources.map((r)=>(


          <span

            key={r.id}

            className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-slate-200"

          >

            {r.employees?.name}

            {upcomingLeave[r.employee_id] ? (
              <span className="ml-2 text-[10px] font-bold text-amber-700">
                Leave {formatDate(upcomingLeave[r.employee_id].start_date)}
              </span>
            ) : null}


            <button

              onClick={() =>
                removeResource(r.id)
              }

              className="ml-3 font-bold text-red-500"

            >

              ×

            </button>


          </span>


        ))

      ) : (

        <p className="text-sm text-slate-500">

          No team assigned.

        </p>

      )}


    </div>


  </div>





  <div>


    <label className="mb-2 block text-sm font-semibold text-slate-600">

      Add Team Member

    </label>


    <div className="flex gap-3">


      <select

        value={resource}

        onChange={(e)=>
          setResource(e.target.value)
        }

        className="flex-1 rounded-2xl border px-5 py-3"

      >

        <option value="">

          Select employee

        </option>


        {team

          .filter(

            (member)=>

              !project.project_resources.some(

                (r)=>

                  r.employee_id === member.id

              )

          )

          .map((member)=>(


            <option

              key={member.id}

              value={member.id}

            >

              {member.name}

            </option>


          ))}


      </select>




      <button

        onClick={addResource}

        className="rounded-2xl bg-slate-950 px-6 py-3 text-white"

      >

        Add

      </button>



      <Link

        href="/projects"

        className="rounded-2xl border px-6 py-3"

      >

        Back

      </Link>


    </div>


  </div>


</div>

)}

{action === "archive" && (
  <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
    <h2 className="text-lg font-bold text-slate-950">Deactivate project?</h2>
    <p className="mt-2 text-sm text-slate-600">
      The project and its existing time and wallet history will remain available
      under Archived projects.
    </p>
    <div className="mt-5 flex gap-3">
      <button
        type="button"
        onClick={archiveProject}
        className="rounded-xl bg-amber-600 px-5 py-2.5 font-bold text-white"
      >
        Deactivate
      </button>
      <button
        type="button"
        onClick={() => router.push("/projects")}
        className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700"
      >
        Cancel
      </button>
    </div>
  </div>
)}

{action === "unarchive" && (
  <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
    <h2 className="text-lg font-bold text-slate-950">Activate project?</h2>
    <p className="mt-2 text-sm text-slate-600">
      The project will return to the Active projects view with its existing
      team, time, and wallet history intact.
    </p>
    <div className="mt-5 flex gap-3">
      <button
        type="button"
        onClick={unarchiveProject}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white"
      >
        Activate
      </button>
      <button
        type="button"
        onClick={() => router.push("/projects")}
        className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700"
      >
        Cancel
      </button>
    </div>
  </div>
)}








</div>


</div>


</main>

);


}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDetailPageContent />
    </Suspense>
  );
}
