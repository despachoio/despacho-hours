import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  invoiceReceiptEmail,
  invoiceRecipientEmails,
} from "../src/lib/invoice-recipients";

const source = (path: string) => readFileSync(path, "utf8");

describe("Public invoice payment", () => {
  it("accepts comma- and semicolon-separated invoice recipients", () => {
    expect(
      invoiceRecipientEmails(
        "first@example.com; second@example.com, THIRD@example.com",
      ),
    ).toEqual([
      "first@example.com",
      "second@example.com",
      "third@example.com",
    ]);
    expect(
      invoiceReceiptEmail("first@example.com;second@example.com"),
    ).toBe("first@example.com");
  });

  it("ignores malformed receipt addresses instead of blocking payment", () => {
    expect(invoiceReceiptEmail("not-an-email; valid@example.com")).toBe(
      "valid@example.com",
    );
    expect(invoiceReceiptEmail("not-an-email")).toBeUndefined();
  });

  it("shows a retryable error when PaymentIntent preparation fails", () => {
    const page = source("src/components/payments/InvoicePaymentPage.tsx");
    expect(page).toContain("Unable to prepare secure payment");
    expect(page).toContain('onClick={() => void preparePayment(false)}');
    expect(page).toContain('setError("Unable to prepare secure payment. Please try again.")');
  });
});
