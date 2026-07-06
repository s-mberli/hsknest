import { redirect } from "next/navigation";

import { BottomNav } from "@/components/BottomNav";
import { ThemeSync } from "@/components/ThemeSync";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { theme: true },
  });

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ThemeSync theme={user?.theme ?? "system"} />
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </div>
  );
}
