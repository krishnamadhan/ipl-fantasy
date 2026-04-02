import BottomNav from "@/components/ui/BottomNav";

export const dynamic = "force-dynamic";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-safe">{children}</main>
      <BottomNav />
    </div>
  );
}
