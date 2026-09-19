import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import {
  DEFAULT_INTERNATIONAL_SHIPPING_RATES,
  formatUyu,
  getInternationalShippingRate,
  INTERNATIONAL_SHIPPING_ZONES,
  InternationalShippingRow,
  InternationalShippingZone,
} from './internationalShipping';

interface Props {
  onNotice: (message: string) => void;
}

export function InternationalShipping({ onNotice }: Props) {
  const [rates, setRates] = useState<InternationalShippingRow[]>(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
  const [savedRates, setSavedRates] = useState<InternationalShippingRow[]>(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dbAvailable, setDbAvailable] = useState(true);

  // Simulator state
  const [simCountry, setSimCountry] = useState('España');
  const [simWeightGrams, setSimWeightGrams] = useState(850);

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('commerce_international_shipping_rates')
        .select('*')
        .order('row_order', { ascending: true });

      if (error) {
        if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
          setDbAvailable(false);
          setRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
          setSavedRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
        } else {
          onNotice(`Error al cargar tarifas: ${error.message}`);
        }
      } else if (data && data.length > 0) {
        const mapped = data as InternationalShippingRow[];
        setRates(mapped);
        setSavedRates(mapped);
        setDbAvailable(true);
      } else {
        // Empty table, fallback to defaults
        setRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
        setSavedRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
      }
    } catch {
      setDbAvailable(false);
      setRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
      setSavedRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
    } finally {
      setLoading(false);
    }
  }, [onNotice]);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  // Track unsaved modifications
  const modifiedCells = useMemo(() => {
    const diffs = new Set<string>();
    rates.forEach((row, rIdx) => {
      const savedRow = savedRates[rIdx];
      if (!savedRow) return;
      INTERNATIONAL_SHIPPING_ZONES.forEach(({ key }) => {
        if (Number(row[key]) !== Number(savedRow[key])) {
          diffs.add(`${row.row_order}-${key}`);
        }
      });
    });
    return diffs;
  }, [rates, savedRates]);

  const hasUnsavedChanges = modifiedCells.size > 0;

  const handleCellChange = (rowIndex: number, zoneKey: InternationalShippingZone, rawValue: string) => {
    const val = parseFloat(rawValue);
    const num = isNaN(val) || val < 0 ? 0 : val;
    setRates((current) => {
      const next = [...current];
      next[rowIndex] = {
        ...next[rowIndex],
        [zoneKey]: num,
      };
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const payload = rates.map((r) => ({
        row_order: r.row_order,
        weight_label: r.weight_label,
        weight_min_g: r.weight_min_g,
        weight_max_g: r.weight_max_g,
        argentina: r.argentina,
        suramerica: r.suramerica,
        estados_unidos: r.estados_unidos,
        resto_america: r.resto_america,
        espana: r.espana,
        resto_europa: r.resto_europa,
        resto_mundo: r.resto_mundo,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('commerce_international_shipping_rates')
        .upsert(payload, { onConflict: 'row_order' });

      if (error) {
        if (error.code === '42P01') {
          onNotice('La tabla en Supabase aún no existe. Ejecutá la migración 20260919193000_international_shipping_rates.sql');
          setSavedRates(rates); // Keep in memory
        } else {
          onNotice(`Error al guardar tarifas: ${error.message}`);
        }
      } else {
        setSavedRates(rates);
        setDbAvailable(true);
        onNotice(`Tarifario internacional actualizado con éxito (${modifiedCells.size} precios modificados).`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error inesperado';
      onNotice(`Error al guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setRates(savedRates);
    onNotice('Se descartaron los cambios no guardados.');
  };

  const handleResetToDefaults = () => {
    if (window.confirm('¿Deseas restablecer toda la tabla a los valores iniciales de la planilla oficial?')) {
      setRates(DEFAULT_INTERNATIONAL_SHIPPING_RATES);
      onNotice('Se restauraron los valores iniciales de la planilla. Hacé clic en "Guardar cambios" para confirmarlos.');
    }
  };

  // Simulator calculation
  const simResult = useMemo(() => {
    return getInternationalShippingRate(simWeightGrams, simCountry, rates);
  }, [simWeightGrams, simCountry, rates]);

  return (
    <section className="panel" style={{ maxWidth: '100%', overflow: 'hidden' }}>
      <div className="panel-head" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Envíos Internacionales</h3>
          <p style={{ margin: '0.35rem 0 0', color: '#55655c', fontSize: '0.82rem' }}>
            Tarifario oficial por rango de peso y zona de destino. Cada celda de precio es editable.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {hasUnsavedChanges && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleDiscard}
              disabled={saving}
              style={{ minHeight: '38px', padding: '0 1rem' }}
            >
              Descartar cambios
            </button>
          )}

          <button
            type="button"
            className="secondary-button"
            onClick={handleResetToDefaults}
            disabled={saving}
            title="Restaura los valores por defecto del tarifario"
            style={{ minHeight: '38px', padding: '0 0.85rem' }}
          >
            Restablecer planilla
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={!hasUnsavedChanges || saving}
            style={{
              minHeight: '38px',
              padding: '0 1.25rem',
              backgroundColor: hasUnsavedChanges ? '#1b5e20' : undefined,
              color: '#fff',
              fontWeight: 700,
            }}
          >
            {saving ? 'Guardando…' : hasUnsavedChanges ? `Guardar cambios (${modifiedCells.size})` : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {!dbAvailable && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400e' }}>
          <strong>Nota de base de datos:</strong> Mostrando tarifas desde memoria local. Para persistir permanentemente en Supabase, aplicá la migración <code>20260919193000_international_shipping_rates.sql</code> en el SQL Editor.
        </div>
      )}

      {/* Simulador Interactivo */}
      <div
        style={{
          background: '#f4f7f4',
          border: '1px solid #d0ded3',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '0.9rem', color: '#1f3327', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔍</span> Simulador de cotización en vivo
          </strong>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600, color: '#304238' }}>
            País de destino:
            <select
              value={simCountry}
              onChange={(e) => setSimCountry(e.target.value)}
              style={{
                minWidth: '220px',
                height: '36px',
                padding: '0 0.6rem',
                borderRadius: '4px',
                border: '1px solid #b7c0b9',
                background: '#fff',
                fontSize: '0.82rem',
                color: '#1f3327',
              }}
            >
              <option value="Argentina">Argentina</option>
              <optgroup label="Bolivia, Brasil, Chile, Paraguay, Venezuela">
                <option value="Bolivia">Bolivia</option>
                <option value="Brasil">Brasil</option>
                <option value="Chile">Chile</option>
                <option value="Paraguay">Paraguay</option>
                <option value="Venezuela">Venezuela</option>
              </optgroup>
              <optgroup label="Estados Unidos">
                <option value="Estados Unidos">Estados Unidos</option>
              </optgroup>
              <optgroup label="España">
                <option value="España">España</option>
              </optgroup>
              <optgroup label="Resto de América">
                <option value="Canadá">Canadá</option>
                <option value="Colombia">Colombia</option>
                <option value="Costa Rica">Costa Rica</option>
                <option value="Ecuador">Ecuador</option>
                <option value="México">México</option>
                <option value="Panamá">Panamá</option>
                <option value="Perú">Perú</option>
                <option value="Puerto Rico">Puerto Rico</option>
                <option value="República Dominicana">República Dominicana</option>
              </optgroup>
              <optgroup label="Resto de Europa">
                <option value="Alemania">Alemania</option>
                <option value="Austria">Austria</option>
                <option value="Bélgica">Bélgica</option>
                <option value="Francia">Francia</option>
                <option value="Italia">Italia</option>
                <option value="Países Bajos">Países Bajos</option>
                <option value="Portugal">Portugal</option>
                <option value="Reino Unido">Reino Unido</option>
                <option value="Suiza">Suiza</option>
              </optgroup>
              <optgroup label="Resto del Mundo">
                <option value="Australia">Australia</option>
                <option value="China">China</option>
                <option value="Emiratos Árabes">Emiratos Árabes</option>
                <option value="Israel">Israel</option>
                <option value="Japón">Japón</option>
                <option value="Otro país">Otro país (Resto del mundo)</option>
              </optgroup>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600, color: '#304238' }}>
            Peso del pedido (gramos):
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="number"
                min="1"
                max="30000"
                step="50"
                value={simWeightGrams}
                onChange={(e) => setSimWeightGrams(Math.max(1, Number(e.target.value)))}
                style={{
                  width: '110px',
                  height: '36px',
                  padding: '0 0.6rem',
                  borderRadius: '4px',
                  border: '1px solid #b7c0b9',
                  background: '#fff',
                  fontSize: '0.82rem',
                  textAlign: 'right',
                }}
              />
            </div>
          </label>

          {/* Result Card */}
          {simResult && (
            <div
              style={{
                marginLeft: 'auto',
                background: '#ffffff',
                border: '2px solid #2e7d32',
                borderRadius: '6px',
                padding: '0.45rem 1rem',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1b5e20', fontVariantNumeric: 'tabular-nums' }}>
                {formatUyu(simResult.rate)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de Tarifas */}
      {loading ? (
        <p className="loading">Cargando tarifario internacional…</p>
      ) : (
        <div className="table-scroll" style={{ border: '1px solid #d4ded6', borderRadius: '6px', maxHeight: '72vh', overflowY: 'auto' }}>
          <table style={{ minWidth: '80rem', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 3, boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
              {/* Zonas de Destino */}
              <tr>
                <th
                  style={{
                    backgroundColor: '#e8ece8',
                    color: '#1f3327',
                    border: '1px solid #d4ded6',
                    padding: '0.65rem 0.75rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    fontSize: '0.72rem',
                  }}
                >
                  Rango (kg/g)
                </th>
                {INTERNATIONAL_SHIPPING_ZONES.map((zone) => (
                  <th
                    key={zone.key}
                    style={{
                      backgroundColor: '#e8ece8',
                      color: '#1f3327',
                      border: '1px solid #d4ded6',
                      padding: '0.5rem 0.6rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontSize: '0.68rem',
                      lineHeight: '1.25',
                      verticalAlign: 'middle',
                      minWidth: '120px',
                    }}
                    title={zone.description}
                  >
                    {zone.headerLines.map((line, lIdx) => (
                      <span key={lIdx} style={{ display: 'block' }}>
                        {line}
                      </span>
                    ))}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rates.map((row, rIdx) => {
                const isEven = rIdx % 2 === 0;
                return (
                  <tr key={row.row_order} style={{ backgroundColor: isEven ? '#ffffff' : '#fafbfa' }}>
                    {/* Columna A: Rango de peso */}
                    <td
                      style={{
                        border: '1px solid #e1e7e2',
                        padding: '0.4rem 0.75rem',
                        fontWeight: 700,
                        color: '#1e3326',
                        textAlign: 'center',
                        backgroundColor: isEven ? '#f9faf9' : '#f2f4f2',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.weight_label}
                    </td>

                    {/* Columnas 2 a 8: Zonas */}
                    {INTERNATIONAL_SHIPPING_ZONES.map((zone) => {
                      const cellKey = `${row.row_order}-${zone.key}`;
                      const isModified = modifiedCells.has(cellKey);
                      const currentVal = row[zone.key] ?? 0;

                      return (
                        <td
                          key={zone.key}
                          style={{
                            border: '1px solid #e1e7e2',
                            padding: '0.2rem 0.35rem',
                            backgroundColor: isModified ? '#fef9c3' : undefined,
                            textAlign: 'right',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.2rem' }}>
                            <span style={{ fontSize: '0.7rem', color: '#75837a', userSelect: 'none' }}>$</span>
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={currentVal}
                              onChange={(e) => handleCellChange(rIdx, zone.key, e.target.value)}
                              style={{
                                width: '100%',
                                minWidth: '78px',
                                padding: '0.25rem 0.4rem',
                                border: isModified ? '1px solid #eab308' : '1px solid transparent',
                                borderRadius: '3px',
                                background: isModified ? '#fef08a' : 'transparent',
                                textAlign: 'right',
                                fontFamily: 'inherit',
                                fontSize: '0.78rem',
                                fontVariantNumeric: 'tabular-nums',
                                fontWeight: isModified ? 700 : 500,
                                outline: 'none',
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.border = '1px solid #2e7d32';
                                e.currentTarget.style.background = '#ffffff';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.border = isModified ? '1px solid #eab308' : '1px solid transparent';
                                e.currentTarget.style.background = isModified ? '#fef08a' : 'transparent';
                              }}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
