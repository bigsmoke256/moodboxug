import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/customer/Hero";
import { FeatureStrip } from "@/components/customer/FeatureStrip";
import { MenuExplorer } from "@/components/customer/MenuExplorer";
import { PopularPicks } from "@/components/customer/PopularPicks";
import { PromotionsBanner } from "@/components/customer/PromotionsBanner";
import { CateringSection } from "@/components/customer/CateringSection";
import { Newsletter } from "@/components/customer/Newsletter";


export const Route = createFileRoute("/customer/")({
  component: CustomerHome,
  head: () => ({
    meta: [
      { title: "Moodbox — Good Food, Good Mood" },
      {
        name: "description",
        content:
          "Delicious meals made with love and the freshest ingredients. Order in, cater your event, and enjoy — that's the Moodbox way.",
      },
      { property: "og:title", content: "Moodbox — Good Food, Good Mood" },
      {
        property: "og:description",
        content: "Delicious meals made with love and the freshest ingredients.",
      },
    ],
  }),
});

function CustomerHome() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <PopularPicks />
      <PromotionsBanner />
      <CateringSection />
      <Newsletter />
    </>
  );
}
