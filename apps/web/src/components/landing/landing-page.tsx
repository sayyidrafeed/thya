import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { Hero } from "@/components/landing/hero";
import { MotionProvider } from "@/components/motion/motion-provider";

export function LandingPage() {
  return (
    <MotionProvider>
      <main className="flex min-h-dvh flex-col">
        <Hero />
        <FeatureShowcase />
      </main>
    </MotionProvider>
  );
}
