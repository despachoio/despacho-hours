export function compareEmployeeCodes(
  leftCode: string | null | undefined,
  rightCode: string | null | undefined,
  leftName = "",
  rightName = "",
) {
  const left = String(leftCode || "").trim();
  const right = String(rightCode || "").trim();
  if (!left && right) return 1;
  if (left && !right) return -1;
  const codeOrder = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return codeOrder || leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
}

export function employeeOptionLabel(
  code: string | null | undefined,
  name: string,
) {
  return code ? `${code} · ${name}` : name;
}
