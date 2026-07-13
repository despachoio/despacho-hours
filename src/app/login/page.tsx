"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";


export default function LoginPage() {

  const router = useRouter();

  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const loginLockRef = useRef(false);


  async function login(event: React.FormEvent<HTMLFormElement>){

    event.preventDefault();

    if (loginLockRef.current) return;

    loginLockRef.current = true;
    setIsLoggingIn(true);

    const { error } =
      await supabase.auth.signInWithPassword({

        email,
        password,

      });


    if(error){

      alert(error.message);
      loginLockRef.current = false;
      setIsLoggingIn(false);
      return;

    }


    router.push("/dashboard");

  }




  return (

    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-5 py-10">


      <section className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10">


        <div className="flex justify-center">
  <Image
    src="/kairo-logo-full.png"
    alt="Kairo"
    width={240}
    height={120}
    priority
    className="h-30 w-60 rounded-2xl object-contain"
  />
</div>




        <p className="mt-2 text-center text-xs font-bold uppercase tracking-[0.16em] text-slate-500">

          The Pulse of Despacho

        </p>





        <form
          onSubmit={login}
          aria-busy={isLoggingIn}
          className="mt-8 space-y-4"
        >


          <input

            placeholder="Email"

            name="email"

            aria-label="Email"

            autoComplete="email"

            value={email}

            onChange={(e)=>setEmail(e.target.value)}

            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15"

          />

          <input

            type="password"

            placeholder="Password"

            name="password"

            aria-label="Password"

            autoComplete="current-password"

            value={password}

            onChange={(e)=>setPassword(e.target.value)}

            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-[#153E90] focus:ring-2 focus:ring-[#153E90]/15"

          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded text-sm font-semibold text-[#153E90] transition-colors duration-200 hover:text-[#123474] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30"
            >
              Forgot Password?
            </Link>
          </div>




          <button

            type="submit"

            disabled={isLoggingIn}

            className="h-12 w-full rounded-xl bg-[#0F172A] px-5 font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#153E90] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#153E90]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"

          >

            {isLoggingIn ? "Logging in…" : "Login"}

          </button>



        </form>


      </section>


    </main>

  );

}
