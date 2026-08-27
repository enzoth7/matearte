import { ArrowRight, CheckCircle, Clock, EnvelopeSimple, MapPin, Package, PencilSimple, Receipt, ShoppingBagOpen } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { countryName } from "@/lib/countries";
import { isActiveOrder, isConfirmedOrder, orderStatusLabels, orderStatusTone } from "@/lib/order-status";
import { requireUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mi cuenta",
  description: "Consultá tus pedidos y el estado de cada compra en MateArte.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type OrderItem = {
  id: string;
  item_type: "catalog" | "design";
  title: string;
  quantity: number;
  total_minor: number;
};

type CustomerOrder = {
  id: string;
  order_number: number;
  status: string;
  shipping_method: string;
  total_minor: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
  order_items: OrderItem[] | null;
};

const money = (minor: number, currency = "UYU") =>
  new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

const date = (value: string) =>
  new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));

function AccountAccessRequired({ authError }: { authError?: string }) {
  return (
    <main id="contenido" className="section-space">
      <div className="container-shell max-w-5xl">
        <section className="grid overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)] lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="p-7 sm:p-10 lg:p-12">
            <p className="eyebrow text-[var(--leather)]">Tu cuenta MateArte</p>
            <h1 className="display-md mt-7">Ingresá para ver tus pedidos</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-black/65">
              Accedé directamente desde la tienda. Si es tu primera vez, Google crea tu cuenta y después completás tus datos sin salir de matearte.vercel.app.
            </p>
            {authError && <p role="alert" className="mt-5 border-l-2 border-[var(--danger)] pl-4 text-sm text-[var(--danger)]">No pudimos completar el acceso. Probá nuevamente.</p>}
          </div>
          <div className="bg-[var(--cream-deep)]/55 p-7 sm:p-9 lg:flex lg:flex-col lg:justify-center">
            <p className="text-[0.68rem] font-semibold tracking-[0.14em] text-[var(--leather)] uppercase">Un solo acceso</p>
            <h2 className="display-font mt-4 text-3xl">Tienda y visualizador</h2>
            <p className="mt-3 text-sm leading-6 text-black/60">Tus datos, diseños y pedidos se guardan en la misma cuenta.</p>
            <GoogleAuthButton />
            <p className="mt-4 text-center text-[0.7rem] leading-5 text-black/45">Al continuar, Google crea tu cuenta automáticamente si todavía no existe.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const params = await searchParams;
  const { user, client } = await requireUser();
  if (!user) return <AccountAccessRequired authError={params.auth} />;

  const [{ data: profile }, { data, error }] = await Promise.all([
    client
      .from("customer_profiles")
      .select("full_name,country_code,department,city,avatar_path,profile_completed_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("orders")
      .select("id,order_number,status,shipping_method,total_minor,currency,created_at,paid_at,order_items(id,item_type,title,quantity,total_minor)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!profile?.profile_completed_at) redirect("/perfil/editar");

  const orders = (data || []) as CustomerOrder[];
  const name = profile?.full_name || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "");
  const firstName = name.trim().split(/\s+/)[0] || "hola";
  const location = [profile?.city, profile?.department, countryName(profile?.country_code)].filter(Boolean).join(", ");
  const activeCount = orders.filter((order) => isActiveOrder(order.status)).length;
  const confirmedCount = orders.filter((order) => isConfirmedOrder(order.status)).length;
  const customizer = process.env.NEXT_PUBLIC_CUSTOMIZER_URL || "http://localhost:5173";
  const avatarResult = profile?.avatar_path
    ? await client.storage.from("profile-avatars").createSignedUrl(profile.avatar_path, 60 * 60)
    : null;
  const avatarUrl = avatarResult?.data?.signedUrl || null;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join("") || "MA";

  return (
    <main id="contenido" className="pb-24 pt-8 sm:pb-32 sm:pt-12">
      <div className="container-shell">
        <section className="overflow-hidden border border-black/15 bg-[var(--paper)] shadow-[var(--shadow-soft)]" aria-labelledby="account-title">
          <div className="h-1.5 bg-[var(--leather)]" aria-hidden="true" />
          <div className="grid lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-full border-4 border-[var(--cream-deep)] bg-[var(--leather)] shadow-md sm:size-28">
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={`Foto de perfil de ${name || firstName}`} fill sizes="112px" className="object-cover" priority />
                  ) : (
                    <span className="display-font grid size-full place-items-center text-3xl font-semibold text-[var(--cream-deep)]" aria-label={`Iniciales de ${name || firstName}`}>{initials}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow text-[var(--leather)]">Mi cuenta</p>
                  <h1 id="account-title" className="display-font mt-4 text-4xl font-medium tracking-[-0.025em] sm:text-5xl">Hola, {firstName}</h1>
                  <div className="mt-4 space-y-2 text-sm text-black/65">
                    <p className="flex items-center gap-2"><EnvelopeSimple size={18} className="shrink-0 text-[var(--leather)]" aria-hidden="true" /><span className="truncate">{user.email}</span></p>
                    {location && <p className="flex items-center gap-2"><MapPin size={18} className="shrink-0 text-[var(--leather)]" aria-hidden="true" /><span>{location}</span></p>}
                  </div>
                </div>
              </div>
              <div className="mt-7 flex flex-wrap gap-3 sm:ml-[8.5rem]">
                <Link className="button-secondary gap-2" href="/perfil/editar">
                  <PencilSimple size={18} aria-hidden="true" />
                  Editar mis datos
                </Link>
                <a className="button-secondary" href={`${customizer}/?view=profile`}>Ver mis diseños</a>
              </div>
            </div>
            <div className="bg-[var(--walnut)] p-6 text-[var(--paper)] sm:p-8 lg:p-9">
              <p className="text-[0.68rem] font-semibold tracking-[0.16em] text-[var(--rawhide)] uppercase">Resumen de tu cuenta</p>
              <dl className="mt-6 divide-y divide-white/15">
                <div className="flex items-center justify-between gap-5 py-4 first:pt-0">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><ShoppingBagOpen size={21} aria-hidden="true" />Pedidos realizados</dt>
                  <dd className="display-font text-3xl tabular-nums">{orders.length}</dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-4">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><Clock size={21} aria-hidden="true" />En curso</dt>
                  <dd className="display-font text-3xl tabular-nums">{activeCount}</dd>
                </div>
                <div className="flex items-center justify-between gap-5 py-4 last:pb-0">
                  <dt className="flex items-center gap-3 text-sm text-white/75"><CheckCircle size={21} aria-hidden="true" />Pagados</dt>
                  <dd className="display-font text-3xl tabular-nums">{confirmedCount}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="pt-12 sm:pt-16" aria-labelledby="orders-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-[var(--leather)]">Historial</p>
              <h2 id="orders-title" className="display-font mt-5 text-4xl sm:text-5xl">Mis pedidos</h2>
            </div>
            <Link className="button-secondary" href="/catalogo">Seguir comprando</Link>
          </div>

          {error ? (
            <div role="alert" className="mt-8 border border-[var(--danger)]/30 bg-[var(--paper)] p-6 text-[var(--danger)]">
              No pudimos cargar tus pedidos. Probá nuevamente en unos minutos.
            </div>
          ) : orders.length === 0 ? (
            <div className="mt-8 border border-black/15 bg-[var(--paper)] p-7 sm:p-10">
              <Receipt size={30} className="text-[var(--leather)]" aria-hidden="true" />
              <h3 className="display-font mt-5 text-3xl">Todavía no hiciste una compra</h3>
              <p className="mt-3 max-w-lg text-sm leading-7 text-black/60">
                Cuando completes un pedido, vas a poder seguir su estado y consultar el detalle desde acá.
              </p>
              <Link className="button-primary mt-7" href="/catalogo">Ver catálogo</Link>
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              {orders.map((order) => {
                const items = order.order_items || [];
                return (
                  <article key={order.id} className="group overflow-hidden border border-black/15 bg-[var(--paper)] transition-[border-color,box-shadow] duration-200 hover:border-[var(--leather)]/45 hover:shadow-[var(--shadow-soft)]">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-[var(--cream-deep)]/45 px-5 py-4 sm:px-7">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                        <p className="text-xs font-bold tracking-[0.12em] text-[var(--walnut)] uppercase">Pedido #{order.order_number}</p>
                        <p className="text-xs text-black/55">{date(order.created_at)}</p>
                      </div>
                      <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${orderStatusTone(order.status)}`}>
                        {orderStatusLabels[order.status] || order.status}
                      </span>
                    </header>
                    <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-black/45 uppercase">Contenido</p>
                        {items.length ? (
                          <ul className="mt-3 space-y-2" aria-label={`Artículos del pedido ${order.order_number}`}>
                            {items.map((item) => (
                              <li key={item.id} className="flex items-start gap-3 text-sm text-black/70">
                                <Package size={19} className="mt-0.5 shrink-0 text-[var(--leather)]" aria-hidden="true" />
                                <span>{item.quantity > 1 ? `${item.quantity} × ` : ""}{item.title}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-black/60">Detalle del pedido disponible</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-5 border-t border-black/10 pt-5 lg:block lg:border-l lg:border-t-0 lg:py-1 lg:pl-7 lg:text-right">
                        <div>
                          <p className="text-[0.68rem] font-semibold tracking-[0.12em] text-black/45 uppercase">{order.shipping_method === "international_coordination" ? "Subtotal sin envío" : "Total"}</p>
                          <p className="display-font mt-1 text-3xl font-semibold tabular-nums">{money(order.total_minor, order.currency)}</p>
                        </div>
                        <Link href={`/pedidos/${order.id}`} className="button-primary mt-0 gap-2 lg:mt-4 lg:w-full" aria-label={`Ver detalle del pedido ${order.order_number}`}>
                          Ver detalle <ArrowRight size={17} aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
