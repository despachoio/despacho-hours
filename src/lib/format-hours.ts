export function formatDecimalHours(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) return "00:00";

  const sign = numericValue < 0 ? "-" : "";
  const totalMinutes = Math.round(Math.abs(numericValue) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
