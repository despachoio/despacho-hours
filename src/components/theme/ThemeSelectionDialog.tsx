"use client";

import { useEffect, useRef, useState } from "react";
import { KAIRO_THEMES, DEFAULT_KAIRO_THEME } from "@/lib/themes/theme-config";
import type { KairoThemeDefinition, KairoThemeId } from "@/lib/themes/theme-types";
import { useKairoTheme } from "./KairoThemeProvider";

function ThemePreviewCard({ definition, selected, onSelect }: { definition: KairoThemeDefinition; selected: boolean; onSelect: () => void }) {
  const { palette } = definition;
  return <button type="button" role="radio" aria-checked={selected} aria-label={`${definition.name} theme`} onClick={onSelect} className={`group relative overflow-hidden rounded-2xl border-2 bg-white p-3 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-4 ${selected ? "border-[var(--kairo-primary)] ring-2 ring-[var(--kairo-focus-ring)]" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}>
    <span className="block overflow-hidden rounded-xl border border-slate-200" aria-hidden="true">
      <span className="block h-12 p-2" style={{ background: `linear-gradient(135deg, ${palette.heroStart}, ${palette.heroEnd})` }}><span className="block h-2 w-16 rounded-full bg-white/90"/><span className="mt-1.5 block h-1.5 w-24 rounded-full bg-white/45"/></span>
      <span className="flex gap-1.5 bg-white p-2"><span className="rounded-md px-2 py-1 text-[8px] font-bold text-white" style={{ backgroundColor: palette.activeTab }}>Active tab</span><span className="rounded-md bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500">Overview</span></span>
      <span className="flex items-center justify-between p-2" style={{ backgroundColor: palette.pastel }}><span className="h-6 w-16 rounded-lg bg-white shadow-sm"/><span className="rounded-md px-2 py-1 text-[8px] font-bold text-white" style={{ backgroundColor: palette.primary }}>Button</span></span>
    </span>
    <span className="mt-3 flex items-start justify-between gap-2"><span><span className="block text-sm font-bold text-slate-900">{definition.name}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{definition.description}</span></span><span aria-hidden="true" className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${selected ? "border-[var(--kairo-primary)] bg-[var(--kairo-primary)] text-white" : "border-slate-300 text-transparent"}`}>✓</span></span>
  </button>;
}

function ThemeSelectionDialogContent({ onClose }: { onClose: () => void }) {
  const { savedTheme, previewTheme, restoreSavedTheme, saveTheme } = useKairoTheme();
  const [selected, setSelected] = useState<KairoThemeId>(savedTheme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []);
    requestAnimationFrame(() => focusable()[0]?.focus());
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) { restoreSavedTheme(); onClose(); return; }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [onClose, restoreSavedTheme, saving]);
  function choose(theme: KairoThemeId) { setSelected(theme); setError(""); previewTheme(theme); }
  function cancel() { if (saving) return; restoreSavedTheme(); onClose(); }
  async function apply() {
    if (saving) return;
    setSaving(true); setError("");
    try { await saveTheme(selected); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save your theme preference."); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
    <button type="button" aria-label="Cancel theme selection" onClick={cancel} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"/>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="theme-dialog-title" aria-describedby="theme-dialog-description" className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[var(--kairo-border-accent)] bg-white shadow-2xl">
      <header className="border-b border-slate-200 bg-gradient-to-r from-[var(--kairo-accent-soft)] via-white to-[var(--kairo-card-accent)] px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--kairo-primary)]">Workspace appearance</p><h2 id="theme-dialog-title" className="mt-2 text-2xl font-bold text-[var(--kairo-heading)]">Personalize Your Kairo</h2><p id="theme-dialog-description" className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Choose a color theme that matches your style. Your selection will be applied across your Kairo workspace.</p></div><button type="button" onClick={cancel} disabled={saving} aria-label="Close theme dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-slate-500 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">×</button></div>
      </header>
      <div className="overflow-y-auto p-5 sm:p-7"><div role="radiogroup" aria-label="Kairo themes" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{KAIRO_THEMES.map((definition) => <ThemePreviewCard key={definition.id} definition={definition} selected={selected === definition.id} onSelect={() => choose(definition.id)}/>)}</div>{error ? <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}</div>
      <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><button type="button" disabled={saving} onClick={() => choose(DEFAULT_KAIRO_THEME)} className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">Reset to Default</button><div className="flex gap-3"><button type="button" disabled={saving} onClick={cancel} className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:flex-none">Cancel</button><button type="button" disabled={saving} onClick={() => void apply()} className="flex-1 rounded-xl bg-[var(--kairo-primary)] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-[var(--kairo-primary-hover)] disabled:cursor-wait disabled:bg-slate-300 sm:flex-none">{saving ? "Applying..." : "Apply Theme"}</button></div></footer>
    </section>
  </div>;
}

export default function ThemeSelectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <ThemeSelectionDialogContent onClose={onClose} /> : null;
}
