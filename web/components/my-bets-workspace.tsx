"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { fractionalToDecimal, decimalToFractional } from "@/lib/odds";

type Profile = {
  user_id: string;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
};

type BetStatus = "OPEN" | "WON" | "LOST" | "PUSH" | "VOID" | "CASHED_OUT";
type BetType = "SINGLE" | "DOUBLE" | "TREBLE" | "ACCA";

type Bet = {
  id: string;
  match_id: string | null;
  placed_at: string;
  event_name: string;
  market: string;
  selection: string;
  bookmaker: string | null;
  decimal_odds: number;
  stake: number;
  model_version: string | null;
  model_probability: number | null;
  fair_odds: number | null;
  minimum_take_price: number | null;
  closing_odds: number | null;
  status: BetStatus;
  profit: number | null;
  bet_type: BetType;
  leg_count: number;
  source: string;
};

type Feedback = {
  id: string;
  bet_id: string | null;
  feedback_type: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
};

type CsvRow = Record<string, string>;

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function price(value: unknown) {
  const parsed = fractionalToDecimal(String(value ?? ""));
  return parsed && parsed > 1 ? parsed : null;
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some((cell) => cell.length)) rows.push(row);
  }

  if (rows.length < 2) return [];
  const headers = rows[0].map((header) =>
    header.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_"),
  );

  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
  );
}

function allowedStatus(value: string): BetStatus {
  const status = value.trim().toUpperCase();
  if (
    status === "WON" ||
    status === "LOST" ||
    status === "PUSH" ||
    status === "VOID" ||
    status === "CASHED_OUT"
  ) {
    return status;
  }
  return "OPEN";
}

