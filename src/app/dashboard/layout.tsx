"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";


export default function DashboardLayout({

  children,

}: {

  children: React.ReactNode;

}) {


  const router = useRouter();

  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState("");

const [userName, setUserName] = useState("");

const [userRole, setUserRole] = useState("");



  useEffect(() => {


    async function checkUser() {


      const { data } = await supabase.auth.getUser();



     if (!data.user) {

  router.replace("/login");

} else {

setUserEmail(data.user.email || "");

const { data: profile } = await supabase

  .from("profiles")

  .select("full_name, role")

  .eq("user_id", data.user.id)

  .single();

setUserName(profile?.full_name || data.user.email?.split("@")[0] || "");

setUserRole(profile?.role || "User");
}


    }



    checkUser();



  }, [router]);





  async function logout() {


    await supabase.auth.signOut();


    router.replace("/login");


    router.refresh();


  }







  const allMenu = [

  {

    name: "Dashboard",

    path: "/dashboard",

    roles: ["Admin", "Manager", "Employee"],

  },

  {

    name: "Clients",

    path: "/dashboard/clients",

    roles: ["Admin", "Manager"],

  },

  {

    name: "Projects",

    path: "/dashboard/projects",

    roles: ["Admin", "Manager", "Employee"],

  },

  {

    name: "Team",

    path: "/dashboard/team",

    roles: ["Admin", "Manager"],

  },

  {

  name: "Time",

  path: "/dashboard/time",

  roles: ["Admin", "Manager", "Employee"],

},


{

  name: "Reports",

  path: "/dashboard/reports",

  roles: ["Admin", "Manager", "Employee"],

},

{

  name: "Invoices",

  path: "/dashboard/invoices",

  roles: ["Admin"],

},

];

const menu = allMenu.filter(

  item => item.roles.includes(userRole)

);

function hasAccess(path:string){

  if(!userRole) return true;

  const allowed = allMenu.find(

    item => item.path === path

  );

  if(!allowed) return true;

  return allowed.roles.includes(userRole);

}

useEffect(()=>{

  if(userRole && !hasAccess(pathname)){

    router.replace("/dashboard/time");

  }

},[userRole, pathname]);


function getInitials(name:string){

  return name

    .split(" ")

    .map((word)=>word[0])

    .join("")

    .slice(0,2)

    .toUpperCase();

}


  return (

    <div className="flex min-h-screen bg-[#f8fafc]">



      {/* SIDEBAR */}


      <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white p-6">


        <div>


          <div className="flex items-center gap-3">

  <img

    src="/kairo-logo-full.png"

    alt="Kairo"

    className="h-30 w-75 rounded-xl object-contain"

  />

  

</div>


        </div>





        <nav className="mt-10 space-y-2">


          {menu.map((item)=>(


            <button

              key={item.path}


              onClick={() => router.push(item.path)}


              className={`

                w-full

                rounded-2xl

                px-5

                py-3

                text-left

                text-sm

                font-semibold

                transition


                ${

                  pathname === item.path

                  ? "bg-slate-950 text-white"

                  : "text-slate-600 hover:bg-slate-100"

                }

              `}


            >


              {item.name}


            </button>


          ))}



        </nav>







       <div className="absolute bottom-6 left-6 right-6">


  <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">


    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">

      {getInitials(userName)}

    </div>



    <div className="min-w-0">


      <p className="truncate text-sm font-bold text-slate-950">

        {userName}

      </p>


      <p className="text-xs font-semibold text-slate-500">

        {userRole}

      </p>


    </div>


  </div>





  <button

    onClick={logout}

    className="
      w-full
      rounded-2xl
      border
      border-red-200
      py-3
      text-sm
      font-semibold
      text-red-600
      hover:bg-red-50
    "

  >

    Logout

  </button>


</div>



      </aside>









      {/* MAIN CONTENT */}


      <main className="ml-64 flex-1">


        {children}


      </main>



    </div>

  );

}