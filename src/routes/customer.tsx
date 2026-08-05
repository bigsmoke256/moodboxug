import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CartProvider } from "@/hooks/use-cart";
import { SupportChatProvider } from "@/hooks/use-support-chat";
import { CartDrawer } from "@/components/customer/CartDrawer";
import { SupportChat } from "@/components/customer/SupportChat";
import { Header } from "@/components/customer/Header";
import { Footer } from "@/components/customer/Footer";

export const Route = createFileRoute("/customer")({
  ssr: false,
  component: CustomerLayout,
});

function CustomerLayout() {
  return (
    <CartProvider>
      <SupportChatProvider>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
            <Outlet />
          </main>
          <Footer />
          <CartDrawer />
          <SupportChat />
          <Toaster position="top-center" richColors closeButton />
        </div>
      </SupportChatProvider>
    </CartProvider>
  );
}
