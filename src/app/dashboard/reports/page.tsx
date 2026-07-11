"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";


type Profile = {
  role: string;
  employee_id: string | null;
};


type Entry = {

  id:string;

  entry_date:string;

  started_at:string | null;

  stopped_at:string | null;

  hours:number;

  description:string | null;


  employees:{
    id:string;
    name:string;
  } | null;


  projects:{

    id:string;

    name:string;

    project_code:string | null;

    purchased_hours:number;

    remaining_hours:number;

    clients:{
      id:string;
      name:string;
    } | null;

  } | null;

};


export default function ReportsPage(){


const [profile,setProfile] =
useState<Profile | null>(null);


const [entries,setEntries] =
useState<Entry[]>([]);


const [fromDate,setFromDate] =
useState("");


const [toDate,setToDate] =
useState("");


const [employeeFilter,setEmployeeFilter] =
useState("");


const [clientFilter,setClientFilter] =
useState("");


const [projectFilter,setProjectFilter] =
useState("");




async function loadReports(){


const {data:userData} =
await supabase.auth.getUser();



let currentProfile:
Profile | null=null;



if(userData.user){


const {data} =
await supabase

.from("profiles")

.select(
"role,employee_id"
)

.eq(
"user_id",
userData.user.id
)

.single();



currentProfile=data;

setProfile(data);


}





let query =
supabase

.from("time_entries")

.select(`

id,

entry_date,

started_at,

stopped_at,

hours,

description,

employees(
id,
name
),

projects(
id,
name,
project_code,
purchased_hours,
remaining_hours,
clients(
id,
name
)
)

`)

.order(
"entry_date",
{
ascending:false
}
);





if(
currentProfile?.role==="Employee" &&
currentProfile.employee_id
){

query=query.eq(
"employee_id",
currentProfile.employee_id
);

}




const {data} =
await query;



if(data){

setEntries(
data as unknown as Entry[]
);

}


}






useEffect(()=>{

loadReports();

},[]);




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






const filtered =
entries.filter((entry)=>{


if(
fromDate &&
entry.entry_date < fromDate
)

return false;



if(
toDate &&
entry.entry_date > toDate
)

return false;



if(
employeeFilter &&
entry.employees?.id !== employeeFilter
)

return false;



if(
projectFilter &&
entry.projects?.id !== projectFilter
)

return false;



if(
clientFilter &&
entry.projects?.clients?.id !== clientFilter
)

return false;



return true;


});





const totalHours =
filtered.reduce(

(sum,item)=>

sum+Number(item.hours || 0),

0

);

const selectedClientProjects =
  projectsForSummary();


function projectsForSummary(){

  return [

    ...new Map(

      filtered

      .filter(e=>e.projects)

      .map(e=>[

        e.projects?.id,

        e.projects

      ])

    ).values()

  ];

}

async function exportClientReport(){
    if (!clientFilter) {

  alert("Please select a client before exporting Client Report.");

  return;

}


  const clientName =
    filtered[0]?.projects?.clients?.name ||
    "Client";


  const projectIds = [
  ...new Set(
    filtered
      .map((e) => e.projects?.id)
      .filter(Boolean)
  ),
];

const { data: projectBalances } = await supabase
  .from("projects")
  .select("id,purchased_hours,remaining_hours")
  .in("id", projectIds);

const purchased =
  projectBalances?.reduce(
    (sum, project) =>
      sum + Number(project.purchased_hours || 0),
    0
  ) || 0;

const remaining =
  projectBalances?.reduce(
    (sum, project) =>
      sum + Number(project.remaining_hours || 0),
    0
  ) || 0;




  const summary = [

    ["Despacho Client Usage Report"],

    [],

    ["Client", clientName],

    ["Generated", formatDate(new Date().toISOString())],

    [],

    ["Purchased Hours", Number(purchased || 0).toFixed(2)],

    ["Used Hours", Number(totalHours || 0).toFixed(2)],

    ["Remaining Hours", Number(remaining || 0).toFixed(2)],

    [],

  ];



  const details = filtered.map(e=>({

    Date: formatDate(e.entry_date),

    Employee:e.employees?.name,

    Project:e.projects?.name,

    Start:formatTime(e.started_at),

    Stop:formatTime(e.stopped_at),

    Hours:Number(e.hours || 0).toFixed(2),

    Description:e.description || "",

  }));



  const sheet =

    XLSX.utils.aoa_to_sheet(summary);



  XLSX.utils.sheet_add_json(

    sheet,

    details,

    {

      origin:-1

    }

  );



  const book =

    XLSX.utils.book_new();



  XLSX.utils.book_append_sheet(

    book,

    sheet,

    "Usage Report"

  );



  XLSX.writeFile(

    book,

    `${clientName}_Usage_Report.xlsx`

  );


}

function exportExcel(){

  const rows = filtered.map((entry)=>({

    Date:
      formatDate(entry.entry_date),

    Employee:
      entry.employees?.name || "",

    Client:
      entry.projects?.clients?.name || "",

    "Project Code":
      entry.projects?.project_code || "",

    Project:
      entry.projects?.name || "",

    Start:
      formatTime(entry.started_at),

    Stop:
      formatTime(entry.stopped_at),

    Hours:
      Number(entry.hours || 0).toFixed(2),

    Description:
      entry.description || "",

  }));


  const worksheet =
    XLSX.utils.json_to_sheet(rows);


  const workbook =
    XLSX.utils.book_new();


  XLSX.utils.book_append_sheet(

    workbook,

    worksheet,

    "Time Report"

  );


  XLSX.writeFile(

    workbook,

    `Despacho_Time_Report_${new Date()
      .toISOString()
      .slice(0,10)}.xlsx`

  );

}


return(

<main className="min-h-screen bg-[#f8fafc] px-8 py-7">


<div className="mx-auto max-w-7xl">


<div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
  <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
  <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
  <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

  <div>
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Operational intelligence</p>
    <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Reports</h1>
    <p className="mt-3 text-sm text-slate-300">Turn delivery data into clear, exportable insights.</p>
  </div>


  <div className="flex gap-3">


<button

onClick={exportClientReport}

className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 font-semibold text-white hover:bg-white/15"

>

Client Report

</button>



<button

onClick={exportExcel}

className="rounded-2xl bg-white px-6 py-3 font-bold text-[#0F172A] shadow-lg"

>

Export Excel

</button>


</div>
</div>


</div>




<div className="relative z-10 -mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:mx-5">


<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">


<input

type="date"

value={fromDate}

onChange={(e)=>
setFromDate(e.target.value)
}

className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"

/>



<input

type="date"

value={toDate}

onChange={(e)=>
setToDate(e.target.value)
}

className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"

/>



<select

value={clientFilter}

onChange={(e)=>
setClientFilter(e.target.value)
}

className="rounded-xl border px-4"

>

<option value="">
All Clients
</option>


{[...new Map(

entries.map(e=>[

e.projects?.clients?.id,

e.projects?.clients

])

).values()]

.filter(Boolean)

.map((client:any)=>(

<option

key={client.id}

value={client.id}

>

{client.name}

</option>

))}


</select>





<select

value={projectFilter}

onChange={(e)=>
setProjectFilter(e.target.value)
}

className="rounded-xl border px-4"

>

<option value="">
All Projects
</option>


{[...new Map(

entries.map(e=>[

e.projects?.id,

e.projects

])

).values()]

.filter(Boolean)

.map((project:any)=>(

<option

key={project.id}

value={project.id}

>

[{project.project_code}]
{" "}
{project.name}

</option>

))}


</select>




{profile?.role!=="Employee" && (

<select

value={employeeFilter}

onChange={(e)=>
setEmployeeFilter(e.target.value)
}

className="rounded-xl border px-4"

>

<option value="">
All Employees
</option>


{[...new Map(

entries.map(e=>[

e.employees?.id,

e.employees

])

).values()]

.filter(Boolean)

.map((employee:any)=>(

<option

key={employee.id}

value={employee.id}

>

{employee.name}

</option>

))}


</select>

)}


</div>



<div className="mt-6 rounded-2xl bg-slate-50 p-5">


<p className="text-sm text-slate-500">

Total Hours

</p>


<p className="text-4xl font-bold">

{totalHours.toFixed(2)}

</p>


</div>


</div>






<div className="mt-8 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">

<table className="w-full">


<thead className="bg-slate-950 text-white">


<tr>

<th className="p-4 text-left pl-6">Date</th>

<th className="p-4 text-left">Employee</th>

<th className="p-4 text-left pl-8">Client</th>

<th className="p-4 text-left pl-8">Project</th>

<th className="p-4 text-center pl-2">Start</th>

<th className="p-4 text-center">Stop</th>

<th className="p-4 text-center">Hours</th>

<th className="p-4 text-left">Description</th>

</tr>


</thead>


<tbody>


{filtered.map(entry=>(


<tr

key={entry.id}

className="border-t"

>


<td className="p-4">

{formatDate(entry.entry_date)}

</td>


<td className="p-4">

{entry.employees?.name}

</td>


<td className="p-4">

{entry.projects?.clients?.name}

</td>



<td className="p-4">

[{entry.projects?.project_code}]
{" "}
{entry.projects?.name}

</td>



<td className="p-4 text-center">

{formatTime(entry.started_at)}

</td>



<td className="p-4 text-center">

{formatTime(entry.stopped_at)}

</td>



<td className="p-4 text-center font-bold">

{entry.hours.toFixed(2)}

</td>


<td className="p-4">

{entry.description || "-"}

</td>


</tr>


))}


</tbody>


</table>


</div>


</div>


</main>

);


}
