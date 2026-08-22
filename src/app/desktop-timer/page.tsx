"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/lib/roles";

declare global {
  interface Window {
    kairoDesktop?: {
      openFullApp: () => Promise<void>;
      getSessionId: () => Promise<string>;
      onLogoutRequested: (callback: () => void) => () => void;
      onShutdownRequested: (callback: () => void) => () => void;
      shutdownComplete: () => void;
    };
  }
}

type Profile = {
  employee_id: string;
  full_name: string | null;
  role: string;
};

type Client = { id: string; name: string };

type Project = {
  id: string;
  client_id: string;
  name: string;
  project_code: string | null;
  clients: { id: string; name: string } | null;
  project_resources: { employee_id: string }[];
};

type ActiveTimer = {
  id: string;
  employee_id: string;
  project_id: string;
  started_at: string;
  work_date: string | null;
  paused_at: string | null;
  total_paused_seconds: number;
  status: "running" | "paused";
  description: string | null;
};

function cleanError(message: string) {
  return message.replace(/^.*?:\s*/, "").replace(/\.$/, "");
}

function elapsedSeconds(timer: ActiveTimer, now: number) {
  const start = new Date(timer.started_at).getTime();
  const end =
    timer.status === "paused" && timer.paused_at
      ? new Date(timer.paused_at).getTime()
      : now;
  return Math.max(
    Math.floor((end - start) / 1000) -
      Number(timer.total_paused_seconds || 0),
    0,
  );
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function DesktopTimerPage() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDescription] = useState("");
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tick, setTick] = useState(0);
  const [desktopSessionId, setDesktopSessionId] = useState("");
  const mountedRef = useRef(true);
  const activeTimerRef = useRef<ActiveTimer | null>(null);

  const storeActiveTimer = useCallback((timer: ActiveTimer | null) => {
    activeTimerRef.current = timer;
    setActiveTimer(timer);
  }, []);

  const loadActiveTimer = useCallback(async (employeeId: string) => {
    const { data, error } = await supabase
      .from("active_timers")
      .select(
        "id,employee_id,project_id,started_at,paused_at,total_paused_seconds,status,description",
      )
      .eq("employee_id", employeeId)
      .in("status", ["running", "paused"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!mountedRef.current) return;
    if (error) {
      setMessage(cleanError(error.message));
      return;
    }
    const timer = (data || null) as ActiveTimer | null;
    storeActiveTimer(timer);
    if (timer) {
      setProjectId(timer.project_id);
      setDescription(timer.description || "");
      setTick(Date.now());
    }
  }, [storeActiveTimer]);

  const loadWorkspace = useCallback(async () => {
    setMessage("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (mountedRef.current) {
        setProfile(null);
        setReady(true);
      }
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("employee_id,full_name,role")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profileData?.employee_id) {
      if (mountedRef.current) {
        setProfile(null);
        setMessage(
          profileError
            ? cleanError(profileError.message)
            : "Your employee profile is not configured for timer access.",
        );
        setReady(true);
      }
      return;
    }

    const currentProfile = profileData as Profile;
    if (
      !["finance admin", "super admin", "admin", "manager", "employee"].includes(
        normalizeRole(currentProfile.role),
      )
    ) {
      if (mountedRef.current) {
        setProfile(null);
        setMessage("Timer access is not available for this account.");
        setReady(true);
      }
      return;
    }

    let recoveredPreviousTimer = false;
    if (window.kairoDesktop) {
      const sessionId = await window.kairoDesktop.getSessionId();
      const { data: recoveredEntry, error: recoveryError } = await supabase.rpc(
        "recover_own_desktop_timer",
        { p_session_id: sessionId },
      );
      if (!mountedRef.current) return;
      setDesktopSessionId(sessionId);
      recoveredPreviousTimer = Boolean(recoveredEntry);
      if (recoveryError) setMessage(cleanError(recoveryError.message));
    }

    const projectResult = await supabase
      .from("projects")
      .select(
        "id,client_id,name,project_code,clients(id,name),project_resources(employee_id)",
      )
      .eq("status", "active")
      .order("name");

    if (!mountedRef.current) return;
    const loadedProjects = (projectResult.data || []) as unknown as Project[];
    const visibleProjects = loadedProjects.filter((project) =>
      project.project_resources?.some(
        (resource) => resource.employee_id === currentProfile.employee_id,
      ),
    );
    const visibleClients = Array.from(
      new Map(
        visibleProjects
          .filter((project) => project.clients)
          .map((project) => [project.clients!.id, project.clients!]),
      ).values(),
    ).sort((left, right) => left.name.localeCompare(right.name));

    setProfile(currentProfile);
    setClients(visibleClients);
    setProjects(visibleProjects);
    setReady(true);
    if (projectResult.error) {
      setMessage(
        cleanError(
          projectResult.error.message || "Unable to load timer projects.",
        ),
      );
    } else if (recoveredPreviousTimer) {
      setMessage(
        "Your previous timer was stopped and saved successfully after restart.",
      );
    }
    await loadActiveTimer(currentProfile.employee_id);
  }, [loadActiveTimer]);

  useEffect(() => {
    mountedRef.current = true;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        void loadWorkspace();
      }
      if (event === "SIGNED_OUT" && mountedRef.current) {
        setProfile(null);
        storeActiveTimer(null);
        setClients([]);
        setProjects([]);
        setPassword("");
        setReady(true);
      }
    });
    return () => {
      mountedRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [loadWorkspace, storeActiveTimer]);

  useEffect(() => {
    if (!activeTimer || activeTimer.status !== "running") return;
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  useEffect(() => {
    if (!profile?.employee_id) return;
    const interval = window.setInterval(
      () => void loadActiveTimer(profile.employee_id),
      10000,
    );
    return () => window.clearInterval(interval);
  }, [loadActiveTimer, profile?.employee_id]);

  useEffect(() => {
    if (!activeTimer || !window.kairoDesktop || !desktopSessionId) return;
    const sendHeartbeat = () =>
      supabase.rpc("heartbeat_own_timer", {
        p_timer_id: activeTimer.id,
        p_session_id: desktopSessionId,
      });
    void sendHeartbeat();
    const interval = window.setInterval(() => void sendHeartbeat(), 10000);
    return () => window.clearInterval(interval);
  }, [activeTimer, desktopSessionId]);

  const stopActiveTimerForExit = useCallback(async () => {
    const timer = activeTimerRef.current;
    if (!timer) return null;
    const { error } = await supabase.rpc("stop_own_timer", {
      p_timer_id: timer.id,
    });
    if (!error) storeActiveTimer(null);
    return error;
  }, [storeActiveTimer]);

  const logout = useCallback(async () => {
    setBusy(true);
    const stopError = await stopActiveTimerForExit();
    if (stopError) {
      setMessage(cleanError(stopError.message));
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
  }, [stopActiveTimerForExit]);

  useEffect(() => {
    return window.kairoDesktop?.onLogoutRequested(() => void logout());
  }, [logout]);

  useEffect(() => {
    return window.kairoDesktop?.onShutdownRequested(() => {
      void stopActiveTimerForExit().finally(() => {
        window.kairoDesktop?.shutdownComplete();
      });
    });
  }, [stopActiveTimerForExit]);

  const selectedClientId = activeTimer
    ? projects.find((project) => project.id === activeTimer.project_id)
        ?.client_id || ""
    : clientId;
  const filteredProjects = useMemo(
    () =>
      selectedClientId
        ? projects.filter(
            (project) => project.client_id === selectedClientId,
          )
        : [],
    [projects, selectedClientId],
  );

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setMessage(cleanError(error.message));
    setBusy(false);
  }

  async function startTimer() {
    if (!projectId || busy) return;
    setBusy(true);
    setMessage("");
    const descriptionValue = description.trim() || null;
    const sessionId = window.kairoDesktop
      ? desktopSessionId || (await window.kairoDesktop.getSessionId())
      : "";
    if (sessionId && !desktopSessionId) setDesktopSessionId(sessionId);
    const result = window.kairoDesktop
      ? await supabase.rpc("start_own_desktop_timer", {
          p_project_id: projectId,
          p_description: descriptionValue,
          p_session_id: sessionId,
        })
      : await supabase.rpc("start_own_timer", {
          p_project_id: projectId,
          p_description: descriptionValue,
        });
    const { data, error } = result;
    if (error) {
      setMessage(cleanError(error.message));
    } else {
      storeActiveTimer(data as ActiveTimer);
      setTick(Date.now());
    }
    setBusy(false);
  }

  async function changeTimerState(action: "pause" | "resume") {
    if (!activeTimer || busy) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("update_own_timer_state", {
      p_timer_id: activeTimer.id,
      p_action: action,
    });
    if (error) setMessage(cleanError(error.message));
    else {
      storeActiveTimer(data as ActiveTimer);
      setTick(Date.now());
    }
    setBusy(false);
  }

  async function stopTimer() {
    if (!activeTimer || busy) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("stop_own_timer", {
      p_timer_id: activeTimer.id,
    });
    if (error) {
      setMessage(cleanError(error.message));
    } else {
      storeActiveTimer(null);
      setProjectId("");
      setClientId("");
      setDescription("");
      setTick(0);
      setMessage("Time entry saved successfully.");
    }
    setBusy(false);
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">
        Loading Kairo Timer…
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
        <section className="w-full max-w-sm rounded-[1.75rem] border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60">
          <div className="flex justify-center">
            <Image
              src="/kairo-logo-full.png"
              alt="Kairo"
              width={190}
              height={80}
              priority
              className="h-20 w-48 object-contain"
            />
          </div>
          <div className="mt-1 flex items-center justify-center gap-2 text-[#153E90]">
            <TimerIcon />
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              Personal Timer
            </p>
          </div>
          <form onSubmit={login} className="mt-7 space-y-4">
            <input
              type="email"
              aria-label="Email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="password"
              aria-label="Password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm outline-none focus:border-[#153E90] focus:ring-2 focus:ring-blue-100"
            />
            {message ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {message}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-xl bg-[#0F172A] text-sm font-bold text-white transition hover:bg-[#153E90] disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in to Timer"}
            </button>
            <Link
              href="/forgot-password"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full text-xs font-semibold text-[#153E90] hover:underline"
            >
              Forgot password?
            </Link>
          </form>
        </section>
      </main>
    );
  }

  const currentProject = projects.find(
    (project) => project.id === activeTimer?.project_id,
  );
  const seconds = activeTimer
    ? elapsedSeconds(activeTimer, tick || new Date(activeTimer.started_at).getTime())
    : 0;

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950">
      <section className="mx-auto max-w-md overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
        <header className="bg-[#0F172A] px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">
                Kairo Personal Timer
              </p>
              <h1 className="mt-1 text-lg font-bold">
                {profile.full_name || "My Timer"}
              </h1>
              <p className="mt-1 text-xs text-slate-400">{profile.role}</p>
            </div>
            <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${activeTimer?.status === "running" ? "bg-emerald-400/15 text-emerald-300" : activeTimer?.status === "paused" ? "bg-amber-400/15 text-amber-300" : "bg-white/10 text-slate-300"}`}>
              {activeTimer?.status || "Ready"}
            </div>
          </div>
        </header>

        <div className="p-5">
          <div className="rounded-2xl bg-slate-50 px-4 py-6 text-center ring-1 ring-slate-200">
            <p className="font-mono text-4xl font-bold tracking-tight text-[#153E90]">
              {formatDuration(seconds)}
            </p>
            <p className="mt-2 truncate text-xs font-semibold text-slate-500">
              {currentProject
                ? `${currentProject.clients?.name || "Client"} · ${currentProject.name}`
                : "Select a project to begin"}
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Client</span>
              <select
                value={selectedClientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                  setProjectId("");
                }}
                disabled={Boolean(activeTimer) || busy}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#153E90] disabled:bg-slate-100"
              >
                <option value="">Select client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Project</span>
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={!selectedClientId || Boolean(activeTimer) || busy}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#153E90] disabled:bg-slate-100"
              >
                <option value="">
                  {!selectedClientId
                    ? "Select client first"
                    : filteredProjects.length
                      ? "Select assigned project"
                      : "No assigned projects for this client"}
                </option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.project_code ? `${project.project_code} · ` : ""}{project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-slate-600">Description</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={Boolean(activeTimer) || busy}
                rows={2}
                maxLength={500}
                placeholder="What are you working on?"
                className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#153E90] disabled:bg-slate-100"
              />
            </label>
          </div>

          {message ? (
            <p role="status" className={`mt-4 rounded-xl px-3 py-2 text-xs font-semibold ${message.includes("successfully") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {message}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            {!activeTimer ? (
              <button
                type="button"
                onClick={() => void startTimer()}
                disabled={!projectId || busy}
                className="col-span-2 h-12 rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {busy ? "Starting…" : "Start Timer"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void changeTimerState(
                      activeTimer.status === "running" ? "pause" : "resume",
                    )
                  }
                  disabled={busy}
                  className="h-12 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  {activeTimer.status === "running" ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => void stopTimer()}
                  disabled={busy}
                  className="h-12 rounded-xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  Stop & Save
                </button>
              </>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <Link
              href="/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-[#153E90] px-3 py-2.5 text-center text-xs font-bold text-white hover:bg-blue-800"
            >
              Open Full Kairo
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={busy}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Logout
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