function inferredBetType(legs: number, raw: string): BetType {
  const requested = raw.trim().toUpperCase();
  if (requested === "SINGLE" && legs === 1) return "SINGLE";
  if (requested === "DOUBLE" && legs === 2) return "DOUBLE";
  if (requested === "TREBLE" && legs === 3) return "TREBLE";
  if (legs === 1) return "SINGLE";
  if (legs === 2) return "DOUBLE";
  if (legs === 3) return "TREBLE";
  return "ACCA";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

export function MyBetsWorkspace() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [ageAgree, setAgeAgree] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      setUserId(null);
      setEmail("");
      setProfile(null);
      setBets([]);
      setFeedback([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");

    const [profileRes, betsRes, feedbackRes] = await Promise.all([
      supabase
        .from("footy_profiles")
        .select("user_id,age_confirmed_at,terms_accepted_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("footy_bets")
        .select("*")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false })
        .limit(250),
      supabase
        .from("footy_feedback")
        .select("id,bet_id,feedback_type,rating,comment,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setProfile((profileRes.data as Profile | null) ?? null);
    setBets((betsRes.data ?? []) as Bet[]);
    setFeedback((feedbackRes.data ?? []) as Feedback[]);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    setMessage(error ? error.message : "Signed in.");
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (!ageAgree) {
      setMessage("Confirm you are 18 or over before creating a betting workspace.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: { emailRedirectTo: `${window.location.origin}/betting/my-bets` },
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session && data.user) {
      await supabase
        .from("footy_profiles")
        .update({
          age_confirmed_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", data.user.id);
      setMessage("Account created.");
      await refresh();
      return;
    }

    setMessage("Check your email to confirm your account, then sign in.");
  }

  async function confirmAdult() {
    if (!userId) return;
    const { error } = await supabase
      .from("footy_profiles")
      .update({
        age_confirmed_at: new Date().toISOString(),
        terms_accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setMessage(error ? error.message : "18+ confirmation saved.");
    await refresh();
  }

  async function addSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const decimalOdds = price(form.get("odds"));
    if (!decimalOdds) {
      setMessage("Enter valid decimal or fractional odds, e.g. 2.50 or 6/4.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.from("footy_bets").insert({
      user_id: userId,
      event_name: String(form.get("event_name") ?? "").trim(),
      market: String(form.get("market") ?? "").trim(),
      selection: String(form.get("selection") ?? "").trim(),
      bookmaker: String(form.get("bookmaker") ?? "").trim() || null,
      decimal_odds: decimalOdds,
      stake: n(form.get("stake")),
      placed_at: String(form.get("placed_at") ?? "").trim() || new Date().toISOString(),
      source: "USER_MANUAL",
      bet_type: "SINGLE",
      leg_count: 1,
    });

    if (!error) event.currentTarget.reset();
    setMessage(error ? error.message : "Bet added.");
    setBusy(false);
    await refresh();
  }

  async function uploadCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      setMessage("Choose a CSV file first.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const rows = parseCsv(await file.text());
    if (!rows.length) {
      setMessage("No data rows found. Use the sample column format shown below.");
      setBusy(false);
      return;
    }

    const { data: batch, error: batchError } = await supabase
      .from("footy_bet_imports")
      .insert({
        user_id: userId,
        filename: file.name,
        source_format: "CSV",
        rows_received: rows.length,
      })
      .select("id")
      .single();

    if (batchError || !batch) {
      setMessage(batchError?.message ?? "Could not start import.");
      setBusy(false);
      return;
    }

    const groups = new Map<string, CsvRow[]>();
    rows.forEach((row, index) => {
      const key = row.ticket_ref || row.bet_ref || `row_${index + 1}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    });

    let imported = 0;
    let rejected = 0;

    for (const [ticketRef, legs] of groups) {
      const legPrices = legs.map((row) => price(row.odds || row.decimal_odds));
      const validLegPrices = legPrices.filter(
        (value): value is number => value !== null,
      );
      if (
        legs.some((row) => !(row.event || row.event_name) || !row.market || !row.selection) ||
        validLegPrices.length !== legPrices.length
      ) {
        rejected += legs.length;
        continue;
      }

      const type = inferredBetType(legs.length, legs[0].bet_type || "");
      const combinedOdds = validLegPrices.reduce(
        (product, value) => product * value,
        1,
      );
      const events = [...new Set(legs.map((row) => row.event || row.event_name))];
      const status = allowedStatus(legs[0].status || "OPEN");
      const parent = {
        user_id: userId,
        import_batch_id: batch.id,
        event_name:
          legs.length === 1
            ? events[0]
            : `${legs.length}-leg ${type.toLowerCase()} · ${events.join(" / ")}`,
        market: legs.length === 1 ? legs[0].market : "ACCA",
        selection:
          legs.length === 1
            ? legs[0].selection
            : legs.map((row) => row.selection).join(" + "),
        bookmaker: legs[0].bookmaker || null,
        decimal_odds: combinedOdds,
        stake: n(legs[0].stake),
        placed_at: legs[0].placed_at || new Date().toISOString(),
        status,
        profit: legs[0].profit ? n(legs[0].profit) : null,
        source: "USER_CSV",
        bet_type: type,
        leg_count: legs.length,
        notes: `Imported ticket ${ticketRef}`,
      };

      const { data: bet, error: betError } = await supabase
        .from("footy_bets")
        .insert(parent)
        .select("id")
        .single();

      if (betError || !bet) {
        rejected += legs.length;
        continue;
      }

      const { error: legError } = await supabase.from("footy_bet_legs").insert(
        legs.map((row, index) => ({
          bet_id: bet.id,
          user_id: userId,
          leg_no: index + 1,
          event_name: row.event || row.event_name,
          market: row.market,
          selection: row.selection,
          bookmaker: row.bookmaker || legs[0].bookmaker || null,
          decimal_odds: validLegPrices[index],
        })),
      );

      if (legError) {
        await supabase.from("footy_bets").delete().eq("id", bet.id);
        rejected += legs.length;
        continue;
      }

      imported += legs.length;
    }

    await supabase
      .from("footy_bet_imports")
      .update({
        rows_imported: imported,
        rows_rejected: rejected,
      })
      .eq("id", batch.id);

    event.currentTarget.reset();
    setMessage(`Import complete: ${imported} legs imported, ${rejected} rejected.`);
    setBusy(false);
    await refresh();
  }

  async function settleBet(bet: Bet, status: "WON" | "LOST" | "PUSH" | "VOID") {
    const profit =
      status === "WON"
        ? n(bet.stake) * (n(bet.decimal_odds) - 1)
        : status === "LOST"
          ? -n(bet.stake)
          : 0;

    const { error } = await supabase
      .from("footy_bets")
      .update({ status, profit, updated_at: new Date().toISOString() })
      .eq("id", bet.id);

    setMessage(error ? error.message : `Bet settled as ${status}.`);
    await refresh();
  }

  async function sendFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const bet = bets.find((item) => item.id === String(form.get("bet_id")));

    const { error } = await supabase.from("footy_feedback").insert({
      user_id: userId,
      bet_id: bet?.id ?? null,
      match_id: bet?.match_id ?? null,
      model_version: bet?.model_version ?? null,
      market: bet?.market ?? null,
      selection: bet?.selection ?? null,
      feedback_type: String(form.get("feedback_type") ?? "OTHER"),
      rating: n(form.get("rating")) || null,
      comment: String(form.get("comment") ?? "").trim() || null,
      context: {
        source: "my-bets",
        bet_type: bet?.bet_type ?? null,
        status: bet?.status ?? null,
      },
    });

    if (!error) event.currentTarget.reset();
    setMessage(error ? error.message : "Feedback saved. Thank you.");
    setBusy(false);
    await refresh();
  }

  const settled = bets.filter((bet) => bet.status !== "OPEN");
  const settledStake = settled.reduce((sum, bet) => sum + n(bet.stake), 0);
  const totalProfit = settled.reduce((sum, bet) => sum + n(bet.profit), 0);
  const roi = settledStake > 0 ? totalProfit / settledStake : 0;
  const clvBets = bets.filter((bet) => n(bet.closing_odds) > 1);
  const avgClv = clvBets.length
    ? clvBets.reduce(
        (sum, bet) => sum + n(bet.decimal_odds) / n(bet.closing_odds) - 1,
        0,
      ) / clvBets.length
    : null;

  if (loading) {
    return <div className="my-bets-empty">Loading your betting workspace…</div>;
  }

  if (!userId) {
    return (
      <section className="my-bets-auth">
        <form onSubmit={signIn}>
          <span>SIGN IN</span>
          <h2>Open your betting record</h2>
          <label>Email<input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></label>
          <label>Password<input type="password" minLength={8} required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></label>
          <button type="submit">Sign in</button>
        </form>

        <form onSubmit={signUp}>
          <span>NEW ACCOUNT</span>
          <h2>Create a private workspace</h2>
          <label>Email<input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></label>
          <label>Password<input type="password" minLength={8} required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></label>
          <label className="age-check">
            <input type="checkbox" checked={ageAgree} onChange={(e) => setAgeAgree(e.target.checked)} />
            <span>I confirm I am 18 or over.</span>
          </label>
          <button type="submit">Create account</button>
        </form>
        {message ? <p className="workspace-message">{message}</p> : null}
      </section>
    );
  }

  if (!profile?.age_confirmed_at) {
    return (
      <section className="adult-workspace-confirm">
        <span>18+ REQUIRED</span>
        <h2>Confirm your age before opening betting tools.</h2>
        <p>This affects only the betting workspace; the FPL product remains separate.</p>
        <button type="button" onClick={confirmAdult}>I confirm I am 18+</button>
        {message ? <p className="workspace-message">{message}</p> : null}
      </section>
    );
  }

  return (
    <>
      {message ? <div className="workspace-message">{message}</div> : null}

      <section className="bet-record-summary">
        <article><span>Bets</span><strong>{bets.length}</strong><small>{settled.length} settled</small></article>
        <article><span>Settled P/L</span><strong className={totalProfit >= 0 ? "positive" : "negative"}>{formatMoney(totalProfit)}</strong><small>{formatMoney(settledStake)} staked</small></article>
        <article><span>ROI</span><strong className={roi >= 0 ? "positive" : "negative"}>{(roi * 100).toFixed(1)}%</strong><small>settled bets</small></article>
        <article><span>Avg CLV</span><strong className={(avgClv ?? 0) >= 0 ? "positive" : "negative"}>{avgClv == null ? "—" : `${(avgClv * 100).toFixed(2)}%`}</strong><small>{clvBets.length} with close</small></article>
        <article><span>Feedback</span><strong>{feedback.length}</strong><small>model-quality notes</small></article>
      </section>

      <section className="bet-input-grid">
        <article className="bet-workspace-panel">
          <span>MANUAL ENTRY</span>
          <h2>Add a single</h2>
          <form className="bet-workspace-form" onSubmit={addSingle}>
            <label>Event<input name="event_name" required placeholder="Arsenal vs Chelsea" /></label>
            <div className="field-pair">
              <label>Market<input name="market" required placeholder="1X2 / O2.5 / AH" /></label>
              <label>Selection<input name="selection" required placeholder="Arsenal" /></label>
            </div>
            <div className="field-pair">
              <label>Bookmaker<input name="bookmaker" placeholder="William Hill" /></label>
              <label>Odds<input name="odds" required placeholder="6/4 or 2.50" /></label>
            </div>
            <div className="field-pair">
              <label>Stake<input name="stake" type="number" min="0" step="0.01" required /></label>
              <label>Placed at<input name="placed_at" type="datetime-local" /></label>
            </div>
            <button disabled={busy} type="submit">Add bet</button>
          </form>
        </article>

        <article className="bet-workspace-panel">
          <span>CSV UPLOAD</span>
          <h2>Import singles or accas</h2>
          <p>
            One row per leg. Give accumulator legs the same <code>ticket_ref</code>.
            Footy groups them into doubles, trebles or larger accas automatically.
          </p>
          <form className="bet-workspace-form" onSubmit={uploadCsv}>
            <label>CSV file<input name="file" type="file" accept=".csv,text/csv" required /></label>
            <button disabled={busy} type="submit">{busy ? "Importing…" : "Upload bets"}</button>
          </form>
          <div className="csv-format">
            <span>SUPPORTED COLUMNS</span>
            <code>ticket_ref, bet_type, event, market, selection, bookmaker, odds, stake, placed_at, status, profit</code>
          </div>
        </article>
      </section>

      <section className="bet-workspace-panel bet-history-panel">
        <div className="workspace-panel-head">
          <div><span>BET HISTORY</span><h2>Your record</h2></div>
          <small>{email}</small>
        </div>
        {bets.length ? (
          <div className="bet-ticket-list">
            {bets.map((bet) => (
              <article key={bet.id}>
                <div>
                  <span className="ticket-type">{bet.bet_type} · {bet.leg_count} leg{bet.leg_count === 1 ? "" : "s"}</span>
                  <strong>{bet.event_name}</strong>
                  <small>{bet.market} · {bet.selection} · {bet.bookmaker || "Bookmaker not set"}</small>
                </div>
                <div className="ticket-numbers">
                  <strong>{decimalToFractional(n(bet.decimal_odds))}</strong>
                  <span>{formatMoney(n(bet.stake))}</span>
                  <span className={n(bet.profit) >= 0 ? "positive" : "negative"}>
                    {bet.status === "OPEN" ? "OPEN" : formatMoney(n(bet.profit))}
                  </span>
                </div>
                {bet.status === "OPEN" ? (
                  <div className="ticket-actions">
                    <button type="button" onClick={() => settleBet(bet, "WON")}>Won</button>
                    <button type="button" onClick={() => settleBet(bet, "LOST")}>Lost</button>
                    <button type="button" onClick={() => settleBet(bet, "PUSH")}>Push</button>
                    <button type="button" onClick={() => settleBet(bet, "VOID")}>Void</button>
                  </div>
                ) : <em>{bet.status}</em>}
              </article>
            ))}
          </div>
        ) : (
          <div className="my-bets-empty">No bets uploaded or entered yet.</div>
        )}
      </section>

      <section className="bet-workspace-panel feedback-panel">
        <span>FEEDBACK LOOP</span>
        <h2>Tell Footy what needs scrutiny</h2>
        <p>
          Feedback is stored with the bet/model context so we can distinguish bad
          luck from bad data, bad pricing or a genuine modelling miss.
        </p>
        <form className="bet-workspace-form" onSubmit={sendFeedback}>
          <label>
            Bet
            <select name="bet_id" defaultValue="">
              <option value="">General model feedback</option>
              {bets.map((bet) => (
                <option key={bet.id} value={bet.id}>{bet.event_name} — {bet.selection}</option>
              ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Type
              <select name="feedback_type" defaultValue="HELPFUL">
                <option value="HELPFUL">Helpful</option>
                <option value="NOT_HELPFUL">Not helpful</option>
                <option value="PRICE_WRONG">Price wrong / stale</option>
                <option value="DATA_WRONG">Data wrong</option>
                <option value="MODEL_MISSED">Model missed something</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label>
              Rating
              <select name="rating" defaultValue="5">
                <option value="5">5 — Excellent</option>
                <option value="4">4 — Good</option>
                <option value="3">3 — Mixed</option>
                <option value="2">2 — Weak</option>
                <option value="1">1 — Poor</option>
              </select>
            </label>
          </div>
          <label>Comment<textarea name="comment" rows={4} placeholder="What did the model miss, or what was especially useful?" /></label>
          <button disabled={busy} type="submit">Save feedback</button>
        </form>
      </section>
    </>
  );
}
