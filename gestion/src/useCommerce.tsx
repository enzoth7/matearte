import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { commerceSource, readCommerceOrders, readCommerceProducts, readCommerceReference } from "./commerceSource";
import { adaptCommerce, type CommerceSnapshot, type CommercePayment, type NationalRate, type RuralRaffleEntry, type WebCustomerProfile, type WebLead } from "./commerceAdapter";
import { loadState, type State } from "./data";
import type { LocalCustomer, LocalSale, LocalSaleReceipt } from "./localSource";
import { adaptExpenses, canReadExpenses, readExpenseSources } from "./expenseSource";
import { montevideoToday } from "./overview";
import { readWholesale } from "./wholesaleSource";
import { adaptWholesale } from "./wholesaleAdapter";

export async function readAllPages<T>(read: (page: number) => Promise<{ rows: T[]; count: number }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; ; page++) {
    const result = await read(page);
    rows.push(...result.rows);
    if (rows.length >= result.count) return rows;
    if (!result.rows.length) throw new Error("La lectura de datos quedó incompleta. Actualizá para volver a intentar.");
  }
}
async function readCustomerProfiles() {
  const client = commerceSource;
  if (!client) return [];
  const profiles: WebCustomerProfile[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await client.rpc("gestion_customer_profile_details_full", { p_offset: page * 100, p_limit: 100 });
    if (error) throw error;
    const rows = (data || []) as WebCustomerProfile[];
    profiles.push(...rows);
    if (rows.length < 100) return profiles;
  }
}

const localCustomerFields = "id,full_name,company_name,address,email,phone,city,country,department,postal_code,product_interest,birth_date,first_purchase_date,last_purchase_date,source_user_id,linked_customer_id,notes,agenda_import_key,agenda_additional_phones,agenda_inferred_category,origin_channel,customer_type,created_at,updated_at";
type LocalCustomerCache = { rows: LocalCustomer[]; latest: string; fullReadAt: number };
async function readLocalCustomers(client: NonNullable<typeof commerceSource>, cache: LocalCustomerCache | null): Promise<LocalCustomerCache> {
  const fullRead = !cache || Date.now() - cache.fullReadAt > 5 * 60_000;
  const changes = await readAllPages<LocalCustomer>(async (page) => {
    let query = client.from("local_sales_customers").select(localCustomerFields, { count: "exact" });
    if (!fullRead && cache?.latest) query = query.gt("updated_at", cache.latest);
    const { data, count, error } = await query.order("updated_at").order("id").range(page * 500, page * 500 + 499);
    if (error) throw error;
    return { rows: (data || []) as LocalCustomer[], count: count ?? 0 };
  });
  const rows = fullRead ? changes : [...new Map([...(cache?.rows || []), ...changes].map((row) => [row.id, row])).values()];
  const latest = changes.reduce((value, row) => row.updated_at && row.updated_at > value ? row.updated_at : value, fullRead ? "" : cache?.latest || "");
  return { rows, latest, fullReadAt: fullRead ? Date.now() : cache!.fullReadAt };
}

