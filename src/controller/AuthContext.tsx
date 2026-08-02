/**
 * Controller — shared authentication context.
 * Mirrors RipassiContext: a single useAuth instance for the whole app, so
 * there is one Supabase listener and one copy of session / error / Drive
 * authorization. Calling the hook per screen gave each one its own state,
 * so an error raised by the login screen or a Drive authorization granted
 * from the form was invisible everywhere else.
 */
import React, { createContext, use } from "react";
import { useAuth } from "./useAuth";

type AuthCtx = ReturnType<typeof useAuth>;

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <Ctx value={useAuth()}>{children}</Ctx>;
}

export function useAuthCtx(): AuthCtx {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useAuthCtx must be used inside <AuthProvider>.");
  return ctx;
}
