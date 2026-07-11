"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


export default function LoginPage() {

  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");


  async function login(){

    const { error } =
      await supabase.auth.signInWithPassword({

        email,
        password,

      });


    if(error){

      alert(error.message);
      return;

    }


    router.push("/dashboard");

  }




  return (

    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc]">


      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">


        <div className="flex justify-center">
  <img
    src="/kairo-logo-full.png"
    alt="Kairo"
    className="h-30 w-60 rounded-2xl object-contain"
  />
</div>




        <p className="mt-2 text-center text-slate-500">

          Everything work. One place.

        </p>





        <div className="mt-8 space-y-4">


          <input

            placeholder="Email"

            value={email}

            onChange={(e)=>setEmail(e.target.value)}

            className="w-full rounded-2xl border px-5 py-3"

          />




          <input

            type="password"

            placeholder="Password"

            value={password}

            onChange={(e)=>setPassword(e.target.value)}

            className="w-full rounded-2xl border px-5 py-3"

          />




          <button

            onClick={login}

            className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white"

          >

            Login

          </button>



        </div>


      </div>


    </main>

  );

}