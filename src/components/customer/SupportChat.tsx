import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSupportChat } from "@/hooks/use-support-chat";
import { Link } from "@tanstack/react-router";

interface SupportMessage {
  id: string;
  sender: string;
  message: string;
  created_at: string;
}

export function SupportChat() {
  const { isOpen, open, close } = useSupportChat();
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("id, sender, message, created_at")
        .eq("customer_id", userId)
        .order("created_at", { ascending: true });
      if (active) setMessages(data ?? []);
    })();
    return () => {
      active = false;
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `customer_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isOpen]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("support_messages")
      .insert({ customer_id: userId, sender: "customer", message: text.slice(0, 2000) })
      .select("id, sender, message, created_at")
      .single();
    setSending(false);
    if (error) return;
    setDraft("");
    if (data) setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  };

  const greeting = useMemo(() => messages.length === 0, [messages.length]);

  return (
    <>
      {!isOpen && (
        <button
          onClick={open}
          aria-label="Open live support chat"
          className="glass-surface motion-button-elevate fixed right-4 bottom-4 z-40 grid h-14 w-14 place-items-center rounded-full text-primary shadow-soft md:right-6 md:bottom-6"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Live support"
          className="fixed right-0 bottom-0 z-50 flex h-[70vh] w-full flex-col overflow-hidden rounded-t-[20px] bg-card shadow-2xl animate-in slide-in-from-bottom duration-200 sm:right-6 sm:bottom-6 sm:h-[520px] sm:w-[380px] sm:rounded-[20px]"
        >
          <header className="flex items-start justify-between gap-3 bg-secondary px-4 py-3 text-secondary-foreground">
            <div>
              <p className="text-body font-semibold">Live Support</p>
              <p className="text-caption opacity-90">We usually reply instantly</p>
            </div>
            <button aria-label="Close support chat" onClick={close} className="rounded-full p-1 hover:bg-white/15">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-background px-4 py-4">
            {greeting && (
              <Bubble sender="admin" text="Hi there! How can we help you today?" />
            )}
            {messages.map((m) => (
              <Bubble key={m.id} sender={m.sender} text={m.message} />
            ))}
            <div ref={endRef} />
          </div>

          {auth.status === "signed-in" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
                placeholder="Type a message…"
                className="flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-body-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={sending || !draft.trim()}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="border-t border-border bg-card px-4 py-4 text-center">
              <p className="text-body-sm text-muted-foreground">Sign in to chat with our team.</p>
              <Link
                to="/auth"
                search={{ redirect: "/customer" }}
                onClick={close}
                className="mt-2 inline-block rounded-[10px] bg-primary px-4 py-2 text-body-sm font-semibold text-primary-foreground"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Bubble({ sender, text }: { sender: string; text: string }) {
  const mine = sender === "customer";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[80%] rounded-[16px] px-3 py-2 text-body-sm ${
          mine ? "bg-primary text-primary-foreground" : "bg-card text-charcoal shadow-soft"
        }`}
      >
        {text}
      </p>
    </div>
  );
}
