"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecentDocumentDrafts, type RecentDocumentDraftSummary } from "@/lib/api";
import { documentEntries, documentRegistry } from "@/lib/documentRegistry";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function DashboardHome() {
  const [recentDrafts, setRecentDrafts] = useState<RecentDocumentDraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRecentDocumentDrafts()
      .then((response) => {
        if (!cancelled) {
          setRecentDrafts(response.drafts);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
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

      <article className="card dashboard-card dashboard-card-wide dashboard-card-previous">
        <p className="eyebrow">Previous documents</p>
        <h2>Continue your documents</h2>
        <p>Return to the latest saved draft for each agreement type you have opened.</p>
        {isLoading ? <p className="empty-state">Loading saved drafts...</p> : null}
        {!isLoading && recentDrafts.length > 0 ? (
          <div className="recent-document-list">
            {recentDrafts.map((draft) => {
              const entry = documentRegistry[draft.documentKey];
              return (
                <Link key={draft.documentKey} className="recent-document-card" href={`/app/agreements/${draft.documentKey}`}>
                  <span className="recent-document-title">{entry.title}</span>
                  <span className="recent-document-description">{draft.documentTitle || entry.description}</span>
                  <span className="recent-document-meta">{draft.status} · Updated {formatDate(draft.updatedAt)}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
        {!isLoading && recentDrafts.length === 0 ? (
          <p className="empty-state">Your saved drafts will appear here after you start working on an agreement.</p>
        ) : null}
      </article>
    </section>
  );
}
