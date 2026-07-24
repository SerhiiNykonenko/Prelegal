import { MutualNdaWorkspace } from "@/components/document-workspace/MutualNdaWorkspace";
import { AppShell } from "@/components/AppShell";

export default function MutualNdaWorkspacePage() {
  return (
    <AppShell title="Mutual NDA">
      <section className="workspace-content">
        <section className="hero workspace-hero">
          <p className="eyebrow">Agreements</p>
          <h2>Create a Mutual NDA</h2>
          <p>
            Use AI chat or structured form fields to complete the Common Paper Mutual NDA,
            review the extracted details, and download a completed PDF for local use.
          </p>
        </section>
        <MutualNdaWorkspace />
      </section>
    </AppShell>
  );
}
