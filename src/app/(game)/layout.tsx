import BottomNav from "@/components/ui/BottomNav";
import AppHeader from "@/components/ui/AppHeader";

export const dynamic = "force-dynamic";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader />
      <main className="flex-1 pb-safe">{children}</main>
      <BottomNav />
    </div>
  );
}
