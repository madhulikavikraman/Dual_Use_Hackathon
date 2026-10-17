# AllClear

Multilingual AI roll call for evacuation zones. A coordinator picks a zone and clicks **Notify zone**; every
household gets a call in its own language from a Claude agent, and a live board shows who is safe, leaving,
needs help, won't leave, or hasn't answered.

**Demo honesty:** all resident data is synthetic. Calls go to a web "phone" page that volunteers open on their
real phones. In production the same agent logic would run over the phone network through a telephony adapter.

## Setup

1. `npm install`
2. Create a Supabase project. In the SQL editor, run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and fill it in.
4. `npm run seed` loads 40 synthetic households in west Altadena.
5. `npm run dev`, then open `/api/health`. Every check should be `ok: true`.

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key |
| `AGENT_MODEL` | In-call model (default `claude-haiku-5-5`) |
| `ANALYSIS_MODEL` | Post-call analysis and "Ask the board" (default `claude-sonnet-5-5`) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser reads + Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side writes (never exposed to the browser) |
| `APP_BASE_URL` | Public URL used in device QR codes |
