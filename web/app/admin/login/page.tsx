import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { hasAdminSession } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  if (await hasAdminSession()) redirect("/admin");

  return (
    <main className="league-edge-app admin-login-page">
      <nav className="nav shell">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
      </nav>

      <section className="shell admin-login-card">
        <span className="eyebrow">Owner access</span>
        <h1>Footy Feature Lab</h1>
        <p>
          Private owner workspace for testing every live and beta feature,
          checking data freshness and launching real FPL flows.
        </p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
