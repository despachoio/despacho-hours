# Stripe Test Mode setup

Kairo’s browser never marks an invoice paid. A verified Stripe webhook calls
`public.record_stripe_invoice_payment`, which atomically records the payment,
marks the invoice paid, and writes the Service Wallet credits.

## Environment variables

Add these to `.env.local` for local Test Mode:

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Keep `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` server-only. Never add a
`NEXT_PUBLIC_` prefix to either secret.

## Database

Apply `supabase/migrations/202607130001_stripe_invoice_payments.sql` to the
hosted Supabase project, followed by
`supabase/migrations/202607130002_stripe_payment_reconciliation.sql`. Creating
local migration files does not apply them remotely.

If `202607130002_stripe_payment_reconciliation.sql` was applied before the
self-healing reconciliation update, run its current complete contents again.
The migration is idempotent and its `CREATE OR REPLACE FUNCTION` updates the
hosted RPC used to mark stuck successful payments Paid and fill only missing
wallet-credit rows.

## Local webhook forwarding

Install and authenticate Stripe CLI, then run:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the displayed `whsec_...` value into `STRIPE_WEBHOOK_SECRET` and restart
the Next.js server.

Select/forward these events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_intent.processing`
- `payment_intent.canceled`

## Test payment

Send a Kairo invoice, open its public Pay Invoice link, and use Stripe’s Test
Mode card `4242 4242 4242 4242`, any future expiry, and any CVC/postal code.
Use Stripe’s documented authentication/failure test cards for additional
scenarios.

Verify that exactly one completed `payments` row and one `invoice_credit` row
per billable invoice item are created, even when the webhook event is resent.

## Existing duplicate successful charges

The reconciliation fix does not automatically refund historical duplicate
Stripe charges. Before applying the new completed-payment uniqueness index,
identify invoices with more than one successful Stripe payment:

```sql
select invoice_id, count(*) as completed_stripe_payments,
       array_agg(stripe_payment_intent_id order by created_at) as payment_intents
from public.payments
where source in ('stripe', 'autopay')
  and status = 'completed'
group by invoice_id
having count(*) > 1;
```

For each result, compare the PaymentIntent IDs and charge amounts in Stripe
Dashboard. Refund the duplicate charge from Stripe Dashboard, then record the
administrative correction according to your accounting process. Do not create
additional Service Wallet credits for the duplicate. If existing duplicate
rows prevent the unique index from being created, resolve those rows only
after the Stripe refund and an accounting review; do not delete payment or
wallet history blindly.

## Going live

1. Complete Stripe account activation and webhook security review.
2. Replace `pk_test_`/`sk_test_` with matching Live Mode keys using the hosting
   provider’s encrypted environment settings.
3. Create a Live Mode webhook endpoint for `/api/stripe/webhook` and replace
   the webhook signing secret.
4. Set `NEXT_PUBLIC_APP_URL` to the production HTTPS origin.
5. Restart/redeploy and perform a low-value production verification.

Never copy Test Mode customer or PaymentMethod IDs into Live Mode.
