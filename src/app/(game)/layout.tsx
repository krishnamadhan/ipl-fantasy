import BottomNav from "@/components/ui/BottomNav";
import AppHeader from "@/components/ui/AppHeader";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";

export const dynamic = "force-dynamic";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Suspense fallback={null}>
        <AppHeader />
      </Suspense>
      <main className="flex-1 pb-safe">
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </main>
      <BottomNav />
    </div>
  );
}
