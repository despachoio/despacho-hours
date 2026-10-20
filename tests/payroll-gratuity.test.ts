import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateGratuityEstimate, GRATUITY_CEILING } from "../src/lib/payroll/gratuity";

const profile = (values: Partial<Parameters<typeof calculateGratuityEstimate>[0]> = {}) => ({
  dateOfJoining: "2020-01-15",
  employmentRole: "employee",
  basicPay: 40_000,
  grossSalary: 100_000,
  asOfDate: "2025-01-15",
  ...values,
});

describe("informational gratuity estimate", () => {
  it("becomes eligible on completion of five years", () => {
    const before = calculateGratuityEstimate(profile({ asOfDate: "2025-01-14" }));
    const eligible = calculateGratuityEstimate(profile());

    expect(before.eligible).toBe(false);
    expect(before.payableEstimate).toBe(0);
    expect(eligible.eligible).toBe(true);
    expect(eligible.completedMonths).toBe(60);
    expect(eligible.payableEstimate).toBe(144_231);
  });

  it("counts a partial service year only when it exceeds six months", () => {
    expect(calculateGratuityEstimate(profile({ asOfDate: "2025-07-15" })).countedServiceYears).toBe(5);
    expect(calculateGratuityEstimate(profile({ asOfDate: "2025-08-15" })).countedServiceYears).toBe(6);
  });

  it("uses the 50 percent wage floor when basic pay is lower", () => {
    const estimate = calculateGratuityEstimate(profile());
    expect(estimate.wageBasis).toBe(50_000);
  });

  it("shows accrued value but no payable estimate before regular eligibility", () => {
    const estimate = calculateGratuityEstimate(profile({ asOfDate: "2024-08-15" }));
    expect(estimate.eligible).toBe(false);
    expect(estimate.accruedEstimate).toBeGreaterThan(0);
    expect(estimate.payableEstimate).toBe(0);
  });

  it("applies the statutory ceiling", () => {
    const estimate = calculateGratuityEstimate(profile({ dateOfJoining: "1990-01-15", basicPay: 500_000, grossSalary: 1_000_000 }));
    expect(estimate.accruedEstimate).toBe(GRATUITY_CEILING);
    expect(estimate.capped).toBe(true);
  });

  it("does not present the regular-employee estimate for contractors", () => {
    const estimate = calculateGratuityEstimate(profile({ employmentRole: "contractor" }));
    expect(estimate.coveredEmployment).toBe(false);
    expect(estimate.eligible).toBe(false);
    expect(estimate.payableEstimate).toBe(0);
  });

  it("loads only the signed-in employee profile and an effective salary structure", () => {
    const server = readFileSync("src/lib/payroll/server.ts", "utf8");
    const workspace = readFileSync("src/components/payroll/PayrollWorkspace.tsx", "utf8");

    expect(server).toContain('.from("employees").select("date_of_joining,role").eq("id", actor.employeeId)');
    expect(server).toContain('.from("salary_structures").select("basic_pay,gross_salary,effective_from,version").eq("employee_id", actor.employeeId).lte("effective_from", asOfDate)');
    expect(workspace).toContain("Estimated Gratuity");
    expect(workspace).toContain("informational estimate—not a guaranteed settlement");
  });
});
