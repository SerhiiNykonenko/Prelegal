import { MutualNdaForm } from "@/components/MutualNdaForm";
import { AppShell } from "@/components/AppShell";

export default function MutualNdaWorkspacePage() {
  return (
    <AppShell title="Mutual NDA">
      <section className="workspace-content">
        <section className="hero workspace-hero">
          <p className="eyebrow">Agreements</p>
          <h2>Create a Mutual NDA</h2>
          <p>
            Fill in the Common Paper Mutual NDA cover page, preview the key agreement
            terms, and download a completed PDF for local use.
          </p>
        </section>
        <MutualNdaForm initialDate="" />
      </section>
    </AppShell>
  );
}
