import { notFound } from "next/navigation";

import { MutualNdaWorkspace } from "@/components/document-workspace/MutualNdaWorkspace";
import { AppShell } from "@/components/AppShell";
import { documentRegistry, type documentEntries as _documentEntries } from "@/lib/documentRegistry";
import type { DocumentKey } from "@/lib/api";

type RouteParams = { documentKey: string };

function resolveDocumentKey(value: string): DocumentKey | null {
  return (Object.keys(documentRegistry) as DocumentKey[]).includes(value as DocumentKey)
    ? (value as DocumentKey)
    : null;
}

export default function DocumentWorkspacePage({ params }: { params: RouteParams }) {
  const key = resolveDocumentKey(params.documentKey);
  if (!key) {
    notFound();
  }

  const entry = documentRegistry[key];

  return (
    <AppShell title={entry.title}>
      <section className="workspace-content">
        <section className="hero workspace-hero">
          <p className="eyebrow">Agreements</p>
          <h2>{entry.title}</h2>
          <p>{entry.description}</p>
        </section>
        <MutualNdaWorkspace documentKey={key} />
      </section>
    </AppShell>
  );
}

export function generateStaticParams() {
  return (Object.keys(documentRegistry) as DocumentKey[]).map((documentKey) => ({ documentKey }));
}