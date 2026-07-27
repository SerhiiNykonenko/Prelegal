import { AppShell } from "@/components/AppShell";
import { DashboardHome } from "@/components/DashboardHome";

export default function AppHomePage() {
  return (
    <AppShell title="Dashboard">
      <DashboardHome />
    </AppShell>
  );
}