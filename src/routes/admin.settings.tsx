import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

const RESTAURANT_ID = "61548a61-12cb-4a04-ad26-d57264e9e436";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

interface Settings {
  address: string;
  phone: string;
  delivery_fee: number;
  tax_rate: number;
  opening_hours: Record<string, DayHours>;
}

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(30),
  delivery_fee: z.number().min(0).max(1_000_000),
  tax_rate: z.number().min(0).max(100),
});

const DEFAULT_HOURS: Record<string, DayHours> = Object.fromEntries(
  DAYS.map((d) => [d.key, { open: "09:00", close: "22:00", closed: false }]),
);

function AdminSettings() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["restaurant-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, settings")
        .eq("id", RESTAURANT_ID)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [settings, setSettings] = useState<Settings>({
    address: "",
    phone: "",
    delivery_fee: 5000,
    tax_rate: 0,
    opening_hours: DEFAULT_HOURS,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? "");
    const s = (data.settings ?? {}) as Partial<Settings>;
    setSettings({
      address: s.address ?? "",
      phone: s.phone ?? "",
      delivery_fee: Number(s.delivery_fee ?? 5000),
      tax_rate: Number(s.tax_rate ?? 0),
      opening_hours: { ...DEFAULT_HOURS, ...(s.opening_hours ?? {}) },
    });
  }, [data]);

  const save = async () => {
    const parsed = Schema.safeParse({
      name,
      address: settings.address,
      phone: settings.phone,
      delivery_fee: Number(settings.delivery_fee),
      tax_rate: Number(settings.tax_rate),
    });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[String(issue.path[0])] = issue.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const nextSettings = {
        address: parsed.data.address,
        phone: parsed.data.phone,
        delivery_fee: parsed.data.delivery_fee,
        tax_rate: parsed.data.tax_rate,
        opening_hours: settings.opening_hours,
      } as unknown as never;
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: parsed.data.name,
          settings: nextSettings,
        })
        .eq("id", RESTAURANT_ID);
      if (error) throw error;
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["restaurant-settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (day: string, patch: Partial<DayHours>) => {
    setSettings((s) => ({
      ...s,
      opening_hours: { ...s.opening_hours, [day]: { ...s.opening_hours[day], ...patch } },
    }));
  };

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-[16px] bg-card" />;
  }

  return (
    <div className="max-w-3xl">
      <p className="text-eyebrow">Configuration</p>
      <h1 className="mt-2 text-display-2 text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
        Settings
      </h1>

      <section className="mt-8 rounded-[20px] bg-card p-6 shadow-soft">
        <h2 className="text-h3 text-charcoal">Restaurant</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={errors.name}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Phone" error={errors.phone}>
            <input
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" error={errors.address}>
              <input
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[20px] bg-card p-6 shadow-soft">
        <h2 className="text-h3 text-charcoal">Pricing</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">
          Applied at checkout — the server recomputes every order using these values.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Delivery fee (UGX)" required error={errors.delivery_fee}>
            <input
              type="number"
              min={0}
              step={100}
              value={settings.delivery_fee}
              onChange={(e) => setSettings({ ...settings, delivery_fee: Number(e.target.value) })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Tax rate (%)" required error={errors.tax_rate}>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={settings.tax_rate}
              onChange={(e) => setSettings({ ...settings, tax_rate: Number(e.target.value) })}
              className="mt-1 w-full rounded-[12px] border border-input bg-background px-3 py-2 text-body outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>
      </section>

      <section className="mt-6 rounded-[20px] bg-card p-6 shadow-soft">
        <h2 className="text-h3 text-charcoal">Opening hours</h2>
        <div className="mt-4 space-y-2">
          {DAYS.map(({ key, label }) => {
            const h = settings.opening_hours[key] ?? DEFAULT_HOURS[key];
            return (
              <div key={key} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3">
                <span className="text-body-sm font-semibold text-charcoal">{label}</span>
                <input
                  type="time"
                  disabled={h.closed}
                  value={h.open}
                  onChange={(e) => updateDay(key, { open: e.target.value })}
                  className="rounded-[10px] border border-input bg-background px-2 py-1.5 text-body-sm disabled:opacity-40"
                />
                <input
                  type="time"
                  disabled={h.closed}
                  value={h.close}
                  onChange={(e) => updateDay(key, { close: e.target.value })}
                  className="rounded-[10px] border border-input bg-background px-2 py-1.5 text-body-sm disabled:opacity-40"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-caption text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={h.closed}
                    onChange={(e) => updateDay(key, { closed: e.target.checked })}
                    className="accent-primary"
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="motion-button-elevate mt-6 inline-flex items-center gap-2 rounded-[12px] bg-primary px-6 py-3 text-body-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-body-sm font-medium text-charcoal">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}
