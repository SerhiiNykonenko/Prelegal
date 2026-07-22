import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = cookieStore.get("prelegal_session");

  if (!session) {
    redirect("/login");
  }

  return children;
}
