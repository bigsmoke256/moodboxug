import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface SupportChatState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const Ctx = createContext<SupportChatState | null>(null);

export function SupportChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const value = useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupportChat(): SupportChatState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSupportChat must be used inside <SupportChatProvider>");
  return ctx;
}
