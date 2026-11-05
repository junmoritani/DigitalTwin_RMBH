import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const LOCAL_SESSION_KEY = "gdu_rmbh_local_auth_user";
const LOCAL_ACCOUNTS_KEY = "gdu_rmbh_local_accounts";

function readLocalAccounts() {
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_ACCOUNTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts) {
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // ignore storage errors
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");
  const [authPromptMessage, setAuthPromptMessage] = useState("");

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      let mounted = true;
      supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        setLoading(false);
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    try {
      const saved = window.localStorage.getItem(LOCAL_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setSession({ user: parsed, mode: "local" });
      }
    } catch {
      // ignore invalid local session
    }
    setLoading(false);
  }, []);

  const openAuthModal = (tab = "login", promptMessage = "") => {
    setAuthModalTab(tab);
    setAuthPromptMessage(promptMessage);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setAuthPromptMessage("");
  };

  const signInWithPassword = async ({ email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error("Informe seu e-mail e sua senha.");
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error) {
        throw new Error(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message
        );
      }
      return data.user;
    }

    const accounts = readLocalAccounts();
    const match = accounts.find((acc) => acc.email === cleanEmail);
    if (match && match.password !== password) {
      throw new Error("E-mail ou senha incorretos.");
    }

    const localUser = match
      ? {
          id: match.id,
          email: match.email,
          user_metadata: { full_name: match.fullName },
        }
      : {
          id: `local-${cleanEmail}`,
          email: cleanEmail,
          user_metadata: {
            full_name: cleanEmail.split("@")[0],
          },
        };

    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
    setUser(localUser);
    setSession({ user: localUser, mode: "local" });
    return localUser;
  };

  const signUp = async ({ fullName, email, password }) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanName) {
      throw new Error("Informe seu nome.");
    }
    if (!cleanEmail) {
      throw new Error("Informe um e-mail válido.");
    }
    if (!password || password.length < 6) {
      throw new Error("A senha deve ter pelo menos 6 caracteres.");
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: cleanName },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      return data.user;
    }

    const accounts = readLocalAccounts();
    if (accounts.some((acc) => acc.email === cleanEmail)) {
      throw new Error("Este e-mail já está cadastrado. Faça login.");
    }

    const newAccount = {
      id: `local-${Date.now()}`,
      email: cleanEmail,
      fullName: cleanName,
      password,
    };
    writeLocalAccounts([...accounts, newAccount]);

    const localUser = {
      id: newAccount.id,
      email: newAccount.email,
      user_metadata: { full_name: newAccount.fullName },
    };
    window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(localUser));
    setUser(localUser);
    setSession({ user: localUser, mode: "local" });
    return localUser;
  };

  const signInWithGoogle = async () => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      return;
    }
    throw new Error(
      "Para entrar com o Google, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env."
    );
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isSupabaseConfigured,
        authModalOpen,
        authModalTab,
        authPromptMessage,
        openAuthModal,
        closeAuthModal,
        signInWithPassword,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return ctx;
}