export function useCommerce() {
  const epoch = useRef(0);
  const busyRef = useRef(false);
  const pendingFullRefresh = useRef(false);
  const localCustomerCache = useRef<LocalCustomerCache | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<State>(loadState);
  const [snapshot, setSnapshot] = useState<CommerceSnapshot | null>(null);
  const [access, setAccess] = useState<"loading" | "login" | "denied" | "ready">("loading");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!commerceSource) { setAccess("login"); return; }
    const { data } = commerceSource.auth.onAuthStateChange((_event, next) => setSession(next));
    void commerceSource.auth.getSession().then(({ data, error }) => {
      setSession(data.session);
      if (error) setError(error.message);
      if (!data.session) setAccess("login");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    epoch.current++; busyRef.current = false; localCustomerCache.current = null;
    setSnapshot(null); setLoadedAt(null); setState(loadState());
    if (!session || !commerceSource) { setAccess("login"); return; }
    setAccess("loading");
    void commerceSource.from("commerce_admin_users").select("user_id,display_name,access_user_id,allowed_paths").eq("user_id", session.user.id).eq("active", true).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (data && !error) {
          setState((current) => ({
            ...current,
            user: data.display_name || current.user,
            activeUserId: data.access_user_id || current.activeUserId,
            access: Array.isArray(data.allowed_paths) && data.access_user_id
              ? { ...current.access, [data.access_user_id]: data.allowed_paths }
              : current.access,
          }));
          setAccess("ready");
        } else {
          setAccess("denied");
        }
        setError(error?.message || "");
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const betianaHasOperationalAccess = (state.access?.t5 ?? []).some((path) => !path.startsWith("/marketing/"));
  const refresh = useCallback(async (forceFullCustomers = false) => {
    const client = commerceSource;
    if (!client || access !== "ready") return;
    if (state.activeUserId === "t5" && !betianaHasOperationalAccess) return;
    if (busyRef.current) { if (forceFullCustomers) pendingFullRefresh.current = true; return; }
    const requestEpoch = epoch.current;
    if (forceFullCustomers) localCustomerCache.current = null;
    busyRef.current = true;
    setLoading(true);
    try {
      const [products, orders, payments, reference, shipping, customerProfiles, localCustomerResult, localSales, localReceipts, ruralRaffleEntries, wholesale, webLeads, membership, expenseSources, contactOrigins, contactFirstSeen] = await Promise.all([
        readAllPages((page) => readCommerceProducts(client, page)),
        readAllPages((page) => readCommerceOrders(client, page)),
        readAllPages<CommercePayment>(async (page) => {
          const { data, count, error } = await client.from("commerce_payments").select("id,order_id,provider,status,amount_minor,currency,approved_at,created_at", { count: "exact" }).order("id").range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: data || [], count: count ?? 0 };
        }),
        readCommerceReference(client),
        client.from("shipping_rates").select("id,name,rate_minor,is_pickup,active,departments").order("name"),
        readCustomerProfiles(),
        readLocalCustomers(client, localCustomerCache.current),
        readAllPages<LocalSale>(async (page) => {
          let result: { data: unknown[] | null; count: number | null; error: { code?: string; message: string } | null } = await client.from("local_sales")
            .select("id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,deposit_minor,currency,created_at,local_sale_items(id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor,customization,production_notes)", { count: "exact" })
            .order("id").range(page * 100, page * 100 + 99);
          if (result.error?.code === "42703" && /customization/i.test(result.error.message)) {
            result = await client.from("local_sales")
              .select("id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,deposit_minor,currency,created_at,local_sale_items(id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor)", { count: "exact" })
              .order("id").range(page * 100, page * 100 + 99);
          }
          const { data, count, error } = result;
          if (error) throw error;
          return { rows: (data || []) as LocalSale[], count: count ?? 0 };
        }),
        readAllPages<LocalSaleReceipt>(async (page) => {
          const { data, count, error } = await client.from("local_sale_receipts")
            .select("id,sale_id,amount_minor,payment_method,paid_on,created_at", { count: "exact" })
            .order("id").range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: (data || []) as LocalSaleReceipt[], count: count ?? 0 };
        }),
        readAllPages<RuralRaffleEntry>(async (page) => {
          const { data, count, error } = await client.from("rural_raffle_entries")
            .select("id,full_name,company_name,address,notes,email,phone,city,country,department,postal_code,additional_phones,inferred_category,birth_date,product_interest,origin_channel,customer_type,created_at", { count: "exact" })
            .order("created_at", { ascending: false }).range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: (data || []) as RuralRaffleEntry[], count: count ?? 0 };
        }),
        readWholesale(),
        readAllPages<WebLead>(async (page) => {
          const { data, error } = await client.rpc("gestion_web_leads", { p_offset: page * 100, p_limit: 100 });
          if (error) throw error;
          const rows = (data || []) as WebLead[];
          return { rows, count: rows.length < 100 ? page * 100 + rows.length : (page + 2) * 100 };
        }),
        client.from("commerce_admin_users").select("display_name,access_user_id,allowed_paths").eq("user_id", session!.user.id).eq("active", true).maybeSingle(),
        readExpenseSources(client),
        client.rpc("gestion_contact_origins"),
        readAllPages<{ contact_key: string; first_seen_at: string | null }>(async (page) => {
          const { data, error } = await client.rpc("gestion_customer_first_seen", { p_offset: page * 500, p_limit: 500 });
          if (error) throw error;
          const rows = (data || []) as { contact_key: string; first_seen_at: string | null }[];
          return { rows, count: rows.length < 500 ? page * 500 + rows.length : (page + 2) * 500 };
        }),
      ]);
      if (requestEpoch !== epoch.current) return;
      if (shipping.error) throw shipping.error;
      if (membership.error) throw membership.error;
      localCustomerCache.current = localCustomerResult;
      const localCustomers = localCustomerResult.rows;
      const next: CommerceSnapshot = { products, orders, payments, reference, nationalRates: (shipping.data || []) as NationalRate[], customerProfiles, localCustomers, localSales, localReceipts, ruralRaffleEntries, wholesale, webLeads, contactOrigins: contactOrigins.error ? undefined : (contactOrigins.data || []) as { contact_key: string; origin: string }[], contactFirstSeen };
      const base = adaptWholesale(adaptCommerce(next, (path) => client.storage.from("product-images").getPublicUrl(path).data.publicUrl), wholesale);
      const rates = Object.fromEntries(reference.exchangeRates.map((rate) => [rate.currency_code, Number(rate.rate_to_uyu)]));
      // Sin ningún egreso cargado no se calcula ganancia: se vería como si no hubiera gastos.
      const connected = Boolean(expenseSources) && canReadExpenses(membership.data) && Boolean(expenseSources!.purchases.length || expenseSources!.fixed.length);
      const expenseResult = connected && expenseSources ? adaptExpenses(expenseSources, rates, montevideoToday()) : null;
      const adapted: State = { ...base, expenses: expenseResult?.expenses ?? base.expenses, expensesConnected: connected, expensesSkipped: expenseResult?.skipped ?? 0 };
      setState((current) => ({
        ...adapted,
        access: Array.isArray(membership.data?.allowed_paths) && membership.data?.access_user_id
          ? { ...current.access, [membership.data.access_user_id]: membership.data.allowed_paths }
          : current.access,
        user: membership.data?.display_name || current.user,
        activeUserId: membership.data?.access_user_id || current.activeUserId,
      }));
      setSnapshot(next); setLoadedAt(new Date()); setError("");
    } catch (error) {
      if (requestEpoch !== epoch.current) return;
      setError(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "No se pudo leer el comercio. Volvé a intentar.");
    } finally {
      if (requestEpoch === epoch.current) {
        busyRef.current = false; setLoading(false);
        if (pendingFullRefresh.current) {
          pendingFullRefresh.current = false;
          setTimeout(() => void refresh(true), 0);
        }
      }
    }
  }, [access, session?.user.id, state.activeUserId, betianaHasOperationalAccess]);

  useEffect(() => {
    if (access !== "ready") return;
    void refresh();
    const refreshOnFocus = () => void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(() => void refresh(), 8_000);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      clearInterval(timer);
    };
  }, [refresh, access]);

  const signOut = async () => {
    epoch.current++; busyRef.current = false; localCustomerCache.current = null;
    setState(loadState()); setSnapshot(null); setLoadedAt(null); setAccess("login");
    await commerceSource?.auth.signOut({ scope: "local" });
  };
  return { session, state, setState, snapshot, access, error, loading, loadedAt, refresh, signOut };
}

