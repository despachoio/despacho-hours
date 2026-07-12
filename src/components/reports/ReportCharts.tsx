"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartDatum, DailyDatum } from "./types";
import { formatDate } from "./utils";

export function HoursBarChart({
  title,
  data,
}: {
  title: string;
  data: ChartDatum[];
}) {
  return (
    <ChartCard title={title}>
      {data.length ? (
        <ResponsiveContainer
          width="100%"
          height={Math.max(280, data.length * 42)}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 12, right: 24 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              horizontal={false}
              stroke="#E2E8F0"
            />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [
                `${Number(value).toFixed(2)} hrs`,
                "Hours",
              ]}
            />
            <Bar dataKey="hours" fill="#153E90" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty />
      )}
    </ChartCard>
  );
}

export function DailyTrendChart({ data }: { data: DailyDatum[] }) {
  return (
    <ChartCard title="Daily Hours Trend">
      {data.length ? (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data} margin={{ left: 0, right: 16 }}>
            <defs>
              <linearGradient id="reportHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#153E90" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#153E90" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                formatDate(value).replace(/\s\d{4}$/, "")
              }
              tick={{ fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={(value) => formatDate(String(value))}
              formatter={(value) => [
                `${Number(value).toFixed(2)} hrs`,
                "Hours",
              ]}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="#153E90"
              strokeWidth={2.5}
              fill="url(#reportHours)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <ChartEmpty />
      )}
    </ChartCard>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-950">{title}</h3>
      <div className="mt-5">{children}</div>
    </article>
  );
}
function ChartEmpty() {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-400">
      No chart data for this period.
    </div>
  );
}
