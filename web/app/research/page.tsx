import Link from "next/link";
import { ResearchHub } from "@/components/research-hub";

export default function ResearchPage() {
  return (
    <main className="league-edge-app research-page">
      <nav className="nav shell hq-nav">
        <Link className="brand brand-link" href="/">
          <span className="brand-mark">F</span>
          <span>Footy</span>
        </Link>
        <div className="hq-nav-right">
          <Link href="/">HQ</Link>
          <span>Research</span>
        </div>
      </nav>
      <div className="shell">
        <ResearchHub />
      </div>
    </main>
  );
}
