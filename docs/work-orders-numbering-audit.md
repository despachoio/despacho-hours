# Work Order numbering audit

The implementation does not assume that `max(work_orders) + 1` is safe. At reservation time, the database takes a transaction-scoped advisory lock and calculates the highest occupied sequence across:

- Work Order reservations
- Work Orders
- `clients.business_client_id` values in the `1001..9999` business range
- four-digit values found in existing project codes
- the known supplied reference floor (`0095` / customer `1095`)

It then reserves the next Work Order number and, for a new client only, derives `Customer ID = 1000 + Work Order sequence`. Unique indexes provide final collision protection. Existing clients receive a new Work Order number but retain their existing business client ID.

No legacy rows are modified. The live highest sequence, gaps, and conflicts are deliberately evaluated inside the reservation transaction after migration deployment, rather than inferred from repository fixtures. Project codes remain manually entered during onboarding because the current Projects module has no canonical automatic code generator; Work Orders must not invent one.
