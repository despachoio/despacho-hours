"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";


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



export default function TimePage() {


  const [profile, setProfile] =
    useState<Profile | null>(null);


  const [employees, setEmployees] =
    useState<Employee[]>([]);


  const [projects, setProjects] =
    useState<Project[]>([]);


  const [entries, setEntries] =
    useState<TimeEntry[]>([]);



  const [employeeId, setEmployeeId] =
    useState("");


  const [projectId, setProjectId] =
    useState("");


  const [description, setDescription] =
    useState("");



  const [activeTimer, setActiveTimer] =
    useState<ActiveTimer | null>(null);


  const [liveTimers, setLiveTimers] =
    useState<LiveTimer[]>([]);


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

const start =
new Date(timer.started_at).getTime();


const end =
timer.status==="paused" &&
timer.paused_at

?

new Date(timer.paused_at).getTime()

:

Date.now();


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


let entryQuery =
supabase

.from("time_entries")

.select(`
id,
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

.order("entry_date", {

  ascending: false,

})

.order("stopped_at", {

  ascending: false,

});



if(
currentProfile?.role==="Employee" &&
currentProfile.employee_id
){

entryQuery =
entryQuery.eq(
"employee_id",
currentProfile.employee_id
);

}



const {data:entryData} =
await entryQuery;


if(entryData)

setEntries(
entryData as unknown as TimeEntry[]
);



// Own active timer


let timerData=null;


if(currentProfile?.employee_id){


const {data} =
await supabase

.from("active_timers")

.select("*")

.eq(
"employee_id",
currentProfile.employee_id
)

.maybeSingle();


timerData=data;

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

    setProjectId("");

    setDescription("");

  }

}



// Admin / Manager Live timers


if(
currentProfile?.role==="Admin" ||
currentProfile?.role==="Manager"
){


const {data:liveData} =
await supabase

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


if(liveData)

setLiveTimers(
liveData as unknown as LiveTimer[]
);


}else{

setLiveTimers([]);

}


}
async function startTimer() {

  if (!employeeId || !projectId) {

    alert("Please select project.");

    return;

  }


  const { error } =
    await supabase
      .from("active_timers")
      .insert({

        employee_id: employeeId,

        project_id: projectId,

        description:
          description || null,

        status: "running",

      });


  if (error) {

    alert(error.message);

    return;

  }


  loadData();

}




async function pauseTimer() {


  if (!activeTimer) return;



  const { error } =
    await supabase

      .from("active_timers")

      .update({

        status: "paused",

        paused_at:
          new Date()
          .toISOString(),

      })

      .eq(
        "id",
        activeTimer.id
      );



  if(error){

    alert(error.message);

    return;

  }



  loadData();

}




async function resumeTimer(){


if(
!activeTimer ||
!activeTimer.paused_at
)

return;



const pausedSeconds =
Math.floor(

(
Date.now() -
new Date(
activeTimer.paused_at
).getTime()

)

/1000

);



const {error} =
await supabase

.from("active_timers")

.update({

status:"running",

paused_at:null,

total_paused_seconds:

Number(
activeTimer.total_paused_seconds || 0
)

+

pausedSeconds,


})

.eq(
"id",
activeTimer.id
);



if(error){

alert(error.message);

return;

}



loadData();


}




async function stopTimer(){


if(!activeTimer) return;



const workedSeconds =
calculateElapsed(activeTimer);



const workedHours =
Number(
(workedSeconds/3600)
.toFixed(2)
);



if(workedHours<=0){

alert(
"Timer is too short to save."
);

return;

}



const selectedProject =
projects.find(

(p)=>

p.id===activeTimer.project_id

);



if(!selectedProject){

alert("Project not found.");

return;

}



const stoppedAt =
new Date().toISOString();



const {error:insertError} =
await supabase

.from("time_entries")

.insert({

employee_id:
activeTimer.employee_id,


project_id:
activeTimer.project_id,


entry_date:
stoppedAt.slice(0,10),


started_at:
activeTimer.started_at,


stopped_at:
stoppedAt,


hours:
workedHours,


description:

activeTimer.description ||
description ||
null,


});



if(insertError){

alert(insertError.message);

return;

}




await recalculateProjectHours(activeTimer.project_id);




await supabase

.from("active_timers")

.delete()

.eq(
"id",
activeTimer.id
);




setActiveTimer(null);

setElapsedSeconds(0);

setProjectId("");

setDescription("");



loadData();


}






async function adminStopTimer(
timer:LiveTimer
){



if(
!confirm(
"Stop this timer and save?"
)
)

return;



const workedSeconds =
calculateElapsed(timer);



const workedHours =
Number(
(workedSeconds/3600)
.toFixed(2)
);



const {data:project} =
await supabase

.from("projects")

.select(
"used_hours,remaining_hours"
)

.eq(
"id",
timer.project_id
)

.single();




const stoppedAt =
new Date()
.toISOString();




await supabase

.from("time_entries")

.insert({

employee_id:
timer.employee_id,


project_id:
timer.project_id,


entry_date:
stoppedAt.slice(0,10),


started_at:
timer.started_at,


stopped_at:
stoppedAt,


hours:
workedHours,


description:
timer.description || null,


});




await recalculateProjectHours(timer.project_id);




await supabase

.from("active_timers")

.delete()

.eq(
"id",
timer.id
);




loadData();


}

async function recalculateProjectHours(projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("purchased_hours")
    .eq("id", projectId)
    .single();

  if (projectError) {
    alert(projectError.message);
    return;
  }

  const { data: entries, error: entriesError } = await supabase
    .from("time_entries")
    .select("hours")
    .eq("project_id", projectId);

  if (entriesError) {
    alert(entriesError.message);
    return;
  }

  const totalUsed =
    entries?.reduce((sum, entry) => {
      return sum + Number(entry.hours || 0);
    }, 0) || 0;

  const usedHours = Number(totalUsed.toFixed(2));
  const remainingHours = Number(
    (Number(project?.purchased_hours || 0) - usedHours).toFixed(2)
  );

  const { error: updateError } = await supabase
    .from("projects")
    .update({
      used_hours: usedHours,
      remaining_hours: remainingHours,
    })
    .eq("id", projectId);

  if (updateError) {
    alert(updateError.message);
  }
}

async function deleteTimeEntry(entry: TimeEntry) {
  if (!confirm("Are you sure you want to delete this time entry?")) return;

  const projectId = entry.projects?.id;

  if (!projectId) {
    alert("Project not found for this entry.");
    return;
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("used_hours, remaining_hours")
    .eq("id", projectId)
    .single();

  if (projectError) {
    alert(projectError.message);
    console.error(projectError);
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

  await recalculateProjectHours(projectId);

  alert("Time entry deleted and project hours updated.");

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

    await recalculateProjectHours(manualProjectId);

    setShowManualEntry(false);
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

    await recalculateProjectHours(oldProjectId);

    if (oldProjectId !== editProjectId) {
      await recalculateProjectHours(editProjectId);
    }

    setEditingEntry(null);
    setEditProjectId("");
    setEditDate("");
    setEditStart("");
    setEditStop("");
    setEditDescription("");

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
    setProjectId("");
    setDescription("");
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
  if (profile?.role !== "Admin" && profile?.role !== "Manager") return;

  const interval = setInterval(async () => {
    const { data: liveData } = await supabase
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

    if (liveData) {
      setLiveTimers(liveData as unknown as LiveTimer[]);
    }
  }, 5000);

  return () => clearInterval(interval);
}, [profile?.role]);
return (

<main className="min-h-screen bg-[#f8fafc] px-8 py-7">

<div className="mx-auto max-w-7xl">


<div className="flex items-center justify-between">

  <div>

    <h1 className="text-4xl font-bold text-slate-950">
      Time
    </h1>


    <p className="mt-2 text-slate-500">
      Track work hours using live timers.
    </p>

  </div>


  {profile?.role === "Admin" && (

  <button

    onClick={() => {

      setShowManualEntry(true);

      if (profile?.employee_id) {

        setManualEmployeeId(
          profile.employee_id
        );

      }

    }}

    className="rounded-2xl bg-slate-950 px-6 py-3 font-bold text-white hover:bg-slate-800"

  >

    + Add Time

  </button>

)}


</div>




{/* TIMER ENTRY */}


<div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">


<h2 className="text-xl font-semibold">
Timer Entry
</h2>



<div className="mt-5 grid grid-cols-2 gap-4">


<div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-5 py-3">


<div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 font-bold text-white">

{getInitials(
getLoggedInEmployeeName()
)}

</div>


<div>

<p className="text-xs font-semibold text-slate-500">
Logged in as
</p>


<p className="font-bold">

{getLoggedInEmployeeName()}

</p>

</div>


</div>




<select

value={projectId}

disabled={!!activeTimer}

onChange={(e)=>
setProjectId(e.target.value)
}

className="rounded-2xl border px-5 py-3"

>


<option value="">
Select project
</option>


{projects.map(
(project)=>(


<option

key={project.id}

value={project.id}

>

[{project.project_code}]
{" "}
{project.name}
-
{project.clients?.name}

</option>


)

)}


</select>





<textarea

placeholder="Work description"

value={description}

disabled={!!activeTimer}

onChange={(e)=>
setDescription(e.target.value)
}

className="col-span-2 h-28 rounded-2xl border px-5 py-3"

/>



</div>





<div className="mt-6 rounded-3xl bg-slate-50 p-6 text-center">


<p className="text-5xl font-bold">

{formatTimer(
elapsedSeconds
)}

</p>



<div className="mt-5 flex justify-center gap-3">


{!activeTimer && (


<button

onClick={startTimer}

className="rounded-2xl bg-slate-950 px-6 py-3 font-semibold text-white"

>

Start Timer

</button>


)}




{activeTimer?.status==="running" && (

<>

<button

onClick={pauseTimer}

className="rounded-2xl border px-6 py-3 font-semibold"

>

Pause Timer

</button>



<button

onClick={stopTimer}

className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white"

>

Stop Timer

</button>


</>

)}





{activeTimer?.status==="paused" && (

<>


<button

onClick={resumeTimer}

className="rounded-2xl bg-green-600 px-6 py-3 font-semibold text-white"

>

Resume Timer

</button>



<button

onClick={stopTimer}

className="rounded-2xl bg-red-600 px-6 py-3 font-semibold text-white"

>

Stop Timer

</button>


</>

)}



</div>


</div>


</div>





{/* CURRENTLY WORKING */}



{(profile?.role==="Admin" ||

profile?.role==="Manager") &&

liveTimers.length>0 && (



<div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">


<h2 className="text-xl font-semibold">
Currently Working
</h2>




<div className="mt-5">


<div className="grid grid-cols-[220px_300px_1fr_140px_160px_220px] rounded-xl bg-slate-950 px-5 py-3 text-xs font-bold uppercase text-white">

<div>
Employee
</div>

<div>
Project / Client
</div>

<div className="text-left">
Description
</div>

<div className="text-left pl-10">
Started
</div>

<div className="text-center">
Duration
</div>





</div>




<div className="mt-3 space-y-3">


{liveTimers.map(

(timer)=>(



<div

key={timer.id}

className="grid grid-cols-[220px_300px_1fr_140px_160px_220px] items-center rounded-2xl bg-slate-50 px-5 py-4"

>



<div className="font-bold">

{timer.employees?.name}

</div>



<div>


<p className="font-semibold">

[{timer.projects?.project_code}]
{" "}
{timer.projects?.name}

</p>


<p className="text-sm text-slate-500">

{timer.projects?.clients?.name}

</p>


</div>





<div>

{timer.description || "-"}

</div>





<div className="text-center">

<p className="font-semibold text-slate-700">

{formatTime(timer.started_at)}

</p>

</div>


<div className="text-center">

<p className="font-bold">

{formatTimer(
calculateElapsed(timer) + tick * 0
)}

</p>

  <span
    className={`mt-2 inline-flex rounded-full px-4 py-1 text-xs font-bold capitalize ${
      timer.status === "running"
        ? "bg-green-100 text-green-700"
        : "bg-yellow-100 text-yellow-700"
    }`}
  >
    {timer.status}
  </span>
</div>





<div className="flex justify-end gap-3">


{profile.role==="Admin" && (

<>



<button

onClick={async()=>{


if(timer.status==="running"){


await supabase

.from("active_timers")

.update({

status:"paused",

paused_at:
new Date()
.toISOString()

})

.eq(
"id",
timer.id
);



}else{


await supabase

.from("active_timers")

.update({

status:"running",

paused_at:null

})

.eq(
"id",
timer.id
);


}



loadData();


}}


className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold text-slate-800 hover:bg-slate-100"

>


{timer.status==="running"
?
"Pause"
:
"Resume"
}


</button>




<button

onClick={()=>adminStopTimer(timer)}

className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"

>

Stop

</button>



</>

)}


</div>




</div>


)

)}


</div>


</div>


</div>


)}





{/* TIME ENTRIES */}



<div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm">


<table className="w-full">


<thead className="bg-slate-950 text-sm font-bold text-white">


<tr>

<th className="px-6 py-4 text-left">
Date
</th>

<th className="px-6 py-4 text-left">
Team Member
</th>

<th className="px-6 py-4 text-left">
Project
</th>

<th className="px-6 py-4 text-center pl-0">
Start
</th>

<th className="px-6 py-4 text-center pl-0">
Stop
</th>

<th className="px-6 py-4 text-center pl-2">
Hours
</th>

<th className="px-6 py-4 text-left">
Description
</th>

{profile?.role === "Admin" && (

  <th className="px-6 py-4 text-center">

    Action

  </th>

)}


</tr>


</thead>





<tbody>


{entries.map(

(entry)=>(


<tr

  key={entry.id}

  className="border-t hover:bg-slate-50"

>


<td className="px-6 py-5">

{formatDate(
entry.entry_date
)}

</td>



<td className="px-6 py-5">

{entry.employees?.name}

</td>



<td className="px-6 py-5">

[{entry.projects?.project_code}]
{" "}
{entry.projects?.name}

</td>



<td className="px-6 py-5">

{formatTime(
entry.started_at
)}

</td>



<td className="px-6 py-5">
  <div className="flex flex-col items-center gap-1">
    <span>{formatTime(entry.stopped_at)}</span>

    {entry.started_at &&
      entry.stopped_at &&
      new Date(entry.stopped_at).getDate() !==
        new Date(entry.started_at).getDate() && (
        <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
          🌙 Next Day
        </span>
      )}
  </div>
</td>



<td className="px-6 py-5 font-bold">

{Number(entry.hours || 0).toFixed(2)}

</td>



<td className="px-6 py-5">

{entry.description || "-"}

</td>

{profile?.role === "Admin" && (

  <td className="px-6 py-5 text-center">

    <select
  defaultValue=""
  onChange={(e) => {
    const action = e.target.value;

    if (action === "edit") {

  setEditingEntry(entry);

  setEditProjectId(
    entry.projects?.id || ""
  );

  setEditDate(
    entry.entry_date
  );

  setEditStart(
  entry.started_at
    ? new Date(entry.started_at)
        .toLocaleTimeString(
          "en-GB",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        )
    : ""
);


setEditStop(
  entry.stopped_at
    ? new Date(entry.stopped_at)
        .toLocaleTimeString(
          "en-GB",
          {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }
        )
    : ""
);

  setEditDescription(
    entry.description || ""
  );

}

    if (action === "delete") {
      deleteTimeEntry(entry);
    }

    e.currentTarget.value = "";
  }}

  className="
    w-32
    cursor-pointer
    rounded-2xl
    border
    border-slate-200
    bg-white
    px-4
    py-3
    text-sm
    font-bold
    text-slate-950
    shadow-sm
    outline-none
    hover:bg-slate-50
  "
>

  <option value="">
    Actions
  </option>

  <option value="edit">
    ✏️ &nbsp; &nbsp; Edit
  </option>

  <option value="delete">
    🗑  &nbsp; &nbsp; Delete
  </option>

</select>

  </td>

)}




</tr>


)

)}


</tbody>


</table>


</div>


{/* MANUAL TIME ENTRY MODAL */}

{showManualEntry && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-950">Add Time Entry</h2>

      <div className="mt-6 space-y-4">
        {profile?.role === "Admin" ? (
          <div>
            <label className="text-sm font-semibold text-slate-500">
              Employee
            </label>

            <select
              value={manualEmployeeId}
              onChange={(e) => setManualEmployeeId(e.target.value)}
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
            Project
          </label>

          <select
            value={manualProjectId}
            onChange={(e) => setManualProjectId(e.target.value)}
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