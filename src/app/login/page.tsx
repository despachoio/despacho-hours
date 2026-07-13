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

    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc]">


      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">


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




        <p className="mt-2 text-center text-slate-500 font-bold uppercase">

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

            className="w-full rounded-2xl border px-5 py-3"

          />

          <input

            type="password"

            placeholder="Password"

            name="password"

            aria-label="Password"

            autoComplete="current-password"

            value={password}

            onChange={(e)=>setPassword(e.target.value)}

            className="w-full rounded-2xl border px-5 py-3"

          />

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[#153E90] transition hover:underline"
            >
              Forgot Password?
            </Link>
          </div>




          <button

            type="submit"

            disabled={isLoggingIn}

            className="w-full rounded-2xl bg-slate-950 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"

          >

            {isLoggingIn ? "Logging in…" : "Login"}

          </button>



        </form>


      </div>


    </main>

  );

}
