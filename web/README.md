# Footy Web MVP

Next.js App Router dashboard for Footy's football price-intelligence engine.

## MVP features

- Upcoming v7 1X2 probability/fair-price board
- Minimum take price for every selection
- Production validation badge (APPROVED / WATCH / RESEARCH / PASS)
- Manual bookmaker price checker
- Quarter-Kelly bankroll calculator with a 1.5% cap
- Validation and frozen-strategy evidence cards

The Supabase service-role key is never sent to the browser. Database reads happen in Server Components.

## Run locally

```bash
cd web
cp .env.example .env.local
# Fill SUPABASE_SERVICE_ROLE_KEY in .env.local
npm install
npm run dev
```

## Deploy

Create a Vercel project from this repository with **Root Directory = web** and add:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server-only secret)

Never prefix the service-role key with NEXT_PUBLIC_.
