import type { Company } from "../types";
import { Toggle } from "./Toggle";
import { StatusChip } from "./ui";

type CompaniesPanelProps = {
  companies: Company[];
  selectedCompanyId: string;
  companyActionId: string;
  companiesState: "idle" | "loading" | "success" | "error";
  onOpenCreate: () => void;
  onSelectCompany: (companyId: string) => void;
  onToggleCompany: (company: Company, nextValue: boolean) => void;
  formatDate: (value: string | null) => string;
};

export function CompaniesPanel(props: CompaniesPanelProps) {
  const {
    companies,
    selectedCompanyId,
    companyActionId,
    companiesState,
    onOpenCreate,
    onSelectCompany,
    onToggleCompany,
    formatDate
  } = props;

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Empresas
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight text-slate-950">
            Gestao de Companies
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Clique em uma empresa para abrir as chaves vinculadas e operar o zero trust
            em tempo real.
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

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Empresa</th>
                <th className="px-4 py-4 font-semibold">Codigo</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Criada em</th>
                <th className="px-4 py-4 font-semibold text-right">Acao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {companies.map((company) => {
                const isSelected = company.id === selectedCompanyId;

                return (
                  <tr
                    key={company.id}
                    className={[
                      "transition hover:bg-slate-50/90",
                      isSelected ? "bg-teal-50/70" : ""
                    ].join(" ")}
                  >
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onSelectCompany(company.id)}
                        className="text-left"
                      >
                        <p className="font-semibold text-slate-950">{company.legalName}</p>
                        <p className="mt-1 text-xs text-slate-500">ID {company.id}</p>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">{company.externalCode}</td>
                    <td className="px-4 py-4">
                      <StatusChip active={company.isActive}>
                        {company.isActive ? "Ativa" : "Inativa"}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          {company.isActive ? "Ligada" : "Desligada"}
                        </span>
                        <Toggle
                          checked={company.isActive}
                          disabled={companyActionId === company.id}
                          onChange={(nextValue) => onToggleCompany(company, nextValue)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {companiesState === "loading" ? (
        <p className="mt-4 text-sm text-slate-500">Carregando empresas...</p>
      ) : null}
    </section>
  );
}
