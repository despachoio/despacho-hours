import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getTimerWorkDate } from "@/lib/timer/work-date";

const migration = readFileSync(
  "supabase/migrations/202608230001_timer_work_date_leave_integration.sql",
  "utf8",
);
const browserTimer = readFileSync("src/app/(app)/timer/page.tsx", "utf8");
const desktopTimer = readFileSync("src/app/desktop-timer/page.tsx", "utf8");

describe("timer work-date and approved-leave integration", () => {
  it("keeps Vijey's 20 August overnight timer on its original work date", () => {
    const timer = {
      started_at: "2026-08-20T12:00:00.000Z", // 17:30 Asia/Kolkata
      work_date: "2026-08-20",
    };

    expect(getTimerWorkDate(timer)).toBe("2026-08-20");
  });

  it("uses the business timezone during a migration rollout fallback", () => {
    expect(
      getTimerWorkDate({
        started_at: "2026-08-20T19:30:00.000Z", // 01:00 on 21 August IST
      }),
    ).toBe("2026-08-21");
  });

  it("assigns and preserves the work date at the database boundary", () => {
    expect(migration).toContain(
      "new.work_date := (new.started_at at time zone 'Asia/Kolkata')::date",
    );
    expect(migration).toContain("new.work_date := old.work_date");
    expect(migration).toContain("day.leave_date = new.work_date");
    expect(migration).toContain(
      "You have approved leave for this work date and cannot start a timer.",
    );
  });

  it("uses the stable work date in every timer completion path", () => {
    expect(migration.match(/v_timer\.work_date/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).not.toContain(
      "(v_stopped_at at time zone 'Asia/Kolkata')::date",
    );
    expect(browserTimer.match(/entry_date: getTimerWorkDate\(latestTimer\)/g))
      .toHaveLength(2);
    expect(browserTimer).not.toContain("entry_date: stoppedAt.slice(0, 10)");
  });

  it("keeps desktop and browser starts behind the same database trigger", () => {
    expect(migration).toContain("before insert on public.active_timers");
    expect(browserTimer).toContain('.from("active_timers")');
    expect(desktopTimer).toContain('supabase.rpc("start_own_timer"');
    expect(desktopTimer).toContain('supabase.rpc("start_own_desktop_timer"');
  });

  it("does not invent an unsupported overnight cutoff", () => {
    expect(migration).not.toMatch(/interval '\d+ hours?'/i);
    expect(migration).not.toMatch(/extract\s*\(\s*hour/i);
  });
});
