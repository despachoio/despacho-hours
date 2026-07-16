"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

export type ShortcutPlatform = "mac" | "other";

export type ShortcutCombo = {
  code: string;
  key?: string;
  primary?: boolean;
  alt?: boolean;
  shift?: boolean;
  label: string;
  allowWhileTyping?: boolean;
};

export type ShortcutCommand = {
  id: string;
  label: string;
  category: string;
  handler: () => void;
  shortcut?: ShortcutCombo;
  disabled?: boolean;
};

type NavigationItem = {
  name: string;
  path: string;
  shortcutNumber: number;
};

type ShortcutContextValue = {
  platform: ShortcutPlatform;
  registerCommand: (command: ShortcutCommand) => () => void;
  openHelp: () => void;
  openPalette: () => void;
  formatShortcut: (combo: ShortcutCombo) => string;
};

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

function detectPlatform(): ShortcutPlatform {
  if (typeof navigator === "undefined") return "other";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? "mac" : "other";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"], .monaco-editor',
    ),
  );
}

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function lastVisible<T extends HTMLElement>(selector: string) {
  return Array.from(document.querySelectorAll<T>(selector)).filter(isVisible).at(-1);
}

function canActivateButton(button: HTMLButtonElement | undefined) {
  return Boolean(
    button &&
      !button.disabled &&
      isVisible(button) &&
      (!button.form || button.form.checkValidity()),
  );
}

function formatCombo(platform: ShortcutPlatform, combo: ShortcutCombo) {
  const parts: string[] = [];
  if (combo.primary) parts.push(platform === "mac" ? "⌘" : "Ctrl");
  if (combo.alt) parts.push(platform === "mac" ? "⌥" : "Alt");
  if (combo.shift) parts.push(platform === "mac" ? "⇧" : "Shift");
  parts.push(combo.label);
  return platform === "mac" ? parts.join("") : parts.join(" + ");
}

function isPrimaryPressed(event: KeyboardEvent, platform: ShortcutPlatform) {
  return platform === "mac"
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
}

function matchesCombo(
  event: KeyboardEvent,
  combo: ShortcutCombo,
  platform: ShortcutPlatform,
) {
  const primaryPressed = isPrimaryPressed(event, platform);
  return (
    (!combo.code || event.code === combo.code) &&
    (!combo.key || event.key.toLowerCase() === combo.key.toLowerCase()) &&
    Boolean(combo.primary) === primaryPressed &&
    Boolean(combo.alt) === event.altKey &&
    Boolean(combo.shift) === event.shiftKey
  );
}

function parentRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] === "invoices" && parts[1] === "recurring") {
    return "/invoices?tab=recurring";
  }
  if (["clients", "projects", "team", "invoices"].includes(parts[0])) {
    return `/${parts[0]}`;
  }
  return null;
}

type CreationCommand =
  | { label: string; path: string }
  | { label: string; event: string };

function creationFor(
  pathname: string,
  role: string,
  recurringInvoiceTab = false,
): CreationCommand | null {
  const isAdmin = role.trim().toLowerCase() === "admin";
  if (!isAdmin) return null;
  if (pathname.startsWith("/invoices/recurring")) {
    return { label: "New recurring schedule", path: "/invoices/recurring/new" };
  }
  if (pathname === "/invoices" && recurringInvoiceTab) {
    return { label: "New recurring schedule", path: "/invoices/recurring/new" };
  }
  if (pathname === "/invoices") {
    return { label: "New invoice", path: "/invoices/new" };
  }
  if (pathname === "/projects") return { label: "New project", path: "/projects/new" };
  if (pathname === "/clients") return { label: "New client", event: "kairo:new-client" };
  if (pathname === "/timer") return { label: "Add time entry", event: "kairo:manual-time" };
  return null;
}

function focusableElements(container: HTMLElement | null) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(isVisible);
}

