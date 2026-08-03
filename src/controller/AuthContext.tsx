/**
 * Controller — shared authentication context.
 * Mirrors RipassiContext: a single useAuth instance for the whole app, so
 * there is one Supabase listener and one copy of session / error / Drive
 * authorization. Calling the hook per screen gave each one its own state,
 * so an error raised by the login screen or a Drive authorization granted
 * from the form was invisible everywhere else.
 */
import React, { createContext, use } from "react";
import { useAuth, type StatoAuth } from "./auth/useAuth";

const Ctx = createContext<StatoAuth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <Ctx value={auth}>{children}</Ctx>;
}

export function useAuthCtx(): StatoAuth {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useAuthCtx must be used inside <AuthProvider>.");
  return ctx;
}
