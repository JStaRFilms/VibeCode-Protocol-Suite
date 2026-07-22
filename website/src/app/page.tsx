import Header from "@/features/landing/components/Header";
import Hero from "@/features/landing/components/Hero";
import ProofStrip from "@/features/landing/components/ProofStrip";
import Features from "@/features/landing/components/Features";
import Timeline from "@/features/landing/components/Timeline";
import PiDemo from "@/features/landing/components/PiDemo";
import InstallCTA from "@/features/landing/components/InstallCTA";
import Footer from "@/features/landing/components/Footer";
import { getTakomiVersion } from "@/features/site/getTakomiVersion";

export default function Home() {
  const version = getTakomiVersion();

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans antialiased text-foreground">
      <Header />
      <main className="flex-grow">
        <Hero version={version} />
        <ProofStrip />
        <Features />
        <PiDemo />
        <Timeline />
        <InstallCTA />
      </main>
      <Footer />
    </div>
  );
}