export function ShortcutProvider({
  children,
  role,
  navigationItems,
}: {
  children: ReactNode;
  role: string;
  navigationItems: NavigationItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [platform, setPlatform] = useState<ShortcutPlatform>("other");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [registeredCommands, setRegisteredCommands] = useState<ShortcutCommand[]>([]);
  const [previousFocus, setPreviousFocus] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPlatform(detectPlatform()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const formatShortcut = useCallback(
    (combo: ShortcutCombo) => formatCombo(platform, combo),
    [platform],
  );

  const registerCommand = useCallback((command: ShortcutCommand) => {
    setRegisteredCommands((commands) => [
      ...commands.filter((item) => item.id !== command.id),
      command,
    ]);
    return () => {
      setRegisteredCommands((commands) =>
        commands.filter((item) => item.id !== command.id),
      );
    };
  }, []);

  const openPalette = useCallback(() => {
    setPreviousFocus(document.activeElement as HTMLElement | null);
    setHelpOpen(false);
    setQuery("");
    setActiveIndex(0);
    setPaletteOpen(true);
  }, []);

  const openHelp = useCallback(() => {
    setPreviousFocus(document.activeElement as HTMLElement | null);
    setPaletteOpen(false);
    setHelpOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setPaletteOpen(false);
    setHelpOpen(false);
    window.setTimeout(() => previousFocus?.focus(), 0);
  }, [previousFocus]);

  useEffect(() => {
    const openPaletteListener = () => openPalette();
    const openHelpListener = () => openHelp();
    window.addEventListener("kairo:open-palette", openPaletteListener);
    window.addEventListener("kairo:open-shortcuts", openHelpListener);
    return () => {
      window.removeEventListener("kairo:open-palette", openPaletteListener);
      window.removeEventListener("kairo:open-shortcuts", openHelpListener);
    };
  }, [openHelp, openPalette]);

  useEffect(() => {
    document
      .querySelectorAll("[data-shortcut-selected]")
      .forEach((row) => {
        row.removeAttribute("data-shortcut-selected");
        row.removeAttribute("aria-current");
      });
  }, [pathname]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const row = document.querySelector<HTMLElement>("[data-shortcut-selected]");
      if (row && (!document.contains(row) || !isVisible(row))) {
        row.removeAttribute("data-shortcut-selected");
        row.removeAttribute("aria-current");
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
    });
    return () => observer.disconnect();
  }, []);

  const recurringInvoiceTab =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("tab") === "recurring";
  const creation = creationFor(pathname, role, recurringInvoiceTab);

  const navigationCommands = useMemo<ShortcutCommand[]>(
    () =>
      navigationItems.map((item) => ({
        id: `nav.${item.path}`,
        label: item.name,
        category: "Navigate",
        shortcut: {
          code: `Digit${item.shortcutNumber}`,
          alt: true,
          label: String(item.shortcutNumber),
        },
        handler: () => router.push(item.path),
      })),
    [navigationItems, router],
  );

  const contextualCommands = (() => {
    const commands: ShortcutCommand[] = [];
    if (creation) {
      commands.push({
        id: "context.create",
        label: creation.label,
        category: "Create",
        shortcut: { code: "KeyN", label: "N" },
        handler: () => {
          if ("path" in creation) router.push(creation.path);
          else window.dispatchEvent(new CustomEvent(creation.event));
        },
      });
    }
    if (
      typeof document !== "undefined" &&
      lastVisible<HTMLElement>("[data-shortcut-search]")
    ) {
      commands.push({
        id: "context.search",
        label: "Focus page search",
        category: "Page",
        shortcut: { code: "Slash", label: "/" },
        handler: () => lastVisible<HTMLElement>("[data-shortcut-search]")?.focus(),
      });
    }
    const parent = parentRoute(pathname);
    if (parent) {
      commands.push({
        id: "context.back",
        label: "Back to list",
        category: "Page",
        shortcut: { code: "Backspace", label: "Backspace" },
        handler: () => router.push(parent),
      });
    }
    commands.push({
      id: "context.help",
      label: "Keyboard shortcuts",
      category: "Help",
      shortcut: { code: "Slash", key: "?", shift: true, label: "?" },
      handler: openHelp,
    });
    return commands;
  })();

  const selectRow = useCallback((direction: 1 | -1) => {
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-shortcut-row]"),
    ).filter(isVisible);
    if (!rows.length) return false;
    const current = document.querySelector<HTMLElement>("[data-shortcut-selected]");
    const currentIndex = current ? rows.indexOf(current) : -1;
    const nextIndex =
      currentIndex < 0
        ? direction > 0
          ? 0
          : rows.length - 1
        : Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
    current?.removeAttribute("data-shortcut-selected");
    current?.removeAttribute("aria-current");
    const nextRow = rows[nextIndex];
    nextRow.setAttribute("data-shortcut-selected", "true");
    nextRow.setAttribute("aria-current", "true");
    nextRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return true;
  }, []);

  const activateSelectedRow = useCallback((edit = false) => {
    const row = document.querySelector<HTMLElement>("[data-shortcut-selected]");
    if (!row || !document.contains(row)) return false;
    const href = edit ? row.dataset.shortcutEditHref : row.dataset.shortcutHref;
    if (href) {
      router.push(href);
      return true;
    }
    const control = row.querySelector<HTMLElement>(
      edit ? "[data-shortcut-edit]" : "[data-shortcut-open]",
    );
    if (!control || !isVisible(control)) return false;
    control.click();
    return true;
  }, [router]);

  const generalCommands = (() => {
    const commands: ShortcutCommand[] = [
      {
        id: "general.palette",
        label: "Open command palette",
        category: "General",
        shortcut: { code: "KeyK", primary: true, label: "K", allowWhileTyping: true },
        handler: openPalette,
      },
    ];
    if (typeof document === "undefined") return commands;
    if (lastVisible<HTMLElement>("[data-shortcut-save]")) {
      commands.push({
        id: "general.save",
        label: "Save form or draft",
        category: "General",
        shortcut: { code: "KeyS", primary: true, label: "S" },
        handler: () => {
          const button = lastVisible<HTMLButtonElement>("[data-shortcut-save]");
          if (canActivateButton(button)) button!.click();
        },
      });
    }
    if (lastVisible<HTMLElement>("[data-shortcut-primary]")) {
      commands.push({
        id: "general.primary",
        label: "Complete primary action",
        category: "General",
        shortcut: { code: "Enter", primary: true, label: "Enter" },
        handler: () => {
          const button = lastVisible<HTMLButtonElement>("[data-shortcut-primary]");
          if (canActivateButton(button)) button!.click();
        },
      });
    }
    if (lastVisible<HTMLElement>("[data-shortcut-row]")) {
      commands.push(
        { id: "list.next", label: "Select next row", category: "List", shortcut: { code: "KeyJ", label: "J / ↓" }, handler: () => void selectRow(1) },
        { id: "list.previous", label: "Select previous row", category: "List", shortcut: { code: "KeyK", label: "K / ↑" }, handler: () => void selectRow(-1) },
        { id: "list.open", label: "Open selected row", category: "List", shortcut: { code: "Enter", label: "Enter" }, handler: () => void activateSelectedRow() },
      );
      if (lastVisible<HTMLElement>("[data-shortcut-edit-href], [data-shortcut-edit]")) {
        commands.push({
          id: "list.edit",
          label: "Edit selected row",
          category: "List",
          shortcut: { code: "KeyE", label: "E" },
          handler: () => void activateSelectedRow(true),
        });
      }
    }
    if (lastVisible<HTMLElement>("[data-shortcut-export]")) {
      commands.push({
        id: "list.export",
        label: "Export current list",
        category: "List",
        shortcut: { code: "KeyE", shift: true, label: "E" },
        handler: () => {
          const button = lastVisible<HTMLButtonElement>("[data-shortcut-export]");
          if (canActivateButton(button)) button!.click();
        },
      });
    }
    return commands;
  })();

  const availableCommands = useMemo(
    () =>
      [...navigationCommands, ...generalCommands, ...contextualCommands, ...registeredCommands].filter(
        (command) => !command.disabled,
      ),
    [contextualCommands, generalCommands, navigationCommands, registeredCommands],
  );

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? availableCommands.filter((command) =>
          `${command.label} ${command.category}`.toLowerCase().includes(normalized),
        )
      : availableCommands;
  }, [availableCommands, query]);

  const resolvedActiveIndex = filteredCommands.length
    ? Math.min(activeIndex, filteredCommands.length - 1)
    : 0;

  const runCommand = useCallback(
    (command: ShortcutCommand | undefined) => {
      if (!command || command.disabled) return false;
      closeOverlay();
      command.handler();
      return true;
    },
    [closeOverlay],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      const typing = isEditableTarget(event.target);
      const primary = isPrimaryPressed(event, platform);

      if (primary && event.code === "KeyK" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (paletteOpen) closeOverlay();
        else openPalette();
        return;
      }

      if (paletteOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeOverlay();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((index) =>
            filteredCommands.length
              ? (index + direction + filteredCommands.length) % filteredCommands.length
              : 0,
          );
        } else if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          runCommand(filteredCommands[resolvedActiveIndex]);
        }
        return;
      }

      if (helpOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeOverlay();
        }
        return;
      }

      if (event.key === "Escape") {
        const topmostCloser = lastVisible<HTMLElement>("[data-shortcut-overlay-close]");
        if (topmostCloser) {
          event.preventDefault();
          event.stopPropagation();
          topmostCloser.click();
          return;
        }
        const escapeCommand = availableCommands.find(
          (command) => command.shortcut?.code === "Escape",
        );
        if (escapeCommand) {
          event.preventDefault();
          event.stopPropagation();
          runCommand(escapeCommand);
        }
        return;
      }
      if (typing) return;

      const fallbackHandledCommands = new Set([
        "context.create",
        "context.search",
        "general.save",
        "general.primary",
        "list.next",
        "list.previous",
        "list.open",
        "list.edit",
        "list.export",
      ]);
      const registered = availableCommands.find(
        (command) =>
          !fallbackHandledCommands.has(command.id) &&
          command.shortcut &&
          matchesCombo(event, command.shortcut, platform),
      );
      if (registered && !event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        runCommand(registered);
        return;
      }

      if (!primary && !event.altKey && !event.shiftKey && event.code === "KeyN") {
        const currentCreation = creationFor(
          pathname,
          role,
          new URLSearchParams(window.location.search).get("tab") === "recurring",
        );
        if (currentCreation && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          if ("path" in currentCreation) router.push(currentCreation.path);
          else window.dispatchEvent(new CustomEvent(currentCreation.event));
        }
        return;
      }

      if (!primary && !event.altKey && !event.shiftKey && event.code === "Slash") {
        const searchTarget = lastVisible<HTMLElement>("[data-shortcut-search]");
        if (searchTarget && isVisible(searchTarget)) {
          event.preventDefault();
          event.stopPropagation();
          searchTarget.focus();
        }
        return;
      }

      if (primary && !event.altKey && event.code === "KeyS") {
        const save = lastVisible<HTMLButtonElement>("[data-shortcut-save]");
        if (canActivateButton(save) && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          save!.click();
        }
        return;
      }

      if (primary && !event.altKey && event.code === "Enter") {
        const submit = lastVisible<HTMLButtonElement>("[data-shortcut-primary]");
        if (canActivateButton(submit) && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          submit!.click();
        }
        return;
      }

      if (!primary && !event.altKey && !event.shiftKey) {
        if (event.code === "KeyJ" || event.code === "ArrowDown") {
          if (selectRow(1)) {
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.code === "KeyK" || event.code === "ArrowUp") {
          if (selectRow(-1)) {
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.code === "Enter") {
          if (activateSelectedRow()) {
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.code === "KeyE") {
          if (activateSelectedRow(true)) {
            event.preventDefault();
            event.stopPropagation();
          }
        } else if (event.code === "Backspace") {
          const parent = parentRoute(pathname);
          if (parent) {
            event.preventDefault();
            event.stopPropagation();
            router.push(parent);
          }
        }
      }

      if (!primary && !event.altKey && event.shiftKey && event.code === "KeyE") {
        const exportButton = lastVisible<HTMLButtonElement>("[data-shortcut-export]");
        if (canActivateButton(exportButton)) {
          event.preventDefault();
          event.stopPropagation();
          exportButton!.click();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    activateSelectedRow,
    availableCommands,
    closeOverlay,
    filteredCommands,
    helpOpen,
    openPalette,
    paletteOpen,
    pathname,
    platform,
    resolvedActiveIndex,
    role,
    router,
    runCommand,
    selectRow,
  ]);

  function trapDialogFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialogRef.current);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const contextValue = useMemo<ShortcutContextValue>(
    () => ({ platform, registerCommand, openHelp, openPalette, formatShortcut }),
    [formatShortcut, openHelp, openPalette, platform, registerCommand],
  );

  return (
    <ShortcutContext.Provider value={contextValue}>
      {children}
      {paletteOpen ? (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/55 px-4 pt-[12vh] backdrop-blur-sm" role="presentation">
          <button className="absolute inset-0" aria-label="Close command palette" onClick={closeOverlay} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
            onKeyDown={trapDialogFocus}
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <h2 id="command-palette-title" className="sr-only">Kairo command palette</h2>
            <div className="border-b border-slate-200 p-4">
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search Kairo commands…"
                aria-label="Search commands"
                role="combobox"
                aria-expanded="true"
                aria-controls="kairo-command-list"
                aria-activedescendant={filteredCommands[resolvedActiveIndex]?.id}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 text-base outline-none focus:border-[#153E90] focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <div id="kairo-command-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
              {filteredCommands.length ? filteredCommands.map((command, index) => (
                <button
                  id={command.id}
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === resolvedActiveIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runCommand(command)}
                  className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left ${index === resolvedActiveIndex ? "bg-blue-50 text-[#153E90]" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{command.label}</span>
                    <span className="text-xs text-slate-400">{command.category}</span>
                  </span>
                  {command.shortcut ? <ShortcutKey>{formatShortcut(command.shortcut)}</ShortcutKey> : null}
                </button>
              )) : <p className="px-5 py-10 text-center text-sm text-slate-500">No matching commands.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              <span>↑↓ Select · Enter Run · Esc Close</span>
              <button type="button" onClick={openHelp} className="font-bold text-[#153E90] hover:underline">Keyboard shortcuts</button>
            </div>
          </div>
        </div>
      ) : null}
      {helpOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <button className="absolute inset-0" aria-label="Close keyboard shortcuts" onClick={closeOverlay} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcut-help-title"
            onKeyDown={trapDialogFocus}
            className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#153E90]">Kairo productivity</p><h2 id="shortcut-help-title" className="mt-1 text-2xl font-bold text-slate-950">Keyboard shortcuts</h2></div>
              <button autoFocus type="button" onClick={closeOverlay} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close keyboard shortcuts">×</button>
            </div>
            <div className="mt-6 max-h-[65vh] space-y-5 overflow-y-auto pr-1">
              {Array.from(new Set(availableCommands.map((command) => command.category))).map((category) => (
                <section key={category}>
                  <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{category}</h3>
                  <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200">
                    {availableCommands.filter((command) => command.category === category && command.shortcut).map((command) => (
                      <div key={command.id} className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm font-semibold text-slate-700">{command.label}</span><ShortcutKey>{formatShortcut(command.shortcut!)}</ShortcutKey></div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </ShortcutContext.Provider>
  );
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return <kbd className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-bold text-slate-600 shadow-sm">{children}</kbd>;
}

export function useShortcutCommand(command: ShortcutCommand) {
  const context = useContext(ShortcutContext);
  const handlerRef = useRef(command.handler);
  useEffect(() => {
    handlerRef.current = command.handler;
  }, [command.handler]);
  const { id, label, category, shortcut, disabled } = command;
  const shortcutCode = shortcut?.code;
  const shortcutKey = shortcut?.key;
  const shortcutPrimary = shortcut?.primary;
  const shortcutAlt = shortcut?.alt;
  const shortcutShift = shortcut?.shift;
  const shortcutLabel = shortcut?.label;
  const shortcutAllowWhileTyping = shortcut?.allowWhileTyping;

  useEffect(() => {
    if (!context) return;
    return context.registerCommand({
      id,
      label,
      category,
      shortcut: shortcutCode
        ? {
            code: shortcutCode,
            key: shortcutKey,
            primary: shortcutPrimary,
            alt: shortcutAlt,
            shift: shortcutShift,
            label: shortcutLabel || shortcutCode,
            allowWhileTyping: shortcutAllowWhileTyping,
          }
        : undefined,
      disabled,
      handler: () => handlerRef.current(),
    });
  }, [
    category,
    context,
    disabled,
    id,
    label,
    shortcutAllowWhileTyping,
    shortcutAlt,
    shortcutCode,
    shortcutKey,
    shortcutLabel,
    shortcutPrimary,
    shortcutShift,
  ]);
}

export function OpenShortcutHelpButton({ className }: { className?: string }) {
  const context = useContext(ShortcutContext);
  return (
    <button type="button" role="menuitem" onClick={context?.openHelp} className={className}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-.9.55-1.5 1.05-1.5 2M12 17h.01" /></svg>
      Keyboard shortcuts
    </button>
  );
}
