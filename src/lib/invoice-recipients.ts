const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function invoiceRecipientEmails(value: string | null | undefined) {
  if (!value) return [];

  return Array.from(
    new Set(
      value
        .split(/[;,]/)
        .map((item) => item.trim())
        .map((item) => item.match(/<([^<>]+)>$/)?.[1]?.trim() || item)
        .filter((item) => EMAIL_PATTERN.test(item))
        .map((item) => item.toLowerCase()),
    ),
  );
}

export function invoiceReceiptEmail(value: string | null | undefined) {
  return invoiceRecipientEmails(value)[0];
}
