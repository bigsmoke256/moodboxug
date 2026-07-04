import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CartProvider } from "@/hooks/use-cart";
import { CartDrawer } from "@/components/customer/CartDrawer";
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
        <CartDrawer />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </CartProvider>
  );
}
