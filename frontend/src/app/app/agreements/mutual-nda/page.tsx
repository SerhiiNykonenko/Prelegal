import { MutualNdaWorkspace } from "@/components/document-workspace/MutualNdaWorkspace";
import { AppShell } from "@/components/AppShell";
import { documentRegistry } from "@/lib/documentRegistry";

export default function MutualNdaWorkspacePage() {
  const entry = documentRegistry["mutual-nda"];

  return (
    <AppShell title={entry.title}>
      <section className="workspace-content">
        <section className="hero workspace-hero">
          <p className="eyebrow">Agreements</p>
          <h2>{entry.title}</h2>
          <p>{entry.description}</p>
        </section>
        <MutualNdaWorkspace documentKey="mutual-nda" />
      </section>
    </AppShell>
  );
}