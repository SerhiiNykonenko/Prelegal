"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, loadSession } from "@/lib/auth";

type AppShellProps = {
  title: string;
  children: React.ReactNode;
};

export function AppShell({ title, children }: AppShellProps) {
  const router = useRouter();
  const session = loadSession();

  function handleSignOut() {
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
          <Link href="/app/agreements/mutual-nda">Mutual NDA</Link>
        </nav>
        <div className="workspace-user">
          <p>{session?.email ?? "Prototype user"}</p>
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
