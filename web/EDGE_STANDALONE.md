# Footy Edge standalone deployment

Footy Edge is a separate product, not an FPL navigation tab. This repository currently contains both products, so a separate deployment is required for independent releases.

## Deploy

Create a **new Vercel project** connected to this repository, with root directory `web`, and set `FOOTY_APP_MODE=edge` for Production, Preview and Development. Keep the existing FPL project unchanged; do not set that variable there. The Edge deployment routes `/` to `/betting` and uses its own page title and description.

Configure the existing required server-side Supabase credentials on the new project, using the appropriate environment scope. Do not expose the service-role key as `NEXT_PUBLIC_*`. Assign a distinct Edge domain when ready. Do not point the FPL domain at this project.

This is **deployment separation**, not yet full code/data isolation. The same repository and shared Supabase tables are still used. Before claiming full isolation, extract Edge into its own app/package or repository, scope user accounts and records to each product, and give it independently managed data credentials and release pipelines. Avoid duplicating the verified match-ingestion process; share read-only football facts through a controlled interface. Odds, betting user records and validation must stay Edge-only.

## Release checks

Verify that the new Edge domain loads the betting homepage at `/`, the FPL domain still loads FPL HQ, each domain has the correct metadata, and no service-role secret is sent to the browser. Verify real fixture → process → forecast → fresh price → validation joins before allowing BET. No odds or data coverage alone implies an approved pick.
