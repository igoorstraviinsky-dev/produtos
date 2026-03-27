import { startTransition, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { CompanyCardsDashboard } from "./components/CompanyCardsDashboard";
import { CompanyDetailPage } from "./components/CompanyDetailPage";
import { CostCalculatorPage } from "./components/CostCalculatorPage";
import { LoginPage } from "./components/LoginPage";
import { Modal } from "./components/Modal";
import { PublicInventoryApiDocsPage } from "./components/PublicInventoryApiDocsPage";
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
type AppPage = "dashboard" | "company" | "costs" | "docs";
type CompanyTab = "profile" | "keys" | "inventory" | "costs";
type AuthState = "checking" | "authenticated" | "unauthenticated";

function getRouteState(pathname: string) {
  if (pathname === "/docs" || pathname === "/docs/api-estoque") {
    return {
      page: "docs" as const,
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
      item.hasVariantInventory
        ? ""
        : item.customStockQuantity !== null
          ? String(item.customStockQuantity)
          : String(item.effectiveStockQuantity)
    ])
  );
}

function App() {
  const AUTO_INVENTORY_REFRESH_INTERVAL_MS = 15000;
  const AUTO_CATALOG_SYNC_INTERVAL_MS = 60000;
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
  const lastAutoInventorySyncKeyRef = useRef("");

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

  async function refreshProducts(companyId?: string) {
    setProductsState("loading");

    try {
      const nextProducts = await api.listInventoryProducts(companyId);
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

      if (currentPage === "company") {
        await refreshProducts(options?.companyId || selectedCompanyId || undefined);
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

  async function refreshCostSettings(companyId?: string) {
    setCostSettingsState("loading");

    try {
      const settings = await api.getCostSettings(companyId);
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

  async function refreshCostSettingsHistory(companyId?: string) {
    setCostHistoryState("loading");

    try {
      const history = await api.listCostSettingsHistory(companyId);
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

  function openCosts(companyId: string) {
    window.history.pushState({}, "", `/empresas/${encodeURIComponent(companyId)}`);
    setCurrentPage("company");
    setSelectedCompanyId(companyId);
    setActiveTab("costs");
  }

  function openDocs() {
    window.history.pushState({}, "", "/docs/api-estoque");
    setCurrentPage("docs");
    setSelectedCompanyId("");
  }

  function openPartnerCostsFromDashboard() {
    const targetCompany =
      companies.find((company) => company.isActive) ??
      companies.find((company) => company.id === selectedCompanyId) ??
      companies[0] ??
      null;

    if (!targetCompany) {
      setFeedback("Cadastre uma empresa para abrir custos por parceiro.");
      return;
    }

    openCosts(targetCompany.id);
  }

  function openCostHistory() {
    setCostHistoryOpen(true);
    void refreshCostSettingsHistory(selectedCompanyId || undefined);
  }

  const autoRefreshCompanyInventory = useEffectEvent(async (companyId: string) => {
    await refreshCompanyDetail(companyId);
    await refreshProducts(companyId);
  });

  const autoSyncCompanyCatalog = useEffectEvent(async (companyId: string) => {
    await handleSyncMasterCatalog({
      silent: true,
      companyId
    });
  });

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
    if (currentPage === "company" && activeTab === "inventory") {
      void refreshProducts(selectedCompanyId || undefined);
    }
    if (currentPage === "company" && activeTab === "costs" && selectedCompanyId) {
      void refreshCostSettings(selectedCompanyId);
      void refreshCostSettingsHistory(selectedCompanyId);
      void refreshProducts(selectedCompanyId);
    }
  }, [activeTab, currentPage, selectedCompanyId]);

  useEffect(() => {
    if (
      authState !== "authenticated" ||
      currentPage !== "company" ||
      activeTab !== "inventory" ||
      !selectedCompanyId ||
      !selectedCompany?.syncStoreInventory
    ) {
      lastAutoInventorySyncKeyRef.current = "";
      return;
    }

    const syncKey = `${selectedCompanyId}:${activeTab}`;
    if (lastAutoInventorySyncKeyRef.current !== syncKey) {
      lastAutoInventorySyncKeyRef.current = syncKey;
      void autoSyncCompanyCatalog(selectedCompanyId);
    }

    const refreshIntervalId = window.setInterval(() => {
      void autoRefreshCompanyInventory(selectedCompanyId);
    }, AUTO_INVENTORY_REFRESH_INTERVAL_MS);

    const syncIntervalId = window.setInterval(() => {
      void autoSyncCompanyCatalog(selectedCompanyId);
    }, AUTO_CATALOG_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(refreshIntervalId);
      window.clearInterval(syncIntervalId);
    };
  }, [
    activeTab,
    authState,
    autoRefreshCompanyInventory,
    autoSyncCompanyCatalog,
    currentPage,
    selectedCompany?.syncStoreInventory,
    selectedCompanyId
  ]);

  useEffect(() => {
    if (
      authState !== "authenticated" ||
      currentPage !== "company" ||
      activeTab !== "inventory" ||
      !selectedCompanyId ||
      !selectedCompany?.syncStoreInventory ||
      inventoryState !== "success" ||
      inventory.length > 0 ||
      syncCatalogState === "syncing"
    ) {
      return;
    }

    void autoSyncCompanyCatalog(selectedCompanyId);
  }, [
    activeTab,
    authState,
    autoSyncCompanyCatalog,
    currentPage,
    inventory.length,
    inventoryState,
    selectedCompany?.syncStoreInventory,
    selectedCompanyId,
    syncCatalogState
  ]);

  async function handleSaveCostSettings(options?: { silent?: boolean }) {
    if (!selectedCompanyId) {
      return;
    }

    try {
      setCostSettingsSaveState("saving");
      const settings = await api.updateCostSettings({
        silverPricePerGram: Number(costVariables.silverPricePerGram),
        zonaFrancaRatePercent: Number(costVariables.zonaFrancaRatePercent),
        transportFee: Number(costVariables.transportFee),
        dollarRate: Number(costVariables.dollarRate)
      }, selectedCompanyId);

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
        setFeedback("Parametros de custo da empresa salvos com sucesso.");
      }
      setCostSettingsSaveState("saved");
      await refreshProducts(selectedCompanyId);
      if ((currentPage === "company" && activeTab === "costs") || costHistoryOpen) {
        await refreshCostSettingsHistory(selectedCompanyId);
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
    if (
      authState !== "authenticated" ||
      currentPage !== "company" ||
      activeTab !== "costs" ||
      costSettingsState !== "success"
    ) {
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
          [productId]: updatedItem.hasVariantInventory
            ? ""
            : updatedItem.customStockQuantity !== null
              ? String(updatedItem.customStockQuantity)
              : String(updatedItem.effectiveStockQuantity)
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

  if (currentPage === "docs") {
    return <PublicInventoryApiDocsPage />;
  }

  if (authState === "checking") {
    return (
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.14),_transparent_24%)]" />
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 py-10">
          <div className="surface-panel rounded-[2rem] px-10 py-12 text-center">
            <p className="surface-kicker">
              Super Admin
            </p>
            <h1 className="mt-4 font-display text-4xl tracking-tight text-slate-50">
              Validando sessao
            </h1>
            <p className="mt-3 text-sm text-slate-400">
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_26%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent)]" />
      <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10">
        <header className="surface-panel rounded-[2.25rem] p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="surface-chip-active inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]">
                Super Admin
                <span className="h-2 w-2 rounded-full bg-cyan-300" />
              </div>
              <h1 className="mt-4 font-display text-4xl tracking-tight text-slate-50 sm:text-5xl">
                Dashboard operacional de parceiros
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
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
                      ? "surface-button-primary text-white"
                      : "surface-button-secondary text-slate-100"
                  ].join(" ")}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={openDocs}
                  className="surface-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
                >
                  Docs API
                </button>
                {selectedCompany ? (
                  <button
                    type="button"
                    onClick={() => openCompany(selectedCompany.id)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      currentPage === "company"
                        ? "surface-button-primary text-white"
                        : "surface-button-secondary text-slate-100"
                    ].join(" ")}
                  >
                    Visao da empresa
                  </button>
                ) : null}
              </div>
              {adminSession ? (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <div className="surface-chip rounded-full px-4 py-2 text-sm text-slate-300">
                    Sessao: <span className="font-semibold text-slate-50">{adminSession.admin.displayName}</span>
                  </div>
                  {sessionConfig?.requiresAuth ? (
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="surface-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
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
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            {feedback}
          </div>
        ) : null}

        {currentPage === "dashboard" ? (
          <CompanyCardsDashboard
            companies={companies}
            companiesState={companiesState}
            onOpenCreate={() => setCreateCompanyOpen(true)}
            onOpenDocs={openDocs}
            onOpenPartnerCosts={() => {
              startTransition(() => {
                openPartnerCostsFromDashboard();
              });
            }}
            onOpenCompany={(companyId) => {
              startTransition(() => {
                openCompany(companyId);
              });
            }}
          />
        ) : null}

        {currentPage === "company" && selectedCompany ? (
          <>
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
              onChangeTab={(tab) => {
                setActiveTab(tab);
                if (tab === "costs") {
                  openCosts(selectedCompany.id);
                }
              }}
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

            {activeTab === "costs" ? (
              <CostCalculatorPage
                companyName={selectedCompany.legalName}
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
                  void refreshProducts(selectedCompany.id);
                }}
              />
            ) : null}
          </>
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
            <p className="text-sm text-slate-400">Carregando historico...</p>
          ) : null}
          {costHistoryState === "error" ? (
            <p className="text-sm text-rose-600">Nao foi possivel carregar o historico.</p>
          ) : null}
          {costHistoryState === "success" && costHistoryEntries.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma alteracao registrada ainda.</p>
          ) : null}
          {costHistoryEntries.length > 0 ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {costHistoryEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="surface-card rounded-[1.5rem] px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {entry.changedFields.map((field) => (
                        <span
                          key={field}
                          className="rounded-full border border-cyan-400/20 bg-cyan-400/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100"
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
                    <div className="surface-card-muted rounded-2xl px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Antes
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-slate-300">
                        <p>Prata: {entry.previous.silverPricePerGram}</p>
                        <p>Taxa ZF: {entry.previous.zonaFrancaRatePercent}</p>
                        <p>Transporte: {entry.previous.transportFee}</p>
                        <p>Dolar: {entry.previous.dollarRate}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                        Depois
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-emerald-100">
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
              className="surface-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="create-company-form"
              className="surface-button-primary rounded-full px-4 py-2 text-sm font-semibold transition"
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
              className="surface-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="issue-key-form"
              className="surface-button-warning rounded-full px-4 py-2 text-sm font-semibold transition"
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
              className="surface-button-secondary rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopyCreatedKey();
              }}
              className="surface-button-primary rounded-full px-4 py-2 text-sm font-semibold transition"
            >
              Copiar chave
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="surface-note-warning rounded-2xl px-4 py-3 text-sm">
            Exiba essa chave apenas para o cliente certo. Depois de fechar este alerta,
            so o prefixo continuara visivel no painel.
          </div>
          <div className="surface-card rounded-[1.5rem] p-4 text-slate-50">
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
