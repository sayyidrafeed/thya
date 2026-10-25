import { DeveloperDayCta } from "@/components/landing/developerday-cta";
import { Faq } from "@/components/landing/faq";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MeetThya } from "@/components/landing/meet-thya";
import { Problem } from "@/components/landing/problem";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Testimonials } from "@/components/landing/testimonials";
import { MotionProvider } from "@/components/motion/motion-provider";
import { Playground } from "@/components/playground/playground";

export default function HomePage() {
  return (
    <MotionProvider>
      <div id="top" className="min-h-dvh">
        <SiteHeader />
        <main className="pt-16">
          <Hero />
          <MeetThya />
          <Problem />
          <HowItWorks />
          <Playground />
          <Testimonials />
          <Faq />
          <DeveloperDayCta />
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
