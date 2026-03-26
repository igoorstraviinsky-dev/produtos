import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { CompanyCardsDashboard } from "./components/CompanyCardsDashboard";
import { CompanyDetailPage } from "./components/CompanyDetailPage";
import { CostCalculatorPage } from "./components/CostCalculatorPage";
import { LoginPage } from "./components/LoginPage";
import { Modal } from "./components/Modal";
import { Field, StatCard } from "./components/ui";
import { ApiError, api } from "./lib/api";
import type {
  AdminSession,
  AdminSessionConfig,
  AdminInventoryItem,
  ApiKeySummary,
  Company,
  IssuedApiKey,
  CostSettingsHistoryEntry,
  Product
} from "./types";

type AsyncState = "idle" | "loading" | "success" | "error";
type AppPage = "dashboard" | "company" | "costs";
type CompanyTab = "profile" | "keys" | "inventory";
type AuthState = "checking" | "authenticated" | "unauthenticated";

function getRouteState(pathname: string) {
  if (pathname === "/custos") {
    return {
      page: "costs" as const,
      companyId: ""
    };
  }

  const match = pathname.match(/^\/empresas\/([^/]+)$/);
  if (match) {
    return {
      page: "company" as const,
      companyId: decodeURIComponent(match[1])
    };
  }

  return {
    page: "dashboard" as const,
    companyId: ""
  };
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message}${error.code ? ` (${error.code})` : ""}`;
  }

  return error instanceof Error ? error.message : "Erro inesperado";
}

function createInventoryDrafts(items: AdminInventoryItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.productId,
      String(item.customStockQuantity ?? item.effectiveStockQuantity)
    ])
  );
}

function App() {
  const initialRoute = getRouteState(window.location.pathname);
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [sessionConfig, setSessionConfig] = useState<AdminSessionConfig | null>(null);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [loginState, setLoginState] = useState<"idle" | "loading" | "error">("idle");
  const [loginFeedback, setLoginFeedback] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [currentPage, setCurrentPage] = useState<AppPage>(initialRoute.page);
  const [selectedCompanyId, setSelectedCompanyId] = useState(initialRoute.companyId);
  const [activeTab, setActiveTab] = useState<CompanyTab>("inventory");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [inventory, setInventory] = useState<AdminInventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [companiesState, setCompaniesState] = useState<AsyncState>("idle");
  const [apiKeysState, setApiKeysState] = useState<AsyncState>("idle");
  const [inventoryState, setInventoryState] = useState<AsyncState>("idle");
  const [productsState, setProductsState] = useState<AsyncState>("idle");
  const [costSettingsState, setCostSettingsState] = useState<AsyncState>("idle");
  const [costSettingsSaveState, setCostSettingsSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [costHistoryState, setCostHistoryState] = useState<AsyncState>("idle");
  const [healthState, setHealthState] = useState<AsyncState>("idle");
  const [feedback, setFeedback] = useState("");
  const [costHistoryOpen, setCostHistoryOpen] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [issueKeyOpen, setIssueKeyOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<IssuedApiKey | null>(null);
  const [newCompany, setNewCompany] = useState({ legalName: "", externalCode: "" });
  const [rateLimitValue, setRateLimitValue] = useState("100");
  const [companyForm, setCompanyForm] = useState({
    legalName: "",
    isActive: true,
    syncStoreInventory: false
  });
  const [companyActionId, setCompanyActionId] = useState("");
  const [deletingCompanyId, setDeletingCompanyId] = useState("");
  const [keyActionId, setKeyActionId] = useState("");
  const [savingInventoryId, setSavingInventoryId] = useState("");
  const [syncCatalogState, setSyncCatalogState] = useState<"idle" | "syncing">("idle");
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, string>>({});
  const [costHistoryEntries, setCostHistoryEntries] = useState<CostSettingsHistoryEntry[]>([]);
  const [costVariables, setCostVariables] = useState({
    silverPricePerGram: "1.00",
    zonaFrancaRatePercent: "6",
    transportFee: "0.10",
    dollarRate: "5.00"
  });
  const lastPersistedCostVariablesRef = useRef("");

  const selectedCompany =
    companies.find((company) => company.id === selectedCompanyId) ?? null;

  const activeCompanies = useMemo(
    () => companies.filter((company) => company.isActive).length,
    [companies]
  );
  const totalActiveKeys = useMemo(
    () => companies.reduce((total, company) => total + company.activeKeyCount, 0),
    [companies]
  );

  function syncCompanyForm(company: Company | null) {
    setCompanyForm({
      legalName: company?.legalName ?? "",
      isActive: company?.isActive ?? true,
      syncStoreInventory: company?.syncStoreInventory ?? false
    });
  }

  async function bootstrapAdminSession() {
    setAuthState("checking");

    try {
      const config = await api.getAdminSessionConfig();
      setSessionConfig(config);

      if (!config.requiresAuth && !api.hasStoredAdminSession()) {
        const openSession = await api.getAdminSession();
        setAdminSession(openSession);
        setAuthState("authenticated");
        return;
      }

      if (!api.hasStoredAdminSession()) {
        setAdminSession(null);
        setAuthState("unauthenticated");
        return;
      }

      const session = await api.getAdminSession();
      setAdminSession(session);
      setAuthState("authenticated");
    } catch (error) {
      api.clearAdminSession();
      setAdminSession(null);
      setAuthState("unauthenticated");
      if (error instanceof ApiError && error.status !== 401) {
        setFeedback(formatApiError(error));
      }
    }
  }

  async function refreshHealth() {
    setHealthState("loading");

    try {
      await api.getHealth();
      setHealthState("success");
    } catch {
      setHealthState("error");
    }
  }

  async function refreshCompanies(preferredCompanyId?: string) {
    setCompaniesState("loading");

    try {
      const nextCompanies = await api.listCompanies();
      setCompanies(nextCompanies);
      setCompaniesState("success");

      const nextSelectedCompanyId =
        preferredCompanyId && nextCompanies.some((company) => company.id === preferredCompanyId)
          ? preferredCompanyId
          : selectedCompanyId && nextCompanies.some((company) => company.id === selectedCompanyId)
            ? selectedCompanyId
            : nextCompanies[0]?.id ?? "";

      if (currentPage === "company" && nextSelectedCompanyId) {
        setSelectedCompanyId(nextSelectedCompanyId);
      }
    } catch (error) {
      setCompaniesState("error");
      setFeedback(formatApiError(error));
    }
  }

  async function handleAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginState("loading");
    setLoginFeedback("");

    try {
      const session = await api.loginAdmin({
        username: loginForm.username,
        password: loginForm.password
      });

      setAdminSession(session);
      setLoginForm((current) => ({
        ...current,
        password: ""
      }));
      setAuthState("authenticated");
      setLoginState("idle");
      setFeedback("Sessao administrativa iniciada.");
    } catch (error) {
      setLoginState("error");
      setLoginFeedback(formatApiError(error));
    }
  }

  function handleAdminLogout() {
    api.clearAdminSession();
    setAdminSession(null);
    setAuthState(sessionConfig?.requiresAuth ? "unauthenticated" : "authenticated");
    setCompanies([]);
    setApiKeys([]);
    setInventory([]);
    setProducts([]);
    setFeedback("");
  }

  async function refreshCompanyDetail(companyId: string) {
    setApiKeysState("loading");
    setInventoryState("loading");

    try {
      const [nextApiKeys, nextInventory] = await Promise.all([
        api.listCompanyApiKeys(companyId),
        api.listCompanyInventory(companyId)
      ]);

      setApiKeys(nextApiKeys);
      setInventory(nextInventory.data);
      setInventoryDrafts(createInventoryDrafts(nextInventory.data));
      setApiKeysState("success");
      setInventoryState("success");
    } catch (error) {
      setApiKeysState("error");
      setInventoryState("error");
      setFeedback(formatApiError(error));
    }
  }

  async function refreshProducts() {
    setProductsState("loading");

    try {
      const nextProducts = await api.listInventoryProducts();
      setProducts(nextProducts);
      setProductsState("success");
    } catch (error) {
      setProductsState("error");
      setFeedback(formatApiError(error));
    }
  }

  async function handleSyncMasterCatalog(options?: { silent?: boolean; companyId?: string }) {
    setSyncCatalogState("syncing");

    try {
      const syncResult = await api.syncMasterCatalog();

      if (options?.companyId) {
        await refreshCompanyDetail(options.companyId);
      }

      if (currentPage === "costs" || currentPage === "company") {
        await refreshProducts();
      }

      if (!options?.silent) {
        setFeedback(
          `Catalogo mestre sincronizado com sucesso. ${syncResult.syncedCount} produto(s) atualizados.`
        );
      }
    } catch (error) {
      setFeedback(formatApiError(error));
    } finally {
      setSyncCatalogState("idle");
    }
  }

  async function refreshCostSettings() {
    setCostSettingsState("loading");

    try {
      const settings = await api.getCostSettings();
      const nextVariables = {
        silverPricePerGram: String(settings.silverPricePerGram),
        zonaFrancaRatePercent: String(settings.zonaFrancaRatePercent),
        transportFee: String(settings.transportFee),
        dollarRate: String(settings.dollarRate)
      };
      setCostVariables(nextVariables);
      lastPersistedCostVariablesRef.current = JSON.stringify(nextVariables);
      setCostSettingsState("success");
      setCostSettingsSaveState("idle");
    } catch (error) {
      setCostSettingsState("error");
      setFeedback(formatApiError(error));
    }
  }

  async function refreshCostSettingsHistory() {
    setCostHistoryState("loading");

    try {
      const history = await api.listCostSettingsHistory();
      setCostHistoryEntries(history);
      setCostHistoryState("success");
    } catch (error) {
      setCostHistoryState("error");
      setFeedback(formatApiError(error));
    }
  }

  function openDashboard() {
    window.history.pushState({}, "", "/");
    setCurrentPage("dashboard");
    setSelectedCompanyId("");
    setApiKeys([]);
    setInventory([]);
    setInventoryDrafts({});
  }

  function openCosts() {
    window.history.pushState({}, "", "/custos");
    setCurrentPage("costs");
    setSelectedCompanyId("");
  }

  function openCostHistory() {
    setCostHistoryOpen(true);
    void refreshCostSettingsHistory();
  }

  function openCompany(companyId: string) {
    window.history.pushState({}, "", `/empresas/${encodeURIComponent(companyId)}`);
    setCurrentPage("company");
    setSelectedCompanyId(companyId);
    setActiveTab("inventory");
  }

  useEffect(() => {
    void refreshHealth();
    void bootstrapAdminSession();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteState(window.location.pathname);
      setCurrentPage(route.page);
      setSelectedCompanyId(route.companyId);
      setActiveTab(route.page === "company" ? "inventory" : "profile");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    syncCompanyForm(selectedCompany);
  }, [selectedCompany]);

  useEffect(() => {
    if (sessionConfig?.loginMode === "credentials" && sessionConfig.usernameHint) {
      setLoginForm((current) =>
        current.username ? current : { ...current, username: sessionConfig.usernameHint ?? "" }
      );
    }
  }, [sessionConfig]);

  useEffect(() => {
    if (authState === "authenticated") {
      void refreshCompanies(initialRoute.companyId || undefined);
    }
  }, [authState]);

  useEffect(() => {
    if (authState !== "authenticated") {
      return;
    }

    if (currentPage === "company" && selectedCompanyId) {
      void refreshCompanyDetail(selectedCompanyId);
    }
    if (currentPage === "costs") {
      void refreshCostSettings();
      void refreshCostSettingsHistory();
      void refreshProducts();
    }
    if (currentPage === "company" && activeTab === "inventory") {
      void refreshProducts();
    }
  }, [activeTab, currentPage, selectedCompanyId]);

  async function handleSaveCostSettings(options?: { silent?: boolean }) {
    try {
      setCostSettingsSaveState("saving");
      const settings = await api.updateCostSettings({
        silverPricePerGram: Number(costVariables.silverPricePerGram),
        zonaFrancaRatePercent: Number(costVariables.zonaFrancaRatePercent),
        transportFee: Number(costVariables.transportFee),
        dollarRate: Number(costVariables.dollarRate)
      });

      setCostVariables({
        silverPricePerGram: String(settings.silverPricePerGram),
        zonaFrancaRatePercent: String(settings.zonaFrancaRatePercent),
        transportFee: String(settings.transportFee),
        dollarRate: String(settings.dollarRate)
      });
      lastPersistedCostVariablesRef.current = JSON.stringify({
        silverPricePerGram: String(settings.silverPricePerGram),
        zonaFrancaRatePercent: String(settings.zonaFrancaRatePercent),
        transportFee: String(settings.transportFee),
        dollarRate: String(settings.dollarRate)
      });
      if (!options?.silent) {
        setFeedback("Parametros de custo salvos e publicados na API.");
      }
      setCostSettingsSaveState("saved");
      await refreshProducts();
      if (currentPage === "costs" || costHistoryOpen) {
        await refreshCostSettingsHistory();
      }
    } catch (error) {
      setCostSettingsSaveState("error");
      setFeedback(formatApiError(error));
    }
  }

  const autoSaveCostSettings = useEffectEvent(async () => {
    await handleSaveCostSettings({
      silent: true
    });
  });

  useEffect(() => {
    if (authState !== "authenticated" || currentPage !== "costs" || costSettingsState !== "success") {
      return;
    }

    const nextSignature = JSON.stringify(costVariables);
    if (nextSignature === lastPersistedCostVariablesRef.current) {
      return;
    }

    const hasInvalidValue = Object.values(costVariables).some((value) => {
      const normalized = value.replace(",", ".").trim();
      if (!normalized) {
        return true;
      }

      const parsed = Number(normalized);
      return !Number.isFinite(parsed) || parsed < 0;
    });

    if (hasInvalidValue) {
      return;
    }

    setCostSettingsSaveState("saving");
    const timeoutId = window.setTimeout(() => {
      void autoSaveCostSettings();
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [autoSaveCostSettings, costSettingsState, costVariables, currentPage]);

  async function handleCreateCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const company = await api.createCompany(newCompany);
      setCreateCompanyOpen(false);
      setNewCompany({ legalName: "", externalCode: "" });
      setFeedback("Empresa criada com sucesso.");
      await refreshCompanies(company.id);
      openCompany(company.id);
    } catch (error) {
      setFeedback(formatApiError(error));
    }
  }

  async function handleSaveCompany() {
    if (!selectedCompany) {
      return;
    }

    const legalName = companyForm.legalName.trim();
    if (!legalName) {
      setFeedback("Informe um nome valido para a empresa.");
      return;
    }

    setCompanyActionId(selectedCompany.id);

    try {
      const updatedCompany = await api.updateCompany(selectedCompany.id, {
        legalName,
        isActive: companyForm.isActive,
        syncStoreInventory: companyForm.syncStoreInventory
      });

      setCompanies((currentCompanies) =>
        currentCompanies.map((company) =>
          company.id === updatedCompany.id ? updatedCompany : company
        )
      );
      syncCompanyForm(updatedCompany);
      setFeedback("Configuracoes da empresa atualizadas.");
    } catch (error) {
      setFeedback(formatApiError(error));
    } finally {
      setCompanyActionId("");
    }
  }

  async function handleDeleteCompany() {
    if (!selectedCompany) {
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a empresa "${selectedCompany.legalName}"? Essa acao remove as API keys e o estoque isolado dela.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingCompanyId(selectedCompany.id);

    try {
      await api.deleteCompany(selectedCompany.id);
      setFeedback(`Empresa ${selectedCompany.legalName} excluida com sucesso.`);
      await refreshCompanies();
      openDashboard();
    } catch (error) {
      setFeedback(formatApiError(error));
    } finally {
      setDeletingCompanyId("");
    }
  }

  async function handleIssueKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompanyId) {
      return;
    }

    try {
      const issuedKey = await api.issueApiKey(selectedCompanyId, Number(rateLimitValue));
      setIssueKeyOpen(false);
      setRateLimitValue("100");
      setCreatedKey(issuedKey);
      setFeedback("Nova chave gerada com sucesso.");
      await refreshCompanies(selectedCompanyId);
      await refreshCompanyDetail(selectedCompanyId);
    } catch (error) {
      setFeedback(formatApiError(error));
    }
  }

  async function handleRevokeKey(apiKeyId: string) {
    if (!selectedCompanyId) {
      return;
    }

    setKeyActionId(apiKeyId);

    try {
      await api.revokeApiKey(apiKeyId);
      setFeedback("Chave revogada imediatamente.");
      await refreshCompanies(selectedCompanyId);
      await refreshCompanyDetail(selectedCompanyId);
    } catch (error) {
      setFeedback(formatApiError(error));
    } finally {
      setKeyActionId("");
    }
  }

  async function handleSaveInventory(productId: string) {
    if (!selectedCompanyId) {
      return;
    }

    const nextQuantity = Number(inventoryDrafts[productId] ?? "");
    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      setFeedback("Informe uma quantidade inteira e nao negativa.");
      return;
    }

    setSavingInventoryId(productId);

    try {
      const updatedItem = await api.updateCompanyInventory(selectedCompanyId, productId, {
        customStockQuantity: nextQuantity
      });

      setInventory((currentInventory) =>
        currentInventory.map((item) => (item.productId === productId ? updatedItem : item))
      );
      setInventoryDrafts((currentDrafts) => ({
        ...currentDrafts,
        [productId]: String(
          updatedItem.customStockQuantity ?? updatedItem.effectiveStockQuantity
        )
      }));
      setFeedback(`Estoque salvo para o produto ${updatedItem.sku}.`);
    } catch (error) {
      setFeedback(formatApiError(error));
    } finally {
      setSavingInventoryId("");
    }
  }

  async function handleCopyCreatedKey() {
    if (!createdKey) {
      return;
    }

    await navigator.clipboard.writeText(createdKey.plaintextKey);
    setFeedback("Chave copiada para a area de transferencia.");
  }

  if (authState === "checking") {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(250,204,21,0.18),_transparent_28%)]" />
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
          <div className="rounded-[2rem] border border-white/60 bg-white/85 px-10 py-12 text-center shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Super Admin
            </p>
            <h1 className="mt-4 font-display text-4xl tracking-tight text-slate-950">
              Validando sessao
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Estamos conferindo o acesso administrativo e a disponibilidade da API local.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authState !== "authenticated") {
    return (
      <LoginPage
        config={sessionConfig}
        username={loginForm.username}
        password={loginForm.password}
        loginState={loginState}
        errorMessage={loginFeedback}
        healthState={healthState}
        onUsernameChange={(value) =>
          setLoginForm((current) => ({
            ...current,
            username: value
          }))
        }
        onPasswordChange={(value) =>
          setLoginForm((current) => ({
            ...current,
            password: value
          }))
        }
        onSubmit={handleAdminLogin}
      />
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.2),_transparent_42%),radial-gradient(circle_at_top_right,_rgba(250,204,21,0.2),_transparent_32%)]" />
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10">
        <header className="rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Super Admin
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
              </div>
              <h1 className="mt-4 font-display text-4xl tracking-tight text-slate-950 sm:text-5xl">
                Dashboard operacional de parceiros
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                Visualize todas as empresas cadastradas, ajuste configuracoes criticas e
                administre o estoque isolado de cada parceiro a partir de uma unica
                interface.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openDashboard}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    currentPage === "dashboard"
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  ].join(" ")}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={openCosts}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    currentPage === "costs"
                      ? "bg-amber-500 text-slate-950"
                      : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  ].join(" ")}
                >
                  Custos
                </button>
                {selectedCompany ? (
                  <button
                    type="button"
                    onClick={() => openCompany(selectedCompany.id)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      currentPage === "company"
                        ? "bg-cyan-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    ].join(" ")}
                  >
                    Visao da empresa
                  </button>
                ) : null}
              </div>
              {adminSession ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                    Sessao: <span className="font-semibold text-slate-950">{adminSession.admin.displayName}</span>
                  </div>
                  {sessionConfig?.requiresAuth ? (
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                      Sair
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                label="Empresas"
                value={String(companies.length).padStart(2, "0")}
                caption={`${activeCompanies} ativas`}
              />
              <StatCard
                label="Chaves ativas"
                value={String(totalActiveKeys).padStart(2, "0")}
                caption="Integracoes liberadas"
              />
              <StatCard
                label="API local"
                value={healthState === "success" ? "On" : "Off"}
                caption={healthState === "success" ? "localhost:3000" : "verificar backend"}
              />
            </div>
          </div>
        </header>

        {feedback ? (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950">
            {feedback}
          </div>
        ) : null}

        {currentPage === "dashboard" ? (
          <CompanyCardsDashboard
            companies={companies}
            companiesState={companiesState}
            onOpenCreate={() => setCreateCompanyOpen(true)}
            onOpenCompany={(companyId) => {
              startTransition(() => {
                openCompany(companyId);
              });
            }}
          />
        ) : null}

        {currentPage === "costs" ? (
          <CostCalculatorPage
            products={products}
            productsState={productsState}
            costSettingsState={costSettingsState}
            costSettingsSaveState={costSettingsSaveState}
            costHistoryEntries={costHistoryEntries}
            costHistoryState={costHistoryState}
            variables={costVariables}
            onVariableChange={(field, value) =>
              setCostVariables((current) => ({
                ...current,
                [field]: value
              }))
            }
            onOpenHistory={() => {
              openCostHistory();
            }}
            onRefresh={() => {
              void refreshProducts();
            }}
          />
        ) : null}

        {currentPage === "company" && selectedCompany ? (
          <CompanyDetailPage
            company={selectedCompany}
            activeTab={activeTab}
            apiKeys={apiKeys}
            inventory={inventory}
            products={products}
            apiKeysState={apiKeysState}
            inventoryState={inventoryState}
            productsState={productsState}
            keyActionId={keyActionId}
            savingInventoryId={savingInventoryId}
            syncingCatalog={syncCatalogState === "syncing"}
            companyForm={companyForm}
            inventoryDrafts={inventoryDrafts}
            onBack={openDashboard}
            onChangeTab={setActiveTab}
            onCompanyFormChange={(patch) =>
              setCompanyForm((current) => ({
                ...current,
                ...patch
              }))
            }
            onSaveCompany={() => {
              if (!companyActionId) {
                void handleSaveCompany();
              }
            }}
            onDeleteCompany={() => {
              if (!deletingCompanyId) {
                void handleDeleteCompany();
              }
            }}
            deletingCompany={deletingCompanyId === selectedCompany.id}
            onOpenIssueKey={() => setIssueKeyOpen(true)}
            onRevokeKey={(apiKeyId) => {
              void handleRevokeKey(apiKeyId);
            }}
            onSyncCatalog={() => {
              void handleSyncMasterCatalog({
                companyId: selectedCompany.id
              });
            }}
            onInventoryDraftChange={(productId, value) =>
              setInventoryDrafts((currentDrafts) => ({
                ...currentDrafts,
                [productId]: value
              }))
            }
            onSaveInventory={(productId) => {
              void handleSaveInventory(productId);
            }}
          />
        ) : null}
      </div>

      <Modal
        open={costHistoryOpen}
        title="Historico das variaveis de custo"
        description="Veja todas as alteracoes automaticas ou manuais de dolar, transporte, taxa ZF e prata internacional."
        onClose={() => setCostHistoryOpen(false)}
      >
        <div className="space-y-4">
          {costHistoryState === "loading" ? (
            <p className="text-sm text-slate-500">Carregando historico...</p>
          ) : null}
          {costHistoryState === "error" ? (
            <p className="text-sm text-rose-600">Nao foi possivel carregar o historico.</p>
          ) : null}
          {costHistoryState === "success" && costHistoryEntries.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma alteracao registrada ainda.</p>
          ) : null}
          {costHistoryEntries.length > 0 ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {costHistoryEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {entry.changedFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-800"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-slate-500">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Antes
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <p>Prata: {entry.previous.silverPricePerGram}</p>
                        <p>Taxa ZF: {entry.previous.zonaFrancaRatePercent}</p>
                        <p>Transporte: {entry.previous.transportFee}</p>
                        <p>Dolar: {entry.previous.dollarRate}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Depois
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-emerald-900">
                        <p>Prata: {entry.next.silverPricePerGram}</p>
                        <p>Taxa ZF: {entry.next.zonaFrancaRatePercent}</p>
                        <p>Transporte: {entry.next.transportFee}</p>
                        <p>Dolar: {entry.next.dollarRate}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={createCompanyOpen}
        title="Cadastrar nova empresa"
        description="Registre uma nova company no banco de controle local."
        onClose={() => setCreateCompanyOpen(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreateCompanyOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-company-form"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Criar empresa
            </button>
          </>
        }
      >
        <form id="create-company-form" className="space-y-4" onSubmit={handleCreateCompany}>
          <Field
            label="Razao social"
            value={newCompany.legalName}
            onChange={(value) => setNewCompany((current) => ({ ...current, legalName: value }))}
            placeholder="Ex.: Distribuidora Atlas"
          />
          <Field
            label="Codigo externo"
            value={newCompany.externalCode}
            onChange={(value) =>
              setNewCompany((current) => ({ ...current, externalCode: value }))
            }
            placeholder="Ex.: atlas-b2b"
          />
        </form>
      </Modal>

      <Modal
        open={issueKeyOpen}
        title="Gerar nova API key"
        description={`Empresa selecionada: ${selectedCompany?.legalName ?? "nenhuma"}`}
        onClose={() => setIssueKeyOpen(false)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setIssueKeyOpen(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="issue-key-form"
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Gerar chave
            </button>
          </>
        }
      >
        <form id="issue-key-form" className="space-y-4" onSubmit={handleIssueKey}>
          <Field
            label="Rate limit por minuto"
            type="number"
            value={rateLimitValue}
            onChange={setRateLimitValue}
            placeholder="100"
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(createdKey)}
        title="Copie esta chave agora, ela nao sera exibida novamente"
        description="A aplicacao salva apenas o hash criptografado no banco local. Guarde a chave em um local seguro."
        onClose={() => setCreatedKey(null)}
        actions={
          <>
            <button
              type="button"
              onClick={() => setCreatedKey(null)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopyCreatedKey();
              }}
              className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Copiar chave
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Exiba essa chave apenas para o cliente certo. Depois de fechar este alerta,
            so o prefixo continuara visivel no painel.
          </div>
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-slate-50">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Plaintext key</p>
            <pre className="mt-3 overflow-auto text-sm leading-7 text-cyan-300">
              {createdKey?.plaintextKey}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default App;
