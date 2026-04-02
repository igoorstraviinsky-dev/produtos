import { useRef, useState } from "react";

import type { Company } from "../types";
import { EmptyState, StatusChip } from "./ui";

type CompanyCardsDashboardProps = {
  companies: Company[];
  companiesState: "idle" | "loading" | "success" | "error";
  onOpenCreate: () => void;
  onOpenCompany: (companyId: string) => void;
  onOpenDocs: () => void;
  onOpenPartnerCosts: () => void;
};

function CompanyWorkspaceCard(props: {
  company: Company;
  onOpenCompany: (companyId: string) => void;
}) {
  const { company, onOpenCompany } = props;

  return (
    <button
      type="button"
      onClick={() => onOpenCompany(company.id)}
      className="surface-card group flex h-full flex-col rounded-[1.9rem] p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_18px_50px_rgba(8,145,178,0.16)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="surface-chip-active inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]">
            Workspace
          </div>
          <p className="mt-4 font-display text-[1.65rem] leading-tight tracking-tight text-slate-50">
            {company.legalName}
          </p>
          <p className="mt-2 text-sm text-slate-400">{company.externalCode}</p>
        </div>
        <StatusChip active={company.isActive}>
          {company.isActive ? "Ativa" : "Inativa"}
        </StatusChip>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="surface-card-muted rounded-[1.3rem] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Chaves emitidas
          </p>
          <p className="mt-3 font-display text-3xl tracking-tight text-slate-50">
            {String(company.apiKeyCount).padStart(2, "0")}
          </p>
        </div>

        <div className="rounded-[1.3rem] border border-fuchsia-500/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.24),rgba(217,70,239,0.12))] px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100/80">
            Chaves ativas
          </p>
          <p className="mt-3 font-display text-3xl tracking-tight text-white">
            {String(company.activeKeyCount).padStart(2, "0")}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Abrir empresa</span>
        <span className="text-cyan-300 transition group-hover:text-cyan-200">Entrar</span>
      </div>
    </button>
  );
}

export function CompanyCardsDashboard(props: CompanyCardsDashboardProps) {
  const {
    companies,
    companiesState,
    onOpenCreate,
    onOpenCompany,
    onOpenDocs,
    onOpenPartnerCosts
  } = props;
  const heroSectionRef = useRef<HTMLDivElement | null>(null);
  const companiesSectionRef = useRef<HTMLDivElement | null>(null);
  const [activeWorkspaceItem, setActiveWorkspaceItem] = useState("Empresas ativas");

  function scrollToSection(target: "hero" | "companies") {
    const element = target === "hero" ? heroSectionRef.current : companiesSectionRef.current;
    element?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const workspaceItems = [
    { id: "inbox", label: "Inbox de operacoes" },
    { id: "companies", label: "Empresas ativas" },
    { id: "costs", label: "Custos por parceiro" },
    { id: "docs", label: "Documentacao publica" }
  ];

  function handleWorkspaceItemClick(itemId: string, label: string) {
    setActiveWorkspaceItem(label);

    if (itemId === "inbox") {
      scrollToSection("hero");
      return;
    }

    if (itemId === "companies") {
      scrollToSection("companies");
      return;
    }

    if (itemId === "costs") {
      onOpenPartnerCosts();
      return;
    }

    onOpenDocs();
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="surface-panel rounded-[2.1rem] p-5">
        <div className="surface-chip-active inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]">
          Partner OS
        </div>

        <div className="mt-6 space-y-3">
          {workspaceItems.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => handleWorkspaceItemClick(item.id, item.label)}
              className={[
                "surface-card flex w-full items-center gap-3 rounded-[1.35rem] px-4 py-3 text-left transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.08]",
                activeWorkspaceItem === item.label ? "border-cyan-400/20 bg-cyan-400/[0.08]" : ""
              ].join(" ")}
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/6 text-xs font-semibold text-slate-200">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm text-slate-300">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4">
          <p className="surface-kicker">Workspace</p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Cada empresa funciona como um ambiente isolado de estoque, chaves e custos.
          </p>
          <button
            type="button"
            onClick={onOpenCreate}
            className="surface-button-primary mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition"
          >
            Nova empresa
          </button>
        </div>
      </aside>

      <section className="surface-panel rounded-[2.2rem] p-6 sm:p-7">
        <div ref={heroSectionRef} className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_320px]">
          <div className="surface-card overflow-hidden rounded-[2rem] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="surface-chip rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                Operacao central
              </div>
              <div className="surface-chip-active rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em]">
                Estoque B2B
              </div>
            </div>

            <h2 className="mt-6 max-w-3xl font-display text-4xl tracking-tight text-slate-50 sm:text-5xl">
              Central de empresas, estoque isolado e automacoes comerciais.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-400 sm:text-base">
              Abra qualquer parceiro para operar estoque proprio, credenciais de API e custos
              individualizados em uma interface unica inspirada em workspace SaaS.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenCreate}
                className="surface-button-primary rounded-full px-5 py-3 text-sm font-semibold transition"
              >
                Criar empresa
              </button>
              <div className="surface-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
                Supervisao em tempo real
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="surface-card rounded-[1.8rem] p-5">
              <p className="surface-kicker">Leitura rapida</p>
              <p className="mt-4 font-display text-3xl tracking-tight text-slate-50">
                {String(companies.length).padStart(2, "0")}
              </p>
              <p className="mt-2 text-sm text-slate-400">Empresas disponiveis para operar</p>
            </div>

            <div className="rounded-[1.8rem] border border-cyan-400/20 bg-[linear-gradient(160deg,rgba(34,211,238,0.18),rgba(168,85,247,0.12),rgba(15,23,42,0.9))] p-5">
              <p className="surface-kicker text-cyan-100">Visao atual</p>
              <p className="mt-4 font-display text-2xl tracking-tight text-white">
                Dashboard modular
              </p>
              <p className="mt-3 text-sm leading-7 text-cyan-50/80">
                Cards reaproveitaveis, foco em contraste alto e camadas de vidro escuro.
              </p>
            </div>
          </div>
        </div>

        {companies.length === 0 && companiesState !== "loading" ? (
          <div className="mt-6">
            <EmptyState
              title="Nenhuma empresa cadastrada"
              description="Crie a primeira empresa para iniciar a operacao administrativa."
            />
          </div>
        ) : null}

        <div ref={companiesSectionRef} className="mt-7 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {companies.map((company) => (
            <CompanyWorkspaceCard
              key={company.id}
              company={company}
              onOpenCompany={onOpenCompany}
            />
          ))}
        </div>

        {companiesState === "loading" ? (
          <p className="mt-5 text-sm text-slate-400">Carregando empresas...</p>
        ) : null}
      </section>
    </section>
  );
}
