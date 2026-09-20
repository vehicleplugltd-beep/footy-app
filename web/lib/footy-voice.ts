
export function footyQuip(
  type:
    | "hq"
    | "league"
    | "hold"
    | "move"
    | "captain"
    | "weakSquad"
    | "strongSquad"
    | "preview"
    | "watchlist",
  context?: {
    player?: string;
    rival?: string;
    gap?: number | null;
  },
) {
  switch (type) {
    case "hq":
      return "You’ve got a team. Good. Now let’s see if it’s actually any good.";
    case "league":
      return context?.rival
        ? `That’s the target: ${context.rival}. No drama. Just catch them.`
        : "Pick the league you care about. Nobody gets a trophy for winning the wrong one.";
    case "hold":
      return "Doing nothing is a decision too. Sometimes it’s the first sensible one all week.";
    case "move":
      return context?.player
        ? `${context.player} improves the team. That’s the point. Not because Twitter likes him.`
        : "If the move improves the team, make it. If it doesn’t, leave it alone.";
    case "captain":
      return context?.player
        ? `Captain ${context.player}. Don’t invent a problem where there isn’t one.`
        : "Captaincy doesn’t need theatre. Pick the best option and get on with it.";
    case "weakSquad":
      return "There are a few passengers here. We’ll deal with them one at a time.";
    case "strongSquad":
      return "It’s in decent shape. Don’t wreck it because you’re bored.";
    case "preview":
      return "Try your idea. If it’s better, great. If it’s worse, at least now you know.";
    case "watchlist":
      return "Interesting player. Doesn’t mean you need to buy him five minutes after noticing him.";
  }
}
