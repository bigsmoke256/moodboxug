import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CartProvider } from "@/hooks/use-cart";
import { Header } from "@/components/customer/Header";
import { Footer } from "@/components/customer/Footer";

export const Route = createFileRoute("/catering")({
  ssr: false,
  component: CateringStub,
  head: () => ({
    meta: [
      { title: "Catering — Moodbox" },
      {
        name: "description",
        content:
          "Moodbox catering for weddings, birthdays, corporate events, private parties, and memorials in Kampala.",
      },
    ],
  }),
});

function CateringStub() {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
          <p className="text-eyebrow">Coming Soon</p>
          <h1 className="text-display-2 text-charcoal">Catering</h1>
          <p className="max-w-md text-body text-muted-foreground">
            The full catering experience is on its way. In the meantime, reach out and we'll cater
            your next event.
          </p>
          <Link
            to="/customer"
            className="motion-button-elevate mt-4 inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </main>
        <Footer />
      </div>
    </CartProvider>
  );
}
