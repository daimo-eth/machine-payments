/** Seed MPP charge-intent providers into the database.
 *  Source: https://mpp.dev/api/services (fetched live, filtered to charge intent).
 *  Also populates endpoints JSONB from the API. */

import sql from "../src/db";

/** Convert atomic amount (string) to dollar string. */
function atomicToPrice(amount: string | undefined, decimals: number = 6): string {
  if (!amount) return "Varies";
  const n = Number(amount) / 10 ** decimals;
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

type CleanEndpoint = {
  method: string;
  path: string;
  description: string;
  intent: string | null;
  price: string | null;
};

function cleanEndpoints(rawEndpoints: any[]): CleanEndpoint[] {
  return rawEndpoints.map((e) => ({
    method: e.method,
    path: e.path,
    description: e.description,
    intent: e.payment?.intent ?? null,
    price: e.payment
      ? e.payment.dynamic
        ? "Varies"
        : atomicToPrice(e.payment.amount, e.payment.decimals ?? 6)
      : null,
  }));
}

async function main() {
  const res = await fetch("https://mpp.dev/api/services");
  const data = await res.json();
  const services: any[] = data.services;

  const chargeServices = services.filter((s) => {
    const intents = s.methods?.tempo?.intents ?? [];
    return intents.includes("charge");
  });

  console.log(`Found ${chargeServices.length} charge-intent services out of ${services.length} total`);

  const verifiedUrls = chargeServices.map((s) => s.serviceUrl);

  const deleted = await sql`
    DELETE FROM mpp_providers
    WHERE url != ALL(${verifiedUrls})
    AND id NOT IN (SELECT DISTINCT provider_id FROM mpp_ratings)
    RETURNING url
  `;
  if (deleted.length > 0) {
    console.log(`Deleted ${deleted.length} providers:`);
    for (const d of deleted) console.log(`  - ${d.url}`);
  }

  let created = 0;
  let updated = 0;

  for (const s of chargeServices) {
    const url = s.serviceUrl;
    const name = s.name;
    const description = s.description;
    const category = s.categories?.[0] ?? null;
    const endpoints = cleanEndpoints(s.endpoints ?? []);

    const [existing] = await sql<{ id: string }[]>`
      SELECT id FROM mpp_providers WHERE url = ${url}
    `;

    if (existing) {
      await sql`
        UPDATE mpp_providers SET
          name = ${name},
          description = ${description},
          category = ${category},
          endpoints = ${sql.json(endpoints as any)},
          updated_at = now()
        WHERE id = ${existing.id}
      `;
      updated++;
    } else {
      await sql`
        INSERT INTO mpp_providers (url, name, description, category, endpoints)
        VALUES (${url}, ${name}, ${description}, ${category}, ${sql.json(endpoints as any)})
      `;
      created++;
    }
  }

  // Quick stats
  let totalEndpoints = 0;
  let paidEndpoints = 0;
  for (const s of chargeServices) {
    const eps = s.endpoints ?? [];
    totalEndpoints += eps.length;
    paidEndpoints += eps.filter((e: any) => e.payment).length;
  }

  console.log(`\nDone: ${created} created, ${updated} updated.`);
  console.log(`Total: ${chargeServices.length} providers, ${totalEndpoints} endpoints (${paidEndpoints} paid).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
