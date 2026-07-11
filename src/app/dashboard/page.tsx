"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";



type Client = {
  id: string;
  status: string;
};

type Project = {
  id: string;
  name: string;
  project_code: string | null;
  remaining_hours: number;
  status: string;
};

type Employee = {
  id: string;
  name: string;

  time_entries: {
    hours: number;
    entry_date: string;
  }[];
  
};

type TimeEntry = {

  id: string;

  created_at: string;

  entry_date: string;

  hours: number;

  employees: {

    name: string;

  } | null;

  projects: {

    name: string;

    project_code: string | null;

  } | null;

};
type Profile = {

  role: string;

  employee_id: string | null;

};

export default function DashboardPage() {
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);


  async function loadDashboard() {
  const { data: userData } = await supabase.auth.getUser();

  let currentProfile: Profile | null = null;

  if (userData.user) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role, employee_id")
      .eq("user_id", userData.user.id)
      .single();

    currentProfile = profileData;
    setProfile(profileData);
  }

  if (currentProfile?.role === "Employee" && currentProfile.employee_id) {
    const { data: employeeData } = await supabase
      .from("employees")
      .select(`
        id,
        name,
        time_entries(
          hours,
          entry_date
        )
      `)
      .eq("id", currentProfile.employee_id);

    if (employeeData) setEmployees(employeeData as Employee[]);

    const { data: projectData } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        project_code,
        remaining_hours,
        status,
        project_resources(employee_id)
      `)
      .eq("status", "active");

    if (projectData) {
      const assignedProjects = projectData.filter((project: any) =>
        project.project_resources?.some(
          (resource: any) =>
            resource.employee_id === currentProfile?.employee_id
        )
      );

      setProjects(assignedProjects as Project[]);
    }

    const { data: timeData } = await supabase
      .from("time_entries")
      .select(`
        id,
        created_at,
        entry_date,
        hours,
        employees(name),
        projects(name, project_code)
      `)
      .eq("employee_id", currentProfile.employee_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (timeData) setRecentEntries(timeData as unknown as TimeEntry[]);

    return;
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("id,status");

  if (clientData) setClients(clientData);

  const { data: projectData } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      project_code,
      remaining_hours,
      status
    `);

  if (projectData) setProjects(projectData);

  const { data: employeeData } = await supabase
    .from("employees")
    .select(`
      id,
      name,
      time_entries(
        hours,
        entry_date
      )
    `);

  if (employeeData) setEmployees(employeeData as Employee[]);

  const { data: timeData } = await supabase
    .from("time_entries")
    .select(`
      id,
      created_at,
      entry_date,
      hours,
      employees(name),
      projects(name, project_code)
    `)
    .order("created_at", { ascending:false })
    .limit(5);

  if (timeData) setRecentEntries(timeData as unknown as TimeEntry[]);
}





  function weeklyHours(employee: Employee){

    const today = new Date();

    const weekStart = new Date(today);

    weekStart.setDate(
      today.getDate() - today.getDay() + 1
    );


    return employee.time_entries
      ?.filter(
        (e)=>new Date(e.entry_date)>=weekStart
      )
      .reduce(
        (sum,e)=>sum+Number(e.hours),
        0
      ) || 0;

  }





  const activeClients =
    clients.filter(c=>c.status==="active").length;


  const activeProjects =
    projects.filter(p=>p.status==="active").length;


  const totalWeeklyHours =
    employees.reduce(
      (sum,e)=>sum+weeklyHours(e),
      0
    );


  const totalCapacity =
    employees.length * 40;


  const utilization =
    totalCapacity
      ? Math.round(
          (totalWeeklyHours/totalCapacity)*100
        )
      : 0;



