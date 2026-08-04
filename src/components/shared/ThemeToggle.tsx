import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

interface ThemeToggleProps {
  /** Use the light-on-dark treatment (admin sidebar, kitchen screens). */
  onDark?: boolean;
  className?: string;
}

export function ThemeToggle({ onDark = false, className = "" }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${
        onDark ? "text-white/70 hover:bg-white/10 hover:text-white" : "text-foreground hover:bg-muted"
      } ${className}`}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
