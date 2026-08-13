import "server-only";

import { randomUUID } from "node:crypto";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";

export async function encryptEmployeePdf(pdfBytes: Buffer | Uint8Array, password: string) {
  try {
    const protectedBytes = await encryptPDF(new Uint8Array(pdfBytes), password, {
      ownerPassword: randomUUID(),
      allowModifying: false,
      allowCopying: false,
      allowAnnotating: false,
      allowAssembly: false,
    });
    return Buffer.from(protectedBytes);
  } catch {
    throw new Error("Unable to secure this PDF. No unprotected document was generated.");
  }
}
