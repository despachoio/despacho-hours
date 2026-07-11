"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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




export default function ProjectDetailPage() {


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

const [notesText, setNotesText] = useState("");



const [projectCode,setProjectCode] =
useState("");


const [projectName,setProjectName] =
useState("");


const [startDate,setStartDate] =
useState("");


const [purchasedHours,setPurchasedHours] =
useState("");


const [description,setDescription] =
useState("");


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


setProjectCode(
data.project_code || ""
);


setProjectName(
data.name
);


setStartDate(
data.start_date || ""
);


setPurchasedHours(
String(
data.purchased_hours || 0
)
);


setDescription(
data.description || ""
);

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
  if (!project) return;

  const purchased = Number(purchasedHours || 0);

  await supabase
    .from("projects")
    .update({
      project_code: projectCode,
      name: projectName,
      start_date: startDate || null,
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

  router.push("/dashboard/projects");
}






async function addHours() {
  if (!project) return;

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

  router.push(`/dashboard/projects/${project.id}/wallet`);
}
async function addResource(){

if(!resource) return;


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
"/dashboard/projects"
);


}






async function unarchiveProject(){


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
"/dashboard/projects"
);


}







useEffect(()=>{


loadProject();

loadTeam();


},[]);




if(!project) return null;




return (

<main className="min-h-screen bg-[#f8fafc] px-8 py-7">


<div className="mx-auto max-w-3xl">


<button

onClick={()=>
router.push(
"/dashboard/projects"
)
}

className="mb-6 text-sm text-slate-500"

>

← Back to Projects

</button>





<div className="rounded-3xl bg-white p-8 shadow-sm">


<p className="text-sm font-semibold text-slate-500">

Project Code: {project.project_code}

</p>



<h1 className="mt-2 text-3xl font-bold">

{project.name}

</h1>



{project.clients && (

<button

onClick={()=>

router.push(

`/dashboard/clients/${project.clients?.id}`

)

}

className="mt-3 text-sm font-semibold text-slate-500 underline"

>

Client: {project.clients.name}

</button>

)}






{!action && (

<div className="mt-8 space-y-6">


<div className="grid grid-cols-3 gap-4">


<div className="rounded-2xl bg-slate-50 p-5">

<p className="text-sm text-slate-500">
Purchased
</p>

<p className="text-2xl font-bold">

{project.purchased_hours}

</p>

</div>




<div className="rounded-2xl bg-slate-50 p-5">

<p className="text-sm text-slate-500">
Used
</p>

<p className="text-2xl font-bold">

{Number(project.used_hours || 0).toFixed(2)}

</p>

</div>





<div className="rounded-2xl bg-slate-50 p-5">

<p className="text-sm text-slate-500">
Remaining
</p>

<p className="text-2xl font-bold">

{Number(project.remaining_hours || 0).toFixed(2)}

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
        Purchased Hours
      </label>
      <input
        type="number"
        value={purchasedHours}
        onChange={(e) => setPurchasedHours(e.target.value)}
        className="w-full rounded-2xl border px-5 py-3"
      />
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
        onClick={saveProject}
        className="rounded-2xl bg-slate-950 px-6 py-3 text-white"
      >
        Save
      </button>

      <button
        onClick={() => router.push("/dashboard/projects")}
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

  placeholder="Hours to add"

  className="w-full rounded-2xl border px-5 py-3"

/>



<div className="flex gap-3">


<button

  onClick={addHours}

  className="rounded-2xl bg-slate-950 px-6 py-3 text-white"

>

  Add Hours

</button>



<button

  onClick={() =>
    router.push("/dashboard/projects")
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



      <button

        onClick={() =>
          router.push("/dashboard/projects")
        }

        className="rounded-2xl border px-6 py-3"

      >

        Back

      </button>


    </div>


  </div>


</div>

)}








</div>


</div>


</main>

);


}