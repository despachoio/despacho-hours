import InvoicePaymentPage from "@/components/payments/InvoicePaymentPage";

export default async function PayInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvoicePaymentPage token={token} />;
}
