import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MeetThya } from "@/components/landing/meet-thya";
import { Problem } from "@/components/landing/problem";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { MotionProvider } from "@/components/motion/motion-provider";

export default function HomePage() {
  return (
    <MotionProvider>
      <div id="top" className="min-h-dvh">
        <SiteHeader />
        <main>
          <Hero />
          <MeetThya />
          <Problem />
          <HowItWorks />
          <Faq />
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
