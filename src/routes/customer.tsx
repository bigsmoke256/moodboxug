import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CartProvider } from "@/hooks/use-cart";
import { Header } from "@/components/customer/Header";
import { Footer } from "@/components/customer/Footer";

export const Route = createFileRoute("/customer")({
  ssr: false,
  component: CustomerLayout,
});

function CustomerLayout() {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </CartProvider>
  );
}
