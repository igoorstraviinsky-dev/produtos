import type { FormEvent } from "react";

import { Field } from "./ui";
import type { AdminSessionConfig } from "../types";

type LoginPageProps = {
  config: AdminSessionConfig | null;
  username: string;
  password: string;
  loginState: "idle" | "loading" | "error";
  errorMessage: string;
  healthState: "idle" | "loading" | "success" | "error";
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginPage(props: LoginPageProps) {
  const {
    config,
    username,
    password,
    loginState,
    errorMessage,
    healthState,
    onUsernameChange,
    onPasswordChange,
    onSubmit
  } = props;

  const loginMode = config?.loginMode ?? "credentials";
  const usesCredentials = loginMode === "credentials";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_22%)]" />
      <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="surface-panel rounded-[2.2rem] p-8">
            <div className="surface-chip-active inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
              Painel Super Admin
              <span className="h-2 w-2 rounded-full bg-cyan-300" />
            </div>
            <h1 className="mt-5 font-display text-4xl tracking-tight text-slate-50 sm:text-5xl">
              Acesso administrativo
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
              Entre no painel para gerenciar empresas, estoques isolados, chaves de API e
              custos da mercadoria a partir de uma unica interface.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="surface-card rounded-[1.5rem] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Modo
                </p>
                <p className="mt-3 font-display text-2xl tracking-tight text-slate-50">
                  {loginMode === "credentials"
                    ? "Usuario + senha"
                    : loginMode === "token"
                      ? "Token seguro"
                      : "Acesso local"}
                </p>
              </div>
              <div className="surface-card rounded-[1.5rem] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sessao
                </p>
                <p className="mt-3 font-display text-2xl tracking-tight text-slate-50">
                  {config ? `${Math.floor(config.sessionTtlSeconds / 3600)}h` : "--"}
                </p>
              </div>
              <div className="surface-card rounded-[1.5rem] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  API local
                </p>
                <p className="mt-3 font-display text-2xl tracking-tight text-slate-50">
                  {healthState === "success" ? "Online" : healthState === "error" ? "Offline" : "..."}
                </p>
              </div>
            </div>
          </section>

          <section className="surface-panel rounded-[2.2rem] p-8 text-white">
            <p className="surface-kicker">
              Entrar
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-tight">
              {usesCredentials ? "Use suas credenciais" : "Use o token administrativo"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {usesCredentials
                ? "Autenticamos a sessao no backend e liberamos o painel sem expor o segredo nas chamadas seguintes."
                : "Se o ambiente estiver usando token administrativo, basta informar o token como senha para abrir a sessao segura."}
            </p>
            <div className="mt-4">
              <a
                href="/docs/api-estoque"
                className="surface-button-secondary inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition"
              >
                Ver documentacao publica da API
              </a>
            </div>

            <form className="mt-8 space-y-5" onSubmit={onSubmit}>
              {usesCredentials ? (
                <Field
                  label="Usuario"
                  value={username}
                  onChange={onUsernameChange}
                  placeholder={config?.usernameHint ?? "admin"}
                />
              ) : null}

              <Field
                label={usesCredentials ? "Senha" : "Token administrativo"}
                type="password"
                value={password}
                onChange={onPasswordChange}
                placeholder={usesCredentials ? "Digite sua senha" : "Cole o token de acesso"}
              />

              {errorMessage ? (
                <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loginState === "loading"}
                className="surface-button-primary w-full rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginState === "loading" ? "Entrando..." : "Acessar painel"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
