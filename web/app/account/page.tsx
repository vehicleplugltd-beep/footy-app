"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { decimalToFractional, fractionalToDecimal } from "@/lib/odds";

type Profile = {
  user_id: string;
  display_name: string | null;
  age_confirmed_at: string | null;
  terms_accepted_at: string | null;
  pro_waitlist_joined_at: string | null;
};

type Entitlement = {
  plan: "FREE" | "PRO";
  status: string;
  current_period_end: string | null;
};

type SavedTip = {
  id: string;
  event_name: string;
  market: string;
  selection: string;
  bookmaker: string | null;
  quoted_odds: number | null;
  model_version: string | null;
  model_probability: number | null;
  fair_odds: number | null;
  minimum_take_price: number | null;
  validation_status: "APPROVED" | "WATCH" | "RESEARCH" | "PASS" | null;
  notes: string | null;
  created_at: string;
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

function tipEv(tip: SavedTip) {
  if (!tip.model_probability || !tip.quoted_odds) return null;
  return tip.model_probability * tip.quoted_odds - 1;
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
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [tips, setTips] = useState<SavedTip[]>([]);
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
      setEntitlement(null);
      setTips([]);
      setAlerts([]);
      setLoading(false);
      return;
    }

    setUserId(user.id);
    setEmail(user.email ?? "");

    const [profileRes, entitlementRes, tipsRes, alertsRes] = await Promise.all([
      supabase
        .from("footy_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("footy_entitlements")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("footy_saved_tips")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("footy_price_alerts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    if (entitlementRes.data) setEntitlement(entitlementRes.data as Entitlement);
    setTips((tipsRes.data ?? []) as SavedTip[]);
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
      setMessage("You must confirm you are 18+ to create a betting-information account.");
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

  async function saveTip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;

    const form = new FormData(event.currentTarget);
    const quotedOdds = fractionalToDecimal(String(form.get("quoted_odds") || ""));
    const modelProbability = optionalNumber(form.get("model_probability"), 100);

    const { error } = await supabase.from("footy_saved_tips").insert({
      user_id: userId,
      event_name: String(form.get("event_name") || "").trim(),
      market: String(form.get("market") || "").trim(),
      selection: String(form.get("selection") || "").trim(),
      bookmaker: String(form.get("bookmaker") || "").trim() || null,
      quoted_odds: quotedOdds,
      model_version: String(form.get("model_version") || "").trim() || null,
      model_probability: modelProbability,
      fair_odds: fractionalToDecimal(String(form.get("fair_odds") || "")),
      minimum_take_price: fractionalToDecimal(String(form.get("minimum_take_price") || "")),
      validation_status:
        String(form.get("validation_status") || "").trim() || null,
      notes: String(form.get("notes") || "").trim() || null,
    });

    if (!error) event.currentTarget.reset();
    setMessage(error ? error.message : "Tip saved to your watchlist.");
    await refresh();
  }

  async function deleteTip(id: string) {
    await supabase.from("footy_saved_tips").delete().eq("id", id);
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
      target_odds:
        fractionalToDecimal(String(form.get("target_odds") || "")) ?? 0,
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

    setMessage(
      error
        ? error.message
        : "You are on the Footy Pro founding waitlist.",
    );
    await refresh();
  }

  const activeAlerts = alerts.filter((alert) => alert.enabled).length;
  const approvedTips = tips.filter(
    (tip) => tip.validation_status === "APPROVED",
  ).length;
  const watchTips = tips.filter(
    (tip) => tip.validation_status === "WATCH",
  ).length;

  return (
    <main>
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="nav-links">
          <Link href="/pro">Footy Pro</Link>
          {userId ? (
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </nav>

      <section className="shell account-hero">
        <span className="eyebrow">18+ personal Footy workspace</span>
        <h1>Save tips. Watch prices. Follow the evidence.</h1>
        <p>
          Footy is an information and analytics service. We do not accept,
          place or settle bets. Your account stores value tips, target prices,
          model evidence and Pro access.
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
            <label>
              <span>Email</span>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
            <button type="submit">Sign in</button>
          </form>

          <form className="panel account-form" onSubmit={signUp}>
            <span className="eyebrow">New account</span>
            <h2>Create free Footy account</h2>
            <label>
              <span>Email</span>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={ageAgree}
                onChange={(event) => setAgeAgree(event.target.checked)}
              />
              <span>
                I confirm I am 18+ and accept the Footy betting-information
                terms.
              </span>
            </label>
            <button type="submit">Create account</button>
            <small>No payment details required.</small>
          </form>
        </section>
      ) : !profile?.age_confirmed_at ? (
        <section className="shell panel adult-confirm">
          <span className="eyebrow">Account safety</span>
          <h2>Confirm 18+ before using betting-information tools</h2>
          <p className="muted">
            This confirmation applies only to Footy&apos;s betting-information
            area. The FPL assistant remains free and separate.
          </p>
          <button onClick={confirmAdult}>I confirm I am 18+</button>
        </section>
      ) : (
        <>
          <section className="shell account-summary">
            <article>
              <span>Plan</span>
              <strong>{entitlement?.plan ?? "FREE"}</strong>
              <small>{entitlement?.status ?? "ACTIVE"}</small>
            </article>
            <article>
              <span>Saved tips</span>
              <strong>{tips.length}</strong>
              <small>your private watchlist</small>
            </article>
            <article>
              <span>Approved</span>
              <strong className="positive">{approvedTips}</strong>
              <small>saved APPROVED tips</small>
            </article>
            <article>
              <span>Watch</span>
              <strong>{watchTips}</strong>
              <small>saved WATCH tips</small>
            </article>
            <article>
              <span>Price alerts</span>
              <strong>{activeAlerts}</strong>
              <small>active targets</small>
            </article>
          </section>

          <section className="shell section account-grid">
            <div className="panel">
              <span className="eyebrow">Tip watchlist</span>
              <h2>Save a value spot</h2>
              <form className="account-form bet-form" onSubmit={saveTip}>
                <label>
                  <span>Event</span>
                  <input
                    name="event_name"
                    required
                    placeholder="Arsenal vs Liverpool"
                  />
                </label>
                <div className="form-pair">
                  <label>
                    <span>Market</span>
                    <input name="market" required placeholder="1X2 / O2.5 / AH" />
                  </label>
                  <label>
                    <span>Selection</span>
                    <input name="selection" required placeholder="Arsenal" />
                  </label>
                </div>
                <div className="form-pair">
                  <label>
                    <span>Bookmaker</span>
                    <input name="bookmaker" placeholder="William Hill" />
                  </label>
                  <label>
                    <span>Quoted odds</span>
                    <input
                      name="quoted_odds"
                      inputMode="text"
                      placeholder="e.g. 7/4"
                    />
                  </label>
                </div>
                <div className="form-triple">
                  <label>
                    <span>Model probability %</span>
                    <input
                      name="model_probability"
                      type="number"
                      min="0.1"
                      max="99.9"
                      step="0.1"
                    />
                  </label>
                  <label>
                    <span>Fair odds</span>
                    <input
                      name="fair_odds"
                      inputMode="text"
                      placeholder="e.g. 6/4"
                    />
                  </label>
                  <label>
                    <span>Minimum take</span>
                    <input
                      name="minimum_take_price"
                      inputMode="text"
                      placeholder="e.g. 7/4"
                    />
                  </label>
                </div>
                <div className="form-pair">
                  <label>
                    <span>Validation</span>
                    <select name="validation_status" defaultValue="WATCH">
                      <option value="APPROVED">APPROVED</option>
                      <option value="WATCH">WATCH</option>
                      <option value="RESEARCH">RESEARCH</option>
                      <option value="PASS">PASS</option>
                    </select>
                  </label>
                  <label>
                    <span>Model version</span>
                    <input name="model_version" placeholder="v7-r16-p50-v20" />
                  </label>
                </div>
                <label>
                  <span>Notes</span>
                  <input
                    name="notes"
                    placeholder="Why this price is interesting"
                  />
                </label>
                <button type="submit">Save tip</button>
              </form>
            </div>

            <div className="panel">
              <span className="eyebrow">Price alerts</span>
              <h2>Save a target price</h2>
              <form className="account-form compact-form" onSubmit={addAlert}>
                <label>
                  <span>Event</span>
                  <input
                    name="event_name"
                    required
                    placeholder="Arsenal vs Liverpool"
                  />
                </label>
                <div className="form-pair">
                  <label>
                    <span>Market</span>
                    <input name="market" required placeholder="1X2" />
                  </label>
                  <label>
                    <span>Selection</span>
                    <input name="selection" required placeholder="Arsenal" />
                  </label>
                </div>
                <div className="form-pair">
                  <label>
                    <span>Bookmaker</span>
                    <input
                      name="bookmaker"
                      placeholder="Any / William Hill"
                    />
                  </label>
                  <label>
                    <span>Alert at odds</span>
                    <input
                      name="target_odds"
                      inputMode="text"
                      placeholder="e.g. 7/4"
                      required
                    />
                  </label>
                </div>
                <button type="submit">Save alert</button>
              </form>

              <div className="alert-list">
                {alerts.length ? (
                  alerts.map((alert) => (
                    <div className="alert-row" key={alert.id}>
                      <div>
                        <strong>{alert.event_name}</strong>
                        <small>
                          {alert.market} · {alert.selection} ·{" "}
                          {decimalToFractional(alert.target_odds)}+
                        </small>
                      </div>
                      <div className="row-actions">
                        <button
                          className="mini-button"
                          onClick={() => toggleAlert(alert)}
                        >
                          {alert.enabled ? "Pause" : "Enable"}
                        </button>
                        <button
                          className="mini-button danger"
                          onClick={() => deleteAlert(alert.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="muted">No saved alerts yet.</p>
                )}
              </div>
            </div>
          </section>

          <section className="shell section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Saved information</span>
                <h2>Your tip watchlist</h2>
              </div>
              <p>{email}</p>
            </div>

            <div className="bet-history">
              {tips.length ? (
                tips.map((tip) => {
                  const ev = tipEv(tip);
                  return (
                    <article className="bet-row" key={tip.id}>
                      <div>
                        <span className="bet-status">
                          {tip.validation_status ?? "UNRATED"}
                        </span>
                        <strong>{tip.event_name}</strong>
                        <small>
                          {tip.market} · {tip.selection} ·{" "}
                          {tip.bookmaker || "Bookmaker not set"}
                        </small>
                      </div>

                      <div className="bet-numbers">
                        <span>
                          {tip.quoted_odds ? decimalToFractional(tip.quoted_odds) : "—"}
                        </span>
                        <span>
                          Fair {tip.fair_odds ? decimalToFractional(tip.fair_odds) : "—"}
                        </span>
                        <span
                          className={
                            ev !== null && ev >= 0 ? "positive" : "negative"
                          }
                        >
                          {ev === null ? "EV —" : `EV ${(ev * 100).toFixed(1)}%`}
                        </span>
                      </div>

                      <div className="row-actions">
                        <button
                          className="mini-button danger"
                          onClick={() => deleteTip(tip.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty">
                  No tips saved yet. This watchlist stores information only—not
                  wagers.
                </div>
              )}
            </div>
          </section>

          <section className="shell section">
            <div className="panel pro-account-card">
              <span className="eyebrow">Footy Pro founding beta</span>
              <h2>
                {profile?.pro_waitlist_joined_at
                  ? "You’re on the list"
                  : "Join the founding waitlist"}
              </h2>
              <p className="muted">
                Target founder price: £9.99/month. No payment today. Pro is
                planned to include live value scanning, bookmaker
                line-shopping, price alerts, validated tip feeds and deeper
                model-performance analytics.
              </p>
              {!profile?.pro_waitlist_joined_at ? (
                <button onClick={joinWaitlist}>Join Pro waitlist</button>
              ) : (
                <Link className="secondary-cta" href="/pro">
                  View Pro plan
                </Link>
              )}
            </div>
          </section>
        </>
      )}

      <footer className="shell footer">
        <p>
          <strong>18+ only.</strong> Footy provides betting information and
          analytics. We do not accept or place bets.
        </p>
        <p>MODEL → FAIR PRICE → VALUE TIP → WATCH → ALERT</p>
      </footer>
    </main>
  );
}
