import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { documentEntries } from "@/lib/documentRegistry";

export default function AppHomePage() {
  return (
    <AppShell title="Dashboard">
      <section className="dashboard-grid">
        <article className="card dashboard-card dashboard-card-wide">
          <p className="eyebrow">Documents</p>
          <h2>Start a new agreement</h2>
          <p>Pick a supported Common Paper template. Each agreement uses the same chat + form workspace.</p>
          <div className="dashboard-document-list">
            {documentEntries.map(([key, entry]) => (
              <Link key={key} className="primary-button dashboard-document-button" href={`/app/agreements/${key}`}>
                <span className="dashboard-document-title">{entry.title}</span>
                <span className="dashboard-document-description">{entry.description}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}