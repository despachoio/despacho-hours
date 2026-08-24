/**
 * Provider-neutral signature metadata for the Work Order lifecycle.
 *
 * Kairo currently records manual Sent/Signed milestones. A future DocuSign
 * adapter can implement this interface without changing Work Order business
 * rules, document snapshots, or access control. No external signature call is
 * made by the current implementation.
 */
export type SignatureEnvelopeState =
  | "created"
  | "sent"
  | "completed"
  | "declined"
  | "voided";

export type SignatureEnvelopeReference = {
  provider: "docusign";
  envelopeId: string;
  state: SignatureEnvelopeState;
  signedDocumentPath?: string;
};

export interface WorkOrderSignatureProvider {
  createEnvelope(
    workOrderId: string,
    versionId: string,
  ): Promise<SignatureEnvelopeReference>;
  getEnvelope(envelopeId: string): Promise<SignatureEnvelopeReference>;
  voidEnvelope(
    envelopeId: string,
    reason: string,
  ): Promise<SignatureEnvelopeReference>;
}
