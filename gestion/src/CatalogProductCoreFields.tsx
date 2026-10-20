type CategoryOption = { code: string; label: string };

export function CatalogProductCoreFields({ category, categories, categoryRequired = false, saleMode, weight, description, onCategoryChange, onSaleModeChange, onWeightChange, onDescriptionChange }: {
  category: string;
  categories: CategoryOption[];
  categoryRequired?: boolean;
  saleMode: string;
  weight: string | number;
  description: string;
  onCategoryChange: (value: string) => void;
  onSaleModeChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return <>
    <label><span className="field-label">Categoría {categoryRequired && <span className="field-required" aria-hidden="true">*</span>}</span>
      <select required={categoryRequired} value={category} onChange={event => onCategoryChange(event.target.value)}>
        <option value="" disabled={categoryRequired}>{categoryRequired ? "Elegí una categoría" : "Sin categoría"}</option>
        {categories.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select>
    </label>
    <label><span className="field-label">Modalidad</span><select value={saleMode} onChange={event => onSaleModeChange(event.target.value)}><option value="standard">Venta normal</option><option value="made_to_order">Por encargo</option></select></label>
    <label><span className="field-label">Peso (g)</span><input type="number" min="0" step="1" value={weight} onChange={event => onWeightChange(event.target.value)} placeholder="0" /></label>
    <label className="wide-field"><span className="field-label">Descripción</span><textarea value={description} onChange={event => onDescriptionChange(event.target.value)} placeholder="Material y cualquier detalle que lo diferencie." /></label>
  </>;
}
