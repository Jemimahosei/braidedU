import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  clearAuth,
  getStoredUser,
  storeAuth,
  type AuthUser,
} from "./api";

interface AuthCtx {
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({ user: null, signIn: () => {}, signOut: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  // The API layer drops a dead session token when the server says it is
  // invalid (e.g. from before the site moved databases); reflect that
  // in the header immediately instead of showing a logged-in ghost.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("braidedu:session-expired", onExpired);
    return () => window.removeEventListener("braidedu:session-expired", onExpired);
  }, []);
  return (
    <Ctx.Provider
      value={{
        user,
        signIn: (token, u) => {
          storeAuth(token, u);
          setUser(u);
        },
        signOut: () => {
          clearAuth();
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
