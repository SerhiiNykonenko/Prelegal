import { MutualNdaForm } from "@/components/MutualNdaForm";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Prelegal prototype</p>
        <h1>Create a Mutual NDA</h1>
        <p>
          Fill in the Common Paper Mutual NDA cover page, preview the key agreement
          terms, and download a completed PDF for local use.
        </p>
      </section>

      <MutualNdaForm initialDate="" />
    </main>
  );
}
