import Footer from "@/features/landing/components/Footer";
import Header from "@/features/landing/components/Header";

interface PageFrameProps {
  children: React.ReactNode;
}

export default function PageFrame({ children }: PageFrameProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground antialiased">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  );
}