export function CommerceLogin({ access, error, signOut }: { access: string; error: string; signOut: () => Promise<void> }) {
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    if (access !== "login" || !commerceSource) return;
    void commerceSource.functions.invoke("gestion-users", { body: { action: "status" } })
      .then(({ data }) => setNeedsSetup(Boolean(data?.needsSetup)));
  }, [access]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const alias = String(fields.get("email") || "").trim();
    setBusy(true); setLoginError("");
    try {
      const { error } = await commerceSource!.auth.signInWithPassword({ email: alias.includes("@") ? alias : `${alias}@matearte.uy`, password: String(fields.get("password") || "") });
      if (error) setLoginError("No se pudo ingresar. Revisá el usuario y la contraseña.");
      form.reset();
    } catch { setLoginError("No se pudo conectar. Volvé a intentar."); }
    finally { setBusy(false); }
  }
  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const username = String(fields.get("username") || "").trim().toLowerCase();
    const password = String(fields.get("password") || "");
    const confirmation = String(fields.get("confirmation") || "");
    if (!/^[a-z0-9._-]{3,64}$/.test(username)) { setLoginError("Elegí un usuario de al menos 3 caracteres, sin espacios."); return; }
    if (password.length < 8) { setLoginError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirmation) { setLoginError("Las contraseñas no coinciden."); return; }
    setBusy(true); setLoginError("");
    try {
      const { data, error } = await commerceSource!.functions.invoke("gestion-users", { body: { action: "bootstrap", username, password } });
      if (error || !data?.username) { setLoginError(data?.error || "No se pudo configurar el acceso inicial."); return; }
      const result = await commerceSource!.auth.signInWithPassword({ email: `${username}@matearte.uy`, password });
      if (result.error) setLoginError("El usuario se creó, pero no se pudo iniciar sesión. Probá ingresar con los mismos datos.");
    } catch { setLoginError("No se pudo conectar. Volvé a intentar."); }
    finally { setBusy(false); }
  }
  return <main className="gestion-login">
    <div className="commerce-auth">
      <img src="/matearte-icon.png" width="52" height="52" alt="MateArte" />
      <h1>MateArte Gestión</h1>
      {!commerceSource ? <div>Falta configurar la conexión de Gestión.</div>
        : access === "loading" ? <div role="status">Comprobando acceso…</div>
          : access === "denied" ? <><div>Esta cuenta no tiene acceso a Gestión.</div><button className="secondary" onClick={() => void signOut()}>Usar otra cuenta</button></>
            : setup ? <form onSubmit={(event) => void configure(event)}>
              <div className="commerce-auth-intro"><strong>Configurar acceso inicial</strong><span>Elegí el usuario y la contraseña del administrador.</span></div>
              <label>Usuario de ingreso<input name="username" autoComplete="username" required /></label>
              <label>Contraseña<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
              <label>Confirmar contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required /></label>
              <button type="submit" className="primary" disabled={busy}>{busy ? "Configurando…" : "Crear acceso e ingresar"}</button>
              <button type="button" className="secondary" onClick={() => { setSetup(false); setLoginError(""); }}>Volver</button>
            </form> : <form onSubmit={(event) => void login(event)}>
              <label>Usuario o correo<input name="email" autoComplete="username" required /></label>
              <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
              <button type="submit" className="primary" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
              {needsSetup && <button type="button" className="text-button commerce-auth-setup" onClick={() => { setSetup(true); setLoginError(""); }}>Configurar primer usuario</button>}
            </form>}
      {(error || loginError) && <div className="error" role="alert">{loginError || error}</div>}
    </div>
  </main>;
}
