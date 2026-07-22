import Link from "next/link";
import { AppShell } from "@/components/AppShell";

export default function AppHomePage() {
  return (
    <AppShell title="Dashboard">
      <section className="dashboard-grid">
        <article className="card dashboard-card">
          <p className="eyebrow">Documents</p>
          <h2>Start a Mutual NDA</h2>
          <p>Open the existing Mutual NDA creator inside the new workspace shell.</p>
          <Link className="primary-button" href="/app/agreements/mutual-nda">Open Mutual NDA</Link>
        </article>
        <article className="card dashboard-card">
          <p className="eyebrow">Foundation</p>
          <h2>V1 stack is ready</h2>
          <p>The prototype now has a frontend shell, backend foundation, and SQLite user storage.</p>
        </article>
      </section>
    </AppShell>
  );
}
