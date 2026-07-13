import PaymentResultPage from "@/components/payments/PaymentResultPage";

export default async function InvoicePaymentResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PaymentResultPage token={token} />;
}
