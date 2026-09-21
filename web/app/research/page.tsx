import { ResearchHub } from "@/components/research-hub";
import { ProductNav } from "@/components/product-nav";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string | string[]; club?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawPlayer = Array.isArray(query.player) ? query.player[0] : query.player;
  const rawClub = Array.isArray(query.club) ? query.club[0] : query.club;
  const playerId = rawPlayer ? Number(rawPlayer.replace(/\D/g, "")) : undefined;

  return (
    <main className="league-edge-app research-page">
      <ProductNav active="research" />
      <div className="shell">
        <ResearchHub
          initialPlayerId={
            playerId && Number.isInteger(playerId) && playerId > 0
              ? playerId
              : undefined
          }
          initialClub={rawClub || undefined}
        />
      </div>
    </main>
  );
}
