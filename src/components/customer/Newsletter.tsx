import { Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().trim().email().max(255);

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setStatus("error");
      setMessage("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: parsed.data });
    if (error && error.code !== "23505") {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
      return;
    }
    setStatus("success");
    setMessage("You're in — welcome to the Mood.");
    setEmail("");
  };

  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <Mail className="h-10 w-10 shrink-0" strokeWidth={1.5} />
          <div className="min-w-0">
            <h2 className="text-h1 text-white" style={{ fontFamily: "var(--font-display)" }}>
              Stay in the Mood
            </h2>
            <p className="mt-1 text-body text-white/80">
              Subscribe for exclusive offers, new menu updates & more.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-stretch gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="min-w-0 flex-1 rounded-[12px] bg-paper px-4 py-3 text-sm text-ink outline-none ring-2 ring-transparent focus:ring-white/60"
              maxLength={255}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="motion-button-elevate shrink-0 rounded-[12px] bg-paper px-5 py-3 text-sm font-semibold text-primary disabled:opacity-70"
            >
              {status === "loading" ? "…" : "Subscribe"}
            </button>
          </div>
        </form>

        {status !== "idle" && status !== "loading" && (
          <p
            className={`col-span-full text-body-sm ${
              status === "success" ? "text-white" : "text-white/90"
            }`}
            role="status"
          >
            {message}
          </p>
        )}

        {/* decorative circle */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/2 hidden h-72 w-72 -translate-y-1/2 text-white/20 md:block"
          viewBox="0 0 200 200"
          fill="none"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx="100" cy="100" r={30 + i * 15} stroke="currentColor" strokeWidth="1" />
          ))}
        </svg>
      </div>
    </section>
  );
}
