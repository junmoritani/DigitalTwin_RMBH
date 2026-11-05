import { useEffect, useState } from "react";
import { IoClose, IoLogoGoogle, IoShieldCheckmarkOutline } from "react-icons/io5";
import { useAuth } from "../../context/AuthContext";

function AuthModal() {
  const {
    authModalOpen,
    authModalTab,
    authPromptMessage,
    closeAuthModal,
    signInWithPassword,
    signUp,
    signInWithGoogle,
    isSupabaseConfigured,
  } = useAuth();

  const [tab, setTab] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setTab(authModalTab || "login");
      setError("");
      setNotice("");
    }
  }, [authModalOpen, authModalTab]);

  useEffect(() => {
    if (!authModalOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") closeAuthModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      if (tab === "login") {
        await signInWithPassword({ email, password });
        closeAuthModal();
      } else {
        const createdUser = await signUp({ fullName, email, password });
        if (isSupabaseConfigured && !createdUser?.confirmed_at) {
          setNotice(
            "Conta criada! Verifique seu e-mail para confirmar o cadastro ou faça login."
          );
          setTab("login");
        } else {
          closeAuthModal();
        }
      }
    } catch (err) {
      setError(err.message || "Não foi possível autenticar agora.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1px] max-md:items-stretch max-md:bg-PrimaryDark max-md:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl max-md:flex max-md:max-w-none max-md:flex-col max-md:rounded-none max-md:border-0 max-md:shadow-none">
        <div className="flex items-center justify-between border-b border-gray-100 bg-PrimaryDark px-5 py-4 text-white max-md:border-0 max-md:px-5 max-md:pt-8 max-md:pb-7">
          <div>
            <h2 id="auth-modal-title" className="text-base font-semibold max-md:text-2xl">
              {tab === "login" ? "Entrar na sua conta" : "Criar conta colaborativa"}
            </h2>
            <p className="text-xs text-white/75">
              GDU RMBH · Inventário Arbóreo Colaborativo
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Fechar janela de acesso"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <IoClose className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 max-md:flex-1">
          {authPromptMessage && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-PrimaryLight/30 bg-PrimaryLight/10 px-3.5 py-2.5 text-xs leading-relaxed text-PrimaryDark">
              <IoShieldCheckmarkOutline className="mt-0.5 h-4 w-4 shrink-0 text-PrimaryLight" />
              <span>{authPromptMessage}</span>
            </div>
          )}

          <div
            role="tablist"
            aria-label="Tipo de acesso"
            className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              onClick={() => {
                setTab("login");
                setError("");
              }}
              className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition ${
                tab === "login"
                  ? "bg-white text-PrimaryDark shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "signup"}
              onClick={() => {
                setTab("signup");
                setError("");
              }}
              className={`cursor-pointer rounded-lg py-2 text-xs font-semibold transition ${
                tab === "signup"
                  ? "bg-white text-PrimaryDark shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {tab === "signup" && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="mb-1 block text-xs font-semibold text-gray-700"
                >
                  Nome completo
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Gustavo Silva"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-PrimaryLight focus:bg-white focus:outline-none focus:ring-2 focus:ring-PrimaryLight/30"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="mb-1 block text-xs font-semibold text-gray-700"
              >
                E-mail
              </label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-PrimaryLight focus:bg-white focus:outline-none focus:ring-2 focus:ring-PrimaryLight/30"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="mb-1 block text-xs font-semibold text-gray-700"
              >
                Senha
              </label>
              <input
                id="auth-password"
                type="password"
                required
                autoComplete={tab === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-PrimaryLight focus:bg-white focus:outline-none focus:ring-2 focus:ring-PrimaryLight/30"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-xl bg-PrimaryLight py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-PrimaryDark disabled:opacity-60"
            >
              {submitting
                ? "Processando…"
                : tab === "login"
                  ? "Entrar"
                  : "Criar minha conta"}
            </button>
          </form>

          {isSupabaseConfigured && (
            <div className="mt-4">
              <div className="relative flex items-center justify-center">
                <span className="w-full border-t border-gray-200" />
                <span className="bg-white px-2 text-[11px] text-gray-400">ou</span>
                <span className="w-full border-t border-gray-200" />
              </div>
              <button
                type="button"
                onClick={handleGoogle}
                className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <IoLogoGoogle className="h-4 w-4 text-gray-600" />
                Continuar com Google
              </button>
            </div>
          )}

          {!isSupabaseConfigured && (
            <p className="mt-3 text-center text-[11px] leading-snug text-gray-400">
              Modo de demonstração local ativo. Configure{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-600">
                VITE_SUPABASE_URL
              </code>{" "}
              para sincronizar com a nuvem Supabase.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
