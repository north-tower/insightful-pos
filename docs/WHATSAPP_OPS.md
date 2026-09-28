# WhatsApp shop ops (staff)

Staff can record sales, check customer credit, and take payments on account from WhatsApp when the shop uses the **pos_ops** tenant flow on whatsapp3.

## Setup

1. Apply migration `059_whatsapp_ops.sql` to your Supabase project.
2. Deploy the Edge Function (from repo root `insightful-pos`):

   ```sh
   # One-time: install CLI https://supabase.com/docs/guides/cli
   supabase login
   supabase link --project-ref <your-project-ref>

   # Shared secret (same value goes in whatsapp3 INSIGHTFUL_POS_API_KEY)
   supabase secrets set WHATSAPP_OPS_API_KEY=<long-random-secret>

   # whatsapp3 calls with Bearer API key, not a Supabase user JWT
   supabase functions deploy whatsapp-ops --no-verify-jwt
   ```

   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in the cloud; you only set `WHATSAPP_OPS_API_KEY`.

   **URL for whatsapp3:** `https://<project-ref>.supabase.co/functions/v1/whatsapp-ops`

   **Dashboard alternative:** Edge Functions → create/upload is possible, but the CLI above matches `supabase/functions/whatsapp-ops/index.ts` in this repo.

   **Smoke test** (replace ref and secret):

   ```sh
   curl -X POST "https://<project-ref>.supabase.co/functions/v1/whatsapp-ops" \
     -H "Authorization: Bearer <WHATSAPP_OPS_API_KEY>" \
     -H "Content-Type: application/json" \
     -d "{\"action\":\"identify\",\"phone\":\"+2547XXXXXXXX\"}"
   ```

   Expect `403` with `"authorised":false` until the phone is in `whatsapp_staff_links`.
3. Link staff phones (E.164, e.g. `+254712345678`):

   - **In the app (recommended):** Settings → Admin Controls → **WhatsApp staff access** (`/admin/whatsapp-staff`). Pick the staff user, branch used for WhatsApp sales, and the phone that messages the shop line.
   - **SQL alternative:**

```sql
INSERT INTO whatsapp_staff_links (phone, profile_id, store_id, enabled)
VALUES ('+254712345678', '<profile-uuid>', '<store-uuid>', true);
```

4. On whatsapp3, create a tenant with flow **pos_ops**, pair WhatsApp, and set:

```
INSIGHTFUL_POS_BASE_URL=https://<project>.supabase.co/functions/v1/whatsapp-ops
INSIGHTFUL_POS_API_KEY=<same secret>
TENANT_FLOW=pos_ops
```

5. Message the linked shop number from a linked phone and follow the numbered menu.

## Commands

- **reset** — start over
- **agent** / **talk to the team** — pause bot for human handoff