function formatDate(date:string){

  return new Date(date)
    .toLocaleDateString("en-GB",{
      day:"2-digit",
      month:"short",
      year:"numeric",
    })
    .replace(/ /g,"-");

}
  useEffect(()=>{

    loadDashboard();

  },[]);





  return (

    <main className="min-h-screen bg-[#f8fafc] px-8 py-7">


      <div className="mx-auto max-w-7xl">


        


        <div className="relative overflow-hidden rounded-[2rem] bg-[#0F172A] p-8 text-white shadow-xl shadow-slate-300/50 lg:p-10">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#153E90]/60 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-blue-400/10 blur-2xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Despacho overview</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight lg:text-5xl">Dashboard</h1>
            <p className="mt-3 text-sm text-slate-300">A clear view of delivery, capacity, and client operations.</p>
          </div>
        </div>





{profile?.role === "Employee" ? (

  <div className="relative z-10 -mt-4 grid gap-5 px-4 sm:grid-cols-3 lg:px-6">


    <Card

      title="My Projects"

      value={projects.length}

      onClick={() =>
        router.push("/dashboard/projects")
      }

    />



    <Card

      title="My Hours This Week"

      value={Number(totalWeeklyHours || 0).toFixed(2)}

      onClick={() =>
        router.push("/dashboard/time")
      }

    />



    <Card

      title="My Weekly Utilization"

      value={`${utilization}%`}

      onClick={() =>
        router.push("/dashboard/time")
      }

    />


  </div>


) : (


  <div className="relative z-10 -mt-4 grid gap-5 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">


    <Card

      title="Active Clients"

      value={activeClients}

      onClick={() =>
        router.push("/dashboard/clients")
      }

    />



    <Card

      title="Active Projects"

      value={activeProjects}

      onClick={() =>
        router.push("/dashboard/projects")
      }

    />



    <Card

      title="Hours This Week"

      value={Number(totalWeeklyHours || 0).toFixed(2)}

      onClick={() =>
        router.push("/dashboard/time")
      }

    />



    <Card

      title="Team Utilization"

      value={`${utilization}%`}

      onClick={() =>
        router.push("/dashboard/team")
      }

    />


  </div>


)}





        {profile?.role !== "Employee" && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">


          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">


            <h2 className="font-bold">

              Low Hour Projects

            </h2>



            <div className="mt-5 space-y-3">

  {projects.filter(

    p =>

      p.remaining_hours <= 10 &&

      p.status === "active"

  ).length ? (

    projects

      .filter(

        p =>

          p.remaining_hours <= 10 &&

          p.status === "active"

      )

      .map(project => (

        <div

          key={project.id}

          className="rounded-2xl bg-red-50 p-4"

        >

          <p className="font-semibold">

            [{project.project_code}] {project.name}

          </p>

          <p className="text-sm font-semibold text-red-600">

            {project.remaining_hours} hrs remaining

          </p>

        </div>

      ))

  ) : (

    <p className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">

      ✓ All projects have healthy hours

    </p>

  )}

</div>


          </div>








          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">


            <h2 className="font-bold">

              Overloaded Team

            </h2>



            <div className="mt-5 space-y-3">


  {employees.filter(
    e => weeklyHours(e) > 40
  ).length ? (


    employees
      .filter(
        e => weeklyHours(e) > 40
      )
      .map(employee => (


        <div

          key={employee.id}

          className="rounded-2xl bg-red-50 p-4"

        >


          <p className="font-semibold">

            {employee.name}

          </p>


          <p className="text-sm font-semibold text-red-600">

            {weeklyHours(employee)} hrs this week

          </p>


        </div>


      ))


  ) : (


    <p className="rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-700">

      ✓ Team capacity looks healthy

    </p>


  )}


</div>



          </div>



        </div>
        )}

<div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">


  <h2 className="text-lg font-bold text-slate-950">

    Recent Activity

  </h2>



  <div className="mt-5 space-y-3">


    {recentEntries.length ? (


      recentEntries.map(entry=>(


        <div

          key={entry.id}

          className="flex items-center justify-between rounded-2xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white p-4 transition hover:border-blue-200 hover:shadow-sm"

        >


          <div>


            <p className="font-semibold text-slate-950">

              {entry.employees?.name} logged {entry.hours} hrs

            </p>


            <p className="mt-1 text-sm text-slate-500">

              [{entry.projects?.project_code}] {entry.projects?.name}

            </p>


          </div>




          <span className="text-sm font-semibold text-slate-500">

            {formatDate(entry.entry_date)}

          </span>


        </div>


      ))


    ):(


      <p className="text-sm text-slate-500">

        No recent activity.

      </p>


    )}


  </div>


</div>
      </div>


    </main>

  );

}





function Card({

  title,
  value,
  onClick

}:{

  title:string;
  value:number|string;
  onClick:()=>void;

}){

  return (

    <div

      onClick={onClick}

      className="

  cursor-pointer

  rounded-3xl

  bg-white

  p-7

  shadow-lg

  ring-1

  ring-slate-200

  transition

  hover:-translate-y-1

  hover:border-blue-200

  hover:shadow-xl

"

    >


      <p className="text-sm font-semibold text-slate-500">

  {title}

</p>

<p className="mt-4 text-4xl font-bold tracking-tight text-[#153E90]">

  {value}

</p>


    </div>

  );

}
