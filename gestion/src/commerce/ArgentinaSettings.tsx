import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Settings = { enabled: boolean; bank_name: string; account_holder: string; cbu: string; alias: string };
export function ArgentinaSettings({ onNotice }: { onNotice: (message: string) => void }) {
  const [value, setValue] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from("commerce_argentina_settings").select("enabled,bank_name,account_holder,cbu,alias").eq("singleton", true).single().then(result => {
      if (!active) return;
      if (result.error) setError("La configuración de Argentina todavía no está disponible.");
      else setValue(result.data as Settings);
    });
    return () => { active = false; };
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!value) return;
    const next = { ...value, bank_name: value.bank_name.trim(), account_holder: value.account_holder.trim(), cbu: value.cbu.trim(), alias: value.alias.trim() };
    if (next.enabled && (!next.bank_name || !next.account_holder || !/^\d{22}$/.test(next.cbu) || !next.alias)) { onNotice("Para habilitar Argentina completá banco, titular, CBU de 22 dígitos y alias."); return; }
    setSaving(true);
    if (next.enabled) {
      const rate = await supabase.from("settings").select("exchange_rate").eq("id", 1).single();
      if (rate.error || !Number.isFinite(Number(rate.data?.exchange_rate)) || Number(rate.data?.exchange_rate) <= 0) {
        setSaving(false);
        onNotice("Configurá una cotización ARS válida en Finanzas → Monedas antes de habilitar Argentina.");
        return;
      }
    }
    const result = await supabase.from("commerce_argentina_settings").update(next).eq("singleton", true).select("singleton").single();
    setSaving(false);
    onNotice(result.error ? result.error.message : "Configuración de Argentina guardada.");
    if (!result.error) setValue(next);
  }
  return <section className="panel settings settings-section"><header className="settings-heading"><h2>Argentina · venta por unidad</h2><div>Transferencia en pesos argentinos. El envío se paga aparte por el destinatario.</div></header>
    {error && <p role="alert">{error}</p>}
    {value && <form onSubmit={save} className="bank-settings-form">
      <label className="toggle"><input type="checkbox" checked={value.enabled} onChange={event => setValue({ ...value, enabled: event.target.checked })} />Habilitar compras en Argentina</label>
      {([['bank_name','Banco'],['account_holder','Titular'],['cbu','CBU'],['alias','Alias']] as const).map(([key,label]) => <label key={key}>{label}<input required={value.enabled} maxLength={key === "cbu" ? 22 : 120} inputMode={key === "cbu" ? "numeric" : "text"} value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} /></label>)}
      <p>La cotización ARS se administra en <a href="/finanzas/monedas">Finanzas → Monedas</a>. Debe estar configurada para comprar. Los pedidos ya creados conservan su cotización y total en ARS.</p>
      <button disabled={saving}>{saving ? "Guardando…" : "Guardar Argentina"}</button>
    </form>}
  </section>;
}
