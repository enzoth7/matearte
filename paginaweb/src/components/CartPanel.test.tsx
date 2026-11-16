import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../messages/es.json";
import { CartPanel } from "./CartPanel";
import { CartMerger } from "./CartMerger";
import { DEFAULT_WHOLESALE_DISCOUNT_SETTINGS } from "@/lib/wholesale-pricing";
import { readLocalCart } from "@/lib/browser-cart";
import type { CartCatalogProduct } from "@/lib/cart-recommendations";

vi.mock("next/image", () => ({ default: ({ fill: _fill, unoptimized: _unoptimized, ...props }: Record<string, unknown>) => <img {...props} /> }));
vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={typeof href === "string" ? href : "/producto/prueba"} {...props}>{children}</a> }));
vi.mock("@/lib/supabase/browser", () => ({ createBrowserSupabase: () => ({ storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "/test.webp" } }) }) } }) }));
vi.mock("../../../shared/journeyAnalytics", () => ({ trackJourneyStep: vi.fn() }));
const product = (id: string, family: "mate" | "bombilla" | "termo", price: number): CartCatalogProduct => ({
  id, slug: id, name: id, category: `${family}s`, family, purchaseAxes: [], attributes: {}, images: [], quickVariantId: `${id}-variant`,
  variants: [{ id: `${id}-variant`, commerceId: `${id}-variant`, value: id, label: "Única", available: true, options: {}, price: { amountMinor: price, currency: "UYU" } }],
});
const catalog = [product("Mate", "mate",500000),product("Bombilla", "bombilla",100000), { ...product("Termo", "termo",150000),quickVariantId:undefined }];
const remoteItem = (id: string, quantity = 1) => {
  const p=catalog.find(p=>p.id===id)!;
  return {id,quantity,item_type:"catalog",unit_price_minor:p.variants[0].price!.amountMinor,base_unit_price_minor:p.variants[0].price!.amountMinor,currency:"UYU",variant:{id:p.variants[0].id,name:id,active:true,available_web:true,price_minor:p.variants[0].price!.amountMinor,currency:"UYU",option_values:{},product:{id,name:id,category:p.category,published:true}},design:null};
};
const show = () => render(<NextIntlClientProvider locale="es" messages={messages}><CartPanel catalog={catalog} wholesaleSettings={DEFAULT_WHOLESALE_DISCOUNT_SETTINGS} /></NextIntlClientProvider>);
const json = (data: unknown, status=200) => new Response(JSON.stringify(data),{status});
let authenticated=false;
let items=[remoteItem("Mate")];
let fail=false;
let valid=true;
let postCount=0;
beforeEach(()=>{
  authenticated=false;items=[remoteItem("Mate")];fail=false;valid=true;postCount=0;localStorage.clear();
  localStorage.setItem("matearte_visitor_cart_v1",JSON.stringify([{variantId:"Mate-variant",quantity:1}]));
  vi.stubGlobal("fetch",vi.fn(async(input:string, init?:RequestInit)=>{
    if(input==="/api/session") return json({authenticated});
    if(input==="/api/cart") {
      if(authenticated && init?.method==="POST") items=[...items,remoteItem("Bombilla")];
      return authenticated ? json({id:"cart",items}) : json({},401);
    }
    if(input.startsWith("/api/catalog/products")) return json({available:valid,commerceEnabled:true,quickAddVariantId:valid ? "Bombilla-variant":undefined,quickAddOptionValues:{color:"natural"}});
    if(input==="/api/cart/items") {
      if(init?.method==="POST") { postCount++;if(fail)return json({error:"failed"},500);if(!authenticated)return json({},401);items=[...items,remoteItem("Bombilla")]; }
      if(init?.method==="DELETE") items=items.filter(i=>i.id!==JSON.parse(init.body as string).itemId);
      if(init?.method==="PATCH") { const value=JSON.parse(init.body as string);items=items.map(i=>i.id===value.itemId?{...i,quantity:value.quantity}:i); }
      return json({id:"cart",items});
    }
    throw new Error(`Unexpected ${input}`);
  }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("CartPanel integration",()=>{
  it("refreshes after the visitor cart is merged on sign-in",async()=>{
    authenticated=true;
    localStorage.setItem("matearte_visitor_cart_v1",JSON.stringify([{variantId:"Bombilla-variant",quantity:1}]));
    render(<NextIntlClientProvider locale="es" messages={messages}><CartMerger /><CartPanel catalog={catalog} wholesaleSettings={DEFAULT_WHOLESALE_DISCOUNT_SETTINGS} /></NextIntlClientProvider>);
    await screen.findByText("Total: $ 6.000 UYU");
    expect(readLocalCart()).toHaveLength(0);
    expect(screen.queryByRole("button",{name:"Agregar Bombilla al carrito"})).not.toBeInTheDocument();
  });
  it("guest quick add updates items, subtotal, recommendations and persists after remount",async()=>{
    const mounted=show();
    const add=await screen.findByRole("button",{name:"Agregar Bombilla al carrito"});
    expect(screen.queryByRole("button",{name:"Agregar Termo al carrito"})).not.toBeInTheDocument();
    fireEvent.click(add);fireEvent.click(add);
    await waitFor(()=>expect(readLocalCart()).toHaveLength(2));
    expect(postCount).toBe(1);
    expect(readLocalCart().find(i=>i.variantId==="Bombilla-variant")?.optionValues).toEqual({color:"natural"});
    const post = vi.mocked(fetch).mock.calls.find(([url,init])=>url==="/api/cart/items" && init?.method==="POST");
    expect(JSON.parse(post![1]!.body as string).optionValuesOverride).toEqual({color:"natural"});
    await waitFor(()=>expect(screen.getByText("Total: $ 6.000 UYU")).toBeInTheDocument());
    expect(screen.queryByRole("button",{name:"Agregar Bombilla al carrito"})).not.toBeInTheDocument();
    mounted.unmount();show();
    await screen.findByText("Total: $ 6.000 UYU");
    fireEvent.change(screen.getByRole("spinbutton",{name:"Editar cantidad de Mate"}),{target:{value:"2"}});
    await screen.findByText("Total: $ 11.000 UYU");
    fireEvent.click(screen.getAllByRole("button",{name:"Quitar Bombilla del carrito"}).at(-1)!);
    await screen.findByText("Total: $ 10.000 UYU");
    expect(readLocalCart()).toHaveLength(1);
  });
  it("authenticated addition, quantity and removal reuse the API and publish the count",async()=>{
    authenticated=true;const changes:number[]=[];const listener=(event:Event)=>{const count=(event as CustomEvent).detail?.count;if(count!==undefined)changes.push(count);};
    window.addEventListener("matearte-cart-change",listener);
    show();fireEvent.click(await screen.findByRole("button",{name:"Agregar Bombilla al carrito"}));
    await screen.findByText("Total: $ 6.000 UYU");
    fireEvent.change(screen.getByRole("spinbutton",{name:"Editar cantidad de Mate"}),{target:{value:"3"}});
    await waitFor(()=>expect(items[0].quantity).toBe(3));
    await screen.findByText("Total: $ 16.000 UYU");
    fireEvent.click(screen.getAllByRole("button",{name:"Quitar Bombilla del carrito"}).at(-1)!);
    await screen.findByText("Total: $ 15.000 UYU");
    expect(changes).toContain(2);await waitFor(()=>expect(changes.at(-1)).toBe(3));
    window.removeEventListener("matearte-cart-change",listener);
  });
  it("does not report success or change the cart on API failure",async()=>{
    fail=true;show();fireEvent.click(await screen.findByRole("button",{name:"Agregar Bombilla al carrito"}));
    expect(await screen.findByRole("alert")).toHaveTextContent(messages.cart.addFailed);
    expect(readLocalCart()).toHaveLength(1);expect(screen.getByText("Total: $ 5.000 UYU")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Agregar Bombilla al carrito"})).toBeEnabled();
  });
  it("blocks a quick add when availability or mandatory options changed",async()=>{
    valid=false;show();fireEvent.click(await screen.findByRole("button",{name:"Agregar Bombilla al carrito"}));
    await screen.findByRole("alert");expect(postCount).toBe(0);expect(readLocalCart()).toHaveLength(1);
  });
  it("shows selected options and a single unit price without a generic description",async()=>{
    localStorage.setItem("matearte_visitor_cart_v1",JSON.stringify([{variantId:"Mate-variant",quantity:1,optionValues:{color:"marron",talle:"39"}}]));
    show();await screen.findByText(/Talle: 39/);
    const selection=screen.getByRole("region",{name:messages.cart.selectedItems});
    expect(within(selection).getAllByText(/5.000 UYU c\/u/)).toHaveLength(1);
    expect(selection.textContent).not.toContain(String.fromCharCode(183));
  });
  it("drawer uses the real cart and recalculates quantities and installment estimates",async()=>{
    authenticated=true;
    render(<NextIntlClientProvider locale="es" messages={messages}><CartPanel mode="drawer" wholesaleSettings={DEFAULT_WHOLESALE_DISCOUNT_SETTINGS} /></NextIntlClientProvider>);
    expect(await screen.findByRole("link",{name:"Ir al carrito"})).toHaveAttribute("href","/carrito");
    expect(screen.getByText("12 cuotas de $ 416,67 UYU")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:"6"}));
    expect(screen.getByText("6 cuotas de $ 833,33 UYU")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("spinbutton",{name:"Editar cantidad de Mate"}),{target:{value:"2"}});
    await waitFor(()=>expect(screen.getAllByText("$ 10.000 UYU")).toHaveLength(2));
    expect(screen.getByText("6 cuotas de $ 1.666,67 UYU")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Quitar Mate del carrito"})).toBeEnabled();
  });
});
