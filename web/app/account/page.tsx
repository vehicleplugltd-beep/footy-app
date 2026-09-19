"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Profile = {
  user_id: string;
  display_name: string | null;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  pro_waitlist_joined_at: string | null;
};

type Bankroll = {
  user_id: string;
  currency: "GBP" | "EUR" | "USD";
  starting_bankroll: number;
  current_bankroll: number;
  staking_cap_pct: number;
};

type Entitlement = {
  plan: "FREE" | "PRO";
  status: string;
  current_period_end: string | null;
};

type Bet = {
  id: string;
  placed_at: string;
  event_name: string;
  market: string;
  selection: string;
  bookmaker: string | null;
  decimal_odds: number;
  stake: number;
  model_probability: number | null;
  fair_odds: number | null;
  minimum_take_price: number | null;
  closing_odds: number | null;
  status: "OPEN" | "WON" | "LOST" | "PUSH" | "VOID" | "CASHED_OUT";
  profit: number | null;
};

type Alert = {
  id: string;
  event_name: string;
  market: string;
  selection: string;
  bookmaker: string | null;
  target_odds: number;
  enabled: boolean;
};

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: FormDataEntryValue | null, scale = 1) {
  if (value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / scale : null;
}

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function AccountPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [ageAgree, setAgeAgree] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setUserId(null);
      setEmail("");
      setProfile(null);
      setBankroll(null);
      setEntitlement(null);
      setBets([]);
      setAlerts([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");

    const [profileRes, bankrollRes, entitlementRes, betsRes, alertsRes] =
      await Promise.all([
        supabase.from("footy_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("footy_bankrolls").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("footy_entitlements").select("*").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("footy_bets")
          .select("*")
          .eq("user_id", user.id)
          .order("placed_at", { ascending: false })
          .limit(100),
        supabase
          .from("footy_price_alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (bankrollRes.data) setBankroll(bankrollRes.data as Bankroll);
    if (entitlementRes.data) setEntitlement(entitlementRes.data as Entitlement);
    setBets((betsRes.data ?? []) as Bet[]);
    setAlerts((alertsRes.data ?? []) as Alert[]);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function signUp(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!ageAgree) {
      setMessage("You must confirm you are 18+ to create a betting account.");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: authPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/account`,
      },
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      await supabase
        .from("footy_profiles")
        .update({
          age_confirmed_at: new Date().toISOString(),
          terms_accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", data.user?.id);
      setMessage("Account created.");
      await refresh();
      return;
    }
    setMessage("Check your email to confirm your Footy account, then sign in.");
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });
    setMessage(error ? error.message : "Signed in.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("Signed out.");
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

  async function saveBankroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const form = new FormData(event.currentTarget);
    const starting = n(form.get("starting_bankroll"));
    const currency = String(form.get("currency") || "GBP");
    const { error } = await supabase
      .from("footy_bankrolls")
      .update({
        starting_bankroll: starting,
        current_bankroll: starting,
        currency,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setMessage(error ? error.message : "Bankroll saved.");
    await refresh();
  }

  async function addBet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const form = new FormData(event.currentTarget);
    const decimalOdds = n(form.get("decimal_odds"));
    const stake = n(form.get("stake"));
    const modelProbability = optionalNumber(form.get("model_probability"), 100);
    const { error } = await supabase.from("footy_bets").insert({
      user_id: userId,
      event_name: String(form.get("event_name") || "").trim(),
      market: String(form.get("market") || "").trim(),
      selection: String(form.get("selection") || "").trim(),
      bookmaker: String(form.get("bookmaker") || "").trim() || null,
      decimal_odds: decimalOdds,
      stake,
      model_probability: modelProbability,
      fair_odds: optionalNumber(form.get("fair_odds")),
      minimum_take_price: optionalNumber(form.get("minimum_take_price")),
      closing_odds: optionalNumber(form.get("closing_odds")),
    });
    if (!error) event.currentTarget.reset();
    setMessage(error ? error.message : "Bet added to tracker.");
    await refresh();
  }

  async function settleBet(bet: Bet, status: "WON" | "LOST" | "PUSH" | "VOID") {
    let profit = 0;
    if (status === "WON") profit = n(bet.stake) * (n(bet.decimal_odds) - 1);
    if (status === "LOST") profit = -n(bet.stake);
    const { error } = await supabase
      .from("footy_bets")
      .update({
        status,
        profit,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bet.id);
    setMessage(error ? error.message : `Bet settled as ${status}.`);
    await refresh();
  }

  async function addAlert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from("footy_price_alerts").insert({
      user_id: userId,
      event_name: String(form.get("event_name") || "").trim(),
      market: String(form.get("market") || "").trim(),
      selection: String(form.get("selection") || "").trim(),
      bookmaker: String(form.get("bookmaker") || "").trim() || null,
      target_odds: n(form.get("target_odds")),
    });
    if (!error) event.currentTarget.reset();
    setMessage(error ? error.message : "Price alert saved.");
    await refresh();
  }

  async function toggleAlert(alert: Alert) {
    await supabase
      .from("footy_price_alerts")
      .update({ enabled: !alert.enabled })
      .eq("id", alert.id);
    await refresh();
  }

  async function deleteAlert(id: string) {
    await supabase.from("footy_price_alerts").delete().eq("id", id);
    await refresh();
  }

  async function joinWaitlist() {
    if (!userId) return;
    const { error } = await supabase
      .from("footy_profiles")
      .update({
        pro_waitlist_joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setMessage(error ? error.message : "You are on the Footy Pro founding waitlist.");
    await refresh();
  }

  const settled = bets.filter((bet) => bet.status !== "OPEN");
  const settledStake = settled.reduce((sum, bet) => sum + n(bet.stake), 0);
  const totalProfit = settled.reduce((sum, bet) => sum + n(bet.profit), 0);
  const roi = settledStake > 0 ? totalProfit / settledStake : 0;
  const clvRows = bets.filter((bet) => n(bet.closing_odds) > 1);
  const avgClv = clvRows.length
    ? clvRows.reduce(
        (sum, bet) => sum + n(bet.decimal_odds) / n(bet.closing_odds) - 1,
        0,
      ) / clvRows.length
    : 0;
  const trackedBankroll = n(bankroll?.starting_bankroll) + totalProfit;
  const currency = bankroll?.currency ?? "GBP";

  return (
    <main>
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/pro">Footy Pro</Link>
          {userId ? <button className="link-button" onClick={signOut}>Sign out</button> : null}
        </div>
      </nav>

      <section className="shell account-hero">
        <span className="eyebrow">18+ personal betting workspace</span>
        <h1>Your edge. Your bankroll. Your record.</h1>
        <p>
          Track every bet, settle results, measure ROI and CLV, save target-price
          alerts and keep experimental model signals separate from approved ones.
        </p>
      </section>

      {message ? <div className="shell notice">{message}</div> : null}

      {loading ? (
        <div className="shell empty">Loading your Footy account…</div>
      ) : !userId ? (
        <section className="shell account-auth-grid">
          <form className="panel account-form" onSubmit={signIn}>
            <span className="eyebrow">Existing account</span>
            <h2>Sign in</h2>
            <label><span>Email</span><input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></label>
            <label><span>Password</span><input type="password" required minLength={8} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></label>
            <button type="submit">Sign in</button>
          </form>

          <form className="panel account-form" onSubmit={signUp}>
            <span className="eyebrow">New account</span>
            <h2>Create free Footy account</h2>
            <label><span>Email</span><input type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} /></label>
            <label><span>Password</span><input type="password" required minLength={8} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} /></label>
            <label className="checkbox-row">
              <input type="checkbox" checked={ageAgree} onChange={(e) => setAgeAgree(e.target.checked)} />
              <span>I confirm I am 18+ and accept the Footy betting-tool terms.</span>
            </label>
            <button type="submit">Create account</button>
            <small>No payment details required.</small>
          </form>
        </section>
      ) : !profile?.age_confirmed_at ? (
        <section className="shell panel adult-confirm">
          <span className="eyebrow">Account safety</span>
          <h2>Confirm 18+ before using betting tools</h2>
          <p className="muted">This confirmation applies only to the betting workspace. The FPL assistant remains free and separate.</p>
          <button onClick={confirmAdult}>I confirm I am 18+</button>
        </section>
      ) : (
        <>
          <section className="shell account-summary">
            <article><span>Plan</span><strong>{entitlement?.plan ?? "FREE"}</strong><small>{entitlement?.status ?? "ACTIVE"}</small></article>
            <article><span>Tracked bankroll</span><strong>{money(trackedBankroll, currency)}</strong><small>start + settled profit</small></article>
            <article><span>Settled profit</span><strong className={totalProfit >= 0 ? "positive" : "negative"}>{money(totalProfit, currency)}</strong><small>{settled.length} settled bets</small></article>
            <article><span>ROI</span><strong className={roi >= 0 ? "positive" : "negative"}>{(roi * 100).toFixed(1)}%</strong><small>profit / settled stake</small></article>
            <article><span>Avg CLV</span><strong className={avgClv >= 0 ? "positive" : "negative"}>{(avgClv * 100).toFixed(2)}%</strong><small>{clvRows.length} bets with close</small></article>
          </section>

          <section className="shell section account-grid">
            <div className="panel">
              <span className="eyebrow">Bankroll</span>
              <h2>Set your starting bank</h2>
              <form className="account-form compact-form" onSubmit={saveBankroll}>
                <label><span>Starting bankroll</span><input name="starting_bankroll" type="number" min="0" step="0.01" defaultValue={bankroll?.starting_bankroll ?? 0} /></label>
                <label><span>Currency</span><select name="currency" defaultValue={currency}><option>GBP</option><option>EUR</option><option>USD</option></select></label>
                <button type="submit">Save bankroll</button>
              </form>
            </div>

            <div className="panel pro-account-card">
              <span className="eyebrow">Footy Pro founding beta</span>
              <h2>{profile?.pro_waitlist_joined_at ? "You’re on the list" : "Join the founding waitlist"}</h2>
              <p className="muted">
                Target founder price: £9.99/month. No payment today. Pro is planned to include live +EV scanning, bookmaker line-shopping, alerts and deeper CLV/bankroll analytics.
              </p>
              {!profile?.pro_waitlist_joined_at ? <button onClick={joinWaitlist}>Join Pro waitlist</button> : <Link className="secondary-cta" href="/pro">View Pro plan</Link>}
            </div>
          </section>

          <section className="shell section account-grid">
            <div className="panel">
              <span className="eyebrow">Bet tracker</span>
              <h2>Add a bet</h2>
              <form className="account-form bet-form" onSubmit={addBet}>
                <label><span>Event</span><input name="event_name" required placeholder="Arsenal vs Liverpool" /></label>
                <div className="form-pair">
                  <label><span>Market</span><input name="market" required placeholder="1X2 / O2.5 / AH" /></label>
                  <label><span>Selection</span><input name="selection" required placeholder="Arsenal" /></label>
                </div>
                <div className="form-pair">
                  <label><span>Bookmaker</span><input name="bookmaker" placeholder="William Hill" /></label>
                  <label><span>Odds</span><input name="decimal_odds" type="number" min="1.01" step="0.01" required /></label>
                </div>
                <div className="form-pair">
                  <label><span>Stake</span><input name="stake" type="number" min="0.01" step="0.01" required /></label>
                  <label><span>Model probability %</span><input name="model_probability" type="number" min="0.1" max="99.9" step="0.1" /></label>
                </div>
                <div className="form-triple">
                  <label><span>Fair odds</span><input name="fair_odds" type="number" min="1.01" step="0.01" /></label>
                  <label><span>Min take</span><input name="minimum_take_price" type="number" min="1.01" step="0.01" /></label>
                  <label><span>Closing odds</span><input name="closing_odds" type="number" min="1.01" step="0.01" /></label>
                </div>
                <button type="submit">Add bet</button>
              </form>
            </div>

            <div className="panel">
              <span className="eyebrow">Price alerts</span>
              <h2>Save a target price</h2>
              <form className="account-form compact-form" onSubmit={addAlert}>
                <label><span>Event</span><input name="event_name" required placeholder="Arsenal vs Liverpool" /></label>
                <div className="form-pair">
                  <label><span>Market</span><input name="market" required placeholder="1X2" /></label>
                  <label><span>Selection</span><input name="selection" required placeholder="Arsenal" /></label>
                </div>
                <div className="form-pair">
                  <label><span>Bookmaker</span><input name="bookmaker" placeholder="Any / William Hill" /></label>
                  <label><span>Alert at odds</span><input name="target_odds" type="number" min="1.01" step="0.01" required /></label>
                </div>
                <button type="submit">Save alert</button>
              </form>

              <div className="alert-list">
                {alerts.length ? alerts.map((alert) => (
                  <div className="alert-row" key={alert.id}>
                    <div><strong>{alert.event_name}</strong><small>{alert.market} · {alert.selection} · {alert.target_odds.toFixed(2)}+</small></div>
                    <div className="row-actions">
                      <button className="mini-button" onClick={() => toggleAlert(alert)}>{alert.enabled ? "Pause" : "Enable"}</button>
                      <button className="mini-button danger" onClick={() => deleteAlert(alert.id)}>Delete</button>
                    </div>
                  </div>
                )) : <p className="muted">No saved alerts yet.</p>}
              </div>
            </div>
          </section>

          <section className="shell section">
            <div className="section-head">
              <div><span className="eyebrow">History</span><h2>Your latest bets</h2></div>
              <p>{email}</p>
            </div>
            <div className="bet-history">
              {bets.length ? bets.map((bet) => (
                <article className="bet-row" key={bet.id}>
                  <div>
                    <span className="bet-status">{bet.status}</span>
                    <strong>{bet.event_name}</strong>
                    <small>{bet.market} · {bet.selection} · {bet.bookmaker || "Bookmaker not set"}</small>
                  </div>
                  <div className="bet-numbers">
                    <span>{bet.decimal_odds.toFixed(2)}</span>
                    <span>{money(bet.stake, currency)}</span>
                    <span className={n(bet.profit) >= 0 ? "positive" : "negative"}>
                      {bet.status === "OPEN" ? "Open" : money(n(bet.profit), currency)}
                    </span>
                  </div>
                  {bet.status === "OPEN" ? (
                    <div className="row-actions">
                      <button className="mini-button win" onClick={() => settleBet(bet, "WON")}>Won</button>
                      <button className="mini-button danger" onClick={() => settleBet(bet, "LOST")}>Lost</button>
                      <button className="mini-button" onClick={() => settleBet(bet, "PUSH")}>Push</button>
                    </div>
                  ) : null}
                </article>
              )) : <div className="empty">No bets tracked yet.</div>}
            </div>
          </section>
        </>
      )}

      <footer className="shell footer">
        <p><strong>18+ only.</strong> Footy is decision support, not a guarantee of profit.</p>
        <p>TRACK → SETTLE → ROI → CLV → IMPROVE</p>
      </footer>
    </main>
  );
}
