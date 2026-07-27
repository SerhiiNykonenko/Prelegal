"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { documentEntries } from "@/lib/documentRegistry";

type AppShellProps = {
  title: string;
  children: React.ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    clearSession();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar card">
        <div>
          <p className="eyebrow">Prelegal</p>
          <h2>Workspace</h2>
        </div>
        <nav className="workspace-nav">
          <Link href="/app">Dashboard</Link>
          {documentEntries.map(([key, entry]) => (
            <Link key={key} href={`/app/agreements/${key}`}>{entry.title}</Link>
          ))}
        </nav>
        <div className="workspace-user">
          <p>Secure workspace</p>
          <button className="secondary-button" type="button" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-header card">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1>{title}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
