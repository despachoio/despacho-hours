import { describe, expect, it } from "vitest";
import { compareEmployeeCodes, employeeOptionLabel } from "@/lib/time-off/employee-order";

describe("Time Off employee ordering", () => {
  it("sorts employee codes naturally instead of lexicographically", () => {
    const employees = [
      { code: "10010", name: "Ten" },
      { code: "1002", name: "Two" },
      { code: "10001", name: "One" },
    ];
    employees.sort((left, right) => compareEmployeeCodes(left.code, right.code, left.name, right.name));
    expect(employees.map((employee) => employee.code)).toEqual(["1002", "10001", "10010"]);
  });

  it("places missing codes last and uses names as a stable tie-breaker", () => {
    const employees = [
      { code: null, name: "Aaron" },
      { code: "1001", name: "Zara" },
      { code: "1001", name: "Asha" },
    ];
    employees.sort((left, right) => compareEmployeeCodes(left.code, right.code, left.name, right.name));
    expect(employees.map((employee) => employee.name)).toEqual(["Asha", "Zara", "Aaron"]);
  });

  it("formats dropdown labels with employee code first", () => {
    expect(employeeOptionLabel("10007", "Ms. Aarthi J")).toBe("10007 · Ms. Aarthi J");
  });
});
