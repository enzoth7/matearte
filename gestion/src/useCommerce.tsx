import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { commerceSource, readCommerceOrders, readCommerceProducts, readCommerceReference } from "./commerceSource";
import { adaptCommerce, type CommerceSnapshot, type CommercePayment, type NationalRate, type RuralRaffleEntry, type WebCustomerProfile } from "./commerceAdapter";
import { loadState, type State } from "./data";
import type { LocalCustomer, LocalSale } from "./localSource";
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
    const { data, error } = await client.rpc("gestion_customer_profile_details", { p_offset: page * 100, p_limit: 100 });
    if (error) throw error;
    const rows = (data || []) as WebCustomerProfile[];
    profiles.push(...rows);
    if (rows.length < 100) return profiles;
  }
}

export function useCommerce() {
  const epoch = useRef(0);
  const busyRef = useRef(false);
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
    epoch.current++; busyRef.current = false;
    setSnapshot(null); setLoadedAt(null); setState(loadState());
    if (!session || !commerceSource) { setAccess("login"); return; }
    setAccess("loading");
    void commerceSource.from("commerce_admin_users").select("user_id").eq("user_id", session.user.id).eq("active", true).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setAccess(data && !error ? "ready" : "denied");
        setError(error?.message || "");
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const refresh = useCallback(async () => {
    const client = commerceSource;
    if (!client || access !== "ready" || busyRef.current) return;
    const requestEpoch = epoch.current;
    busyRef.current = true;
    setLoading(true);
    try {
      const [products, orders, payments, reference, shipping, customerProfiles, localCustomers, localSales, ruralRaffleEntries, wholesale] = await Promise.all([
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
        readAllPages<LocalCustomer>(async (page) => {
          const { data, count, error } = await client.from("local_sales_customers")
            .select("id,full_name,email,phone,city,country,birth_date,first_purchase_date,last_purchase_date,source_user_id,notes", { count: "exact" })
            .order("id").range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: (data || []) as LocalCustomer[], count: count ?? 0 };
        }),
        readAllPages<LocalSale>(async (page) => {
          const { data, count, error } = await client.from("local_sales")
            .select("id,sale_number,reference_code,channel,customer_id,customer_name,sold_on,payment_method,total_minor,currency,created_at,local_sale_items(id,variant_id,sku,product_name,variant_name,quantity,unit_price_minor,line_total_minor)", { count: "exact" })
            .order("id").range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: (data || []) as LocalSale[], count: count ?? 0 };
        }),
        readAllPages<RuralRaffleEntry>(async (page) => {
          const { data, count, error } = await client.from("rural_raffle_entries")
            .select("id,full_name,email,phone,city,country,birth_date,product_interest,created_at", { count: "exact" })
            .order("created_at", { ascending: false }).range(page * 100, page * 100 + 99);
          if (error) throw error;
          return { rows: (data || []) as RuralRaffleEntry[], count: count ?? 0 };
        }),
        readWholesale(),
      ]);
      if (requestEpoch !== epoch.current) return;
      if (shipping.error) throw shipping.error;
      const next: CommerceSnapshot = { products, orders, payments, reference, nationalRates: (shipping.data || []) as NationalRate[], customerProfiles, localCustomers, localSales, ruralRaffleEntries, wholesale };
      const adapted = adaptWholesale(adaptCommerce(next, (path) => client.storage.from("product-images").getPublicUrl(path).data.publicUrl), wholesale);
      setState((current) => ({ ...adapted, access: current.access, user: current.user, activeUserId: current.activeUserId }));
      setSnapshot(next); setLoadedAt(new Date()); setError("");
    } catch (error) {
      if (requestEpoch !== epoch.current) return;
      setError(error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "No se pudo leer el comercio. Volvé a intentar.");
    } finally { if (requestEpoch === epoch.current) { busyRef.current = false; setLoading(false); } }
  }, [access, session?.user.id]);

  useEffect(() => {
    if (access !== "ready") return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [refresh, access]);

  const signOut = async () => {
    epoch.current++; busyRef.current = false;
    setState(loadState()); setSnapshot(null); setLoadedAt(null); setAccess("login");
    await commerceSource?.auth.signOut({ scope: "local" });
  };
  return { session, state, setState, snapshot, access, error, loading, loadedAt, refresh, signOut };
}

export function CommerceLogin({ access, error, signOut }: { access: string; error: string; signOut: () => Promise<void> }) {
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
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
  return <main className="gestion-login">
    <div className="commerce-auth">
      <img src="/matearte-icon.png" width="52" height="52" alt="MateArte" />
      <h1>MateArte Gestión</h1>
      {!commerceSource ? <div>Falta configurar la conexión de Gestión.</div>
        : access === "loading" ? <div role="status">Comprobando acceso…</div>
          : access === "denied" ? <><div>Esta cuenta no tiene acceso a Gestión.</div><button className="secondary" onClick={() => void signOut()}>Usar otra cuenta</button></>
            : <form onSubmit={(event) => void login(event)}>
              <label>Usuario o correo<input name="email" autoComplete="username" required /></label>
              <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
              <button type="submit" className="primary" disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
            </form>}
      {(error || loginError) && <div className="error" role="alert">{loginError || error}</div>}
    </div>
  </main>;
}
