import type { Company } from "../types";
import { EmptyState, StatusChip } from "./ui";

type CompanyCardsDashboardProps = {
  companies: Company[];
  companiesState: "idle" | "loading" | "success" | "error";
  onOpenCreate: () => void;
  onOpenCompany: (companyId: string) => void;
};

export function CompanyCardsDashboard(props: CompanyCardsDashboardProps) {
  const { companies, companiesState, onOpenCreate, onOpenCompany } = props;

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Dashboard de Clientes
            </p>
            <h2 className="mt-2 font-display text-4xl tracking-tight text-slate-950">
              Super Admin
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Abra qualquer empresa para editar configuracoes, gerenciar chaves de API
              e ajustar o estoque isolado daquela operacao sem usar API key no painel.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenCreate}
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Nova empresa
          </button>
        </div>

        {companies.length === 0 && companiesState !== "loading" ? (
          <div className="mt-6">
            <EmptyState
              title="Nenhuma empresa cadastrada"
              description="Crie a primeira empresa para iniciar a operacao administrativa."
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => onOpenCompany(company.id)}
              className="group rounded-[1.75rem] border border-slate-200 bg-white p-5 text-left shadow-[0_16px_40px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-[0_20px_50px_rgba(15,118,110,0.12)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-display text-2xl tracking-tight text-slate-950">
                    {company.legalName}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{company.externalCode}</p>
                </div>
                <StatusChip active={company.isActive}>
                  {company.isActive ? "Ativa" : "Inativa"}
                </StatusChip>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Chaves emitidas
                  </p>
                  <p className="mt-2 font-display text-3xl tracking-tight text-slate-950">
                    {company.apiKeyCount}
                  </p>
                </div>
                <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    Chaves ativas
                  </p>
                  <p className="mt-2 font-display text-3xl tracking-tight text-emerald-900">
                    {company.activeKeyCount}
                  </p>
                </div>
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 transition group-hover:text-teal-700">
                Abrir visao da empresa
              </p>
            </button>
          ))}
        </div>

        {companiesState === "loading" ? (
          <p className="mt-4 text-sm text-slate-500">Carregando empresas...</p>
        ) : null}
      </div>
    </section>
  );
}
