import { useEffect, useState } from "react";
import {
  CheckCircle,
  FloppyDisk,
  ImageSquare,
  SlidersHorizontal,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  engravingTypeOptions,
  getEngravingCapabilities,
  mateDecisionCatalog,
} from "../../../visualizador/src/catalog/mateDecisionCatalog";
import { getVariantDefinition } from "../../../visualizador/src/catalog/mateCatalog";
import {
  loadVisualizerCatalog,
  publishVisualizerCatalogDraft,
  saveVisualizerCatalogDraft,
  uploadVisualizerCatalogImage,
  type CatalogAdminState,
  type CatalogDocument,
  type CatalogPatch,
  type CatalogSection,
} from "./visualizerCatalog";

const uniqueOptions = <T extends { id: string }>(options: T[]): T[] =>
  options.filter((option, index) => options.findIndex((candidate) => candidate.id === option.id) === index);
const catalogFamilies = uniqueOptions(mateDecisionCatalog);
const catalogTechniques = uniqueOptions(engravingTypeOptions);
const techniqueIds = catalogTechniques.map((option) => option.id);
const entryKey = (...parts: string[]) => parts.join("::");
const effective = (
  document: CatalogDocument,
  section: CatalogSection,
  key: string,
): CatalogPatch => document[section]?.[key] ?? {};
const visible = (
  document: CatalogDocument,
  section: CatalogSection,
  key: string,
) => effective(document, section, key).enabled !== false;
const errorMessage = (reason: unknown) =>
  reason instanceof Error
    ? reason.message
    : "No se pudo completar la operación.";

export function catalogPublishIssues(document: CatalogDocument): string[] {
  const issues: string[] = [];
  const activeTechniques = new Set(
    catalogTechniques
      .filter((item) => visible(document, "techniques", item.id))
      .map((item) => item.id),
  );
  if (
    !catalogFamilies.some((item) => visible(document, "families", item.id))
  )
    issues.push("Dejá al menos un modelo visible.");
  for (const family of catalogFamilies.filter((item) =>
    visible(document, "families", item.id),
  )) {
    const activeTextures = uniqueOptions(family.textures).filter((item) =>
      visible(document, "textures", entryKey(family.id, item.id)),
    );
    if (!activeTextures.length)
      issues.push(`${family.label}: dejá al menos una construcción visible.`);
    for (const texture of activeTextures) {
      const key = entryKey(family.id, texture.id);
      const patch = effective(document, "textures", key);
      const baseline = getEngravingCapabilities(family.id, texture.id);
      if (
        !uniqueOptions(texture.colors).some((item) =>
          visible(document, "colors", entryKey(key, item.id)),
        )
      )
        issues.push(`${texture.label}: dejá al menos un color visible.`);
      if (
        !uniqueOptions(texture.metals).some((item) =>
          visible(document, "metals", entryKey(key, item.id)),
        )
      )
        issues.push(`${texture.label}: dejá al menos un metal visible.`);
      if (
        !(patch.virola ?? baseline.virolaEngravingTypes).some((id) =>
          activeTechniques.has(id as (typeof techniqueIds)[number]),
        )
      )
        issues.push(
          `${texture.label}: seleccioná una técnica de virola visible.`,
        );
      if (
        texture.capabilities.hasFleje &&
        !(patch.fleje ?? baseline.flejeEngravingTypes).some((id) =>
          activeTechniques.has(id as (typeof techniqueIds)[number]),
        )
      )
        issues.push(
          `${texture.label}: seleccioná una técnica de fleje visible.`,
        );
    }
  }
  return issues;
}

function ImageEditor({
  label,
  src,
  busy,
  eager = false,
  onUpload,
}: {
  label: string;
  src?: string;
  busy: boolean;
  eager?: boolean;
  onUpload: (file: File) => void;
}) {
  const [loadedSrc, setLoadedSrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const previewUrl = src?.startsWith("/assets")
    ? `https://matearte-visualizador.vercel.app${src}`
    : src;
  const imageLoaded = Boolean(previewUrl && loadedSrc === previewUrl);
  const imageFailed = Boolean(previewUrl && failedSrc === previewUrl);
  return (
    <div className="visualizer-catalog__image-editor">
      <div className={`visualizer-catalog__image${imageLoaded ? " is-loaded" : ""}`}>
        {previewUrl ? (
          <>
            {!imageLoaded && <div className="visualizer-catalog__image-state">{imageFailed ? "No se pudo cargar la foto" : "Cargando foto…"}</div>}
            <img src={previewUrl} alt={label} loading={eager ? "eager" : "lazy"} onLoad={() => setLoadedSrc(previewUrl)} onError={() => setFailedSrc(previewUrl)} />
          </>
        ) : (
          <><ImageSquare size={28} aria-hidden="true" /><div className="visualizer-catalog__image-state">Sin foto</div></>
        )}
      </div>
      <label className="visualizer-catalog__upload">
        <ImageSquare size={17} aria-hidden="true" />{" "}
        {busy ? "Subiendo…" : src ? "Cambiar foto" : "Agregar foto"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}

export function VisualizerCatalogView({ section }: { section: "models" | "techniques" }) {
  const [state, setState] = useState<CatalogAdminState | null>(null);
  const [document, setDocument] = useState<CatalogDocument>({});
  const [familyId, setFamilyId] = useState(catalogFamilies[0].id);
  const [textureId, setTextureId] = useState(
    catalogFamilies[0].textures[0].id,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);

  const applyState = (next: CatalogAdminState) => {
    setState(next);
    setDocument(next.draft.document);
  };
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      applyState(await loadVisualizerCatalog());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, []);

  const family = catalogFamilies.find((item) => item.id === familyId)!;
  const familyTextures = uniqueOptions(family.textures);
  const texture =
    familyTextures.find((item) => item.id === textureId) ?? familyTextures[0];
  const colors = uniqueOptions(texture.colors);
  const metals = uniqueOptions(texture.metals);
  const constructions = catalogFamilies.flatMap((item) =>
    uniqueOptions(item.textures).map((variant) => ({ item, variant })),
  );
  const textureKey = entryKey(family.id, texture.id);
  const dirty = state
    ? JSON.stringify(document) !== JSON.stringify(state.draft.document)
    : false;
  const unpublished = state
    ? JSON.stringify(document) !== JSON.stringify(state.published.document)
    : false;
  const publishIssues = catalogPublishIssues(document);
  const change = (
    kind: CatalogSection,
    key: string,
    field: keyof CatalogPatch,
    value: string | boolean | string[],
  ) => {
    setDocument((current) => ({
      ...current,
      [kind]: {
        ...current[kind],
        [key]: { ...current[kind]?.[key], [field]: value },
      },
    }));
    setError("");
    setNotice("");
    setConfirmPublish(false);
  };
  const upload = async (
    kind: CatalogSection,
    key: string,
    field: "image" | "flejeImage" | "torpedoImage",
    file: File,
  ) => {
    const id = `${kind}:${key}:${field}`;
    setUploading(id);
    setError("");
    try {
      change(kind, key, field, await uploadVisualizerCatalogImage(file));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setUploading("");
    }
  };
  const save = async () => {
    if (!state || busy || uploading) return;
    setBusy(true);
    setError("");
    try {
      applyState(await saveVisualizerCatalogDraft(state, document));
      setNotice("Borrador guardado. La web todavía usa la versión publicada.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!state || dirty || busy || uploading || publishIssues.length) return;
    setBusy(true);
    setError("");
    try {
      applyState(await publishVisualizerCatalogDraft(state));
      setNotice(
        "Catálogo publicado. Las nuevas visitas al Visualizador verán estos cambios.",
      );
      setConfirmPublish(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <section className="visualizer-pricing visualizer-pricing--loading">
        <div className="visualizer-pricing__loading-card">
          <SlidersHorizontal size={26} />
          <strong>Cargando catálogo</strong>
        </div>
      </section>
    );
  if (!state)
    return (
      <section
        className="visualizer-pricing visualizer-pricing--empty"
        role="alert"
      >
        <WarningCircle size={28} />
        <h2>No se pudo abrir el catálogo</h2>
        <div>{error}</div>
        <button
          type="button"
          className="secondary"
          onClick={() => void reload()}
        >
          Reintentar
        </button>
      </section>
    );

  return (
    <section
      className="visualizer-pricing visualizer-catalog"
      aria-label="Catálogo del Visualizador"
    >
      <div className="visualizer-pricing__actions">
        <div className="visualizer-pricing__status">
          <CheckCircle size={20} />
          <strong>{dirty ? "Cambios sin guardar" : "Borrador guardado"}</strong>
        </div>
        <div className="visualizer-pricing__action-buttons">
          <a
            className="visualizer-pricing__external"
            href="https://matearte-visualizador.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            Abrir Visualizador ↗
          </a>
          <button
            type="button"
            className="secondary"
            disabled={!dirty || busy || Boolean(uploading)}
            onClick={() => void save()}
          >
            <FloppyDisk size={18} /> Guardar borrador
          </button>
          <button
            type="button"
            className="primary"
            disabled={
              dirty ||
              !unpublished ||
              busy ||
              Boolean(uploading) ||
              publishIssues.length > 0
            }
            onClick={() => setConfirmPublish(true)}
          >
            Publicar catálogo
          </button>
        </div>
      </div>
      {error && (
        <div
          className="visualizer-pricing__message visualizer-pricing__message--error"
          role="alert"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="visualizer-pricing__message" role="status">
          {notice}
        </div>
      )}
      {publishIssues.length > 0 && (
        <div
          className="visualizer-pricing__message visualizer-pricing__message--error"
          role="alert"
        >
          Antes de publicar: {publishIssues[0]}
        </div>
      )}
      {section === "models" ? (
        <>
          <div className="visualizer-catalog__intro">
            <h2>Modelos, colores e imágenes</h2>
          </div>
          <div className="visualizer-catalog__selectors">
            <label>
              Modelo
              <select
                value={familyId}
                onChange={(event) => {
                  const next = catalogFamilies.find(
                    (item) => item.id === event.target.value,
                  )!;
                  setFamilyId(next.id);
                  setTextureId(next.textures[0].id);
                }}
              >
                {catalogFamilies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {effective(document, "families", item.id).label ??
                      item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Construcción
              <select
                value={texture.id}
                onChange={(event) => setTextureId(event.target.value)}
              >
                {familyTextures.map((item) => (
                  <option key={item.id} value={item.id}>
                    {effective(
                      document,
                      "textures",
                      entryKey(family.id, item.id),
                    ).label ?? item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="visualizer-catalog__grid">
            <article className="visualizer-catalog__card">
              <div className="visualizer-catalog__card-head">
                <h3>Modelo</h3>
                <label className="visualizer-catalog__switch">
                  <input
                    type="checkbox"
                    checked={visible(document, "families", family.id)}
                    onChange={(event) =>
                      change(
                        "families",
                        family.id,
                        "enabled",
                        event.target.checked,
                      )
                    }
                  />{" "}
                  Visible
                </label>
              </div>
              <ImageEditor
                label={`Mate ${family.label}`}
                eager
                src={
                  effective(document, "families", family.id).image ??
                  getVariantDefinition(family.representativeVariantId)?.image
                }
                busy={uploading === `families:${family.id}:image`}
                onUpload={(file) =>
                  void upload("families", family.id, "image", file)
                }
              />
              <label className="visualizer-catalog__field">
                Nombre
                <input
                  value={
                    effective(document, "families", family.id).label ??
                    family.label
                  }
                  maxLength={120}
                  onChange={(event) =>
                    change("families", family.id, "label", event.target.value)
                  }
                />
              </label>
              <label className="visualizer-catalog__field">
                Descripción
                <textarea
                  value={
                    effective(document, "families", family.id).description ??
                    family.description
                  }
                  maxLength={240}
                  onChange={(event) =>
                    change(
                      "families",
                      family.id,
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>
            </article>
            <article className="visualizer-catalog__card">
              <div className="visualizer-catalog__card-head">
                <h3>Construcción</h3>
                <label className="visualizer-catalog__switch">
                  <input
                    type="checkbox"
                    checked={visible(document, "textures", textureKey)}
                    onChange={(event) =>
                      change(
                        "textures",
                        textureKey,
                        "enabled",
                        event.target.checked,
                      )
                    }
                  />{" "}
                  Visible
                </label>
              </div>
              <ImageEditor
                label={texture.label}
                eager
                src={
                  effective(document, "textures", textureKey).image ??
                  texture.previewImage ??
                  getVariantDefinition(texture.representativeVariantId)?.image
                }
                busy={uploading === `textures:${textureKey}:image`}
                onUpload={(file) =>
                  void upload("textures", textureKey, "image", file)
                }
              />
              <label className="visualizer-catalog__field">
                Nombre
                <input
                  value={
                    effective(document, "textures", textureKey).label ??
                    texture.label
                  }
                  maxLength={120}
                  onChange={(event) =>
                    change("textures", textureKey, "label", event.target.value)
                  }
                />
              </label>
              <label className="visualizer-catalog__field">
                Descripción
                <textarea
                  value={
                    effective(document, "textures", textureKey).description ??
                    texture.description
                  }
                  maxLength={240}
                  onChange={(event) =>
                    change(
                      "textures",
                      textureKey,
                      "description",
                      event.target.value,
                    )
                  }
                />
              </label>
            </article>
          </div>
          <div className="visualizer-catalog__block">
            <div className="visualizer-catalog__block-heading"><h3>Colores</h3></div>
            <div className="visualizer-catalog__option-grid visualizer-catalog__color-grid">
              {colors.map((color) => {
                const key = entryKey(family.id, texture.id, color.id);
                const patch = effective(document, "colors", key);
                const swatch = patch.swatch ?? color.swatch;
                return (
                  <article
                    className="visualizer-catalog__option visualizer-catalog__color-row"
                    key={key}
                  >
                    <div className="visualizer-catalog__color-name">
                      <label className="visualizer-catalog__swatch" style={{ background: swatch }}>
                        <input
                          type="color"
                          aria-label={`Editar color de ${patch.label ?? color.label}`}
                          value={/^#[0-9a-fA-F]{6}$/.test(swatch) ? swatch : "#8b6c55"}
                          onChange={(event) => change("colors", key, "swatch", event.target.value)}
                        />
                      </label>
                      <label className="visualizer-catalog__field">
                        Nombre del color
                        <input
                          value={patch.label ?? color.label}
                          maxLength={120}
                          onChange={(event) => change("colors", key, "label", event.target.value)}
                        />
                      </label>
                    </div>
                    <ImageEditor
                      label={`${texture.label} ${color.label}`}
                      src={
                        patch.image ??
                        texture.colorPreviewImages?.[color.id] ??
                        getVariantDefinition(
                          texture.legacyVariantByColor?.[color.id] ??
                            texture.representativeVariantId,
                        )?.image
                      }
                      busy={uploading === `colors:${key}:image`}
                      onUpload={(file) =>
                        void upload("colors", key, "image", file)
                      }
                    />
                    <label className="visualizer-catalog__switch">
                      <input
                        type="checkbox"
                        checked={visible(document, "colors", key)}
                        onChange={(event) => change("colors", key, "enabled", event.target.checked)}
                      />{" "}
                      Visible
                    </label>
                  </article>
                );
              })}
            </div>
          </div>
          <div className="visualizer-catalog__block">
            <div className="visualizer-catalog__block-heading"><h3>Metales y virolas</h3></div>
            <div className="visualizer-catalog__option-grid visualizer-catalog__metal-grid">
              {metals.map((metal) => {
                const key = entryKey(family.id, texture.id, metal.id);
                const patch = effective(document, "metals", key);
                return (
                  <article className="visualizer-catalog__option visualizer-catalog__metal-row" key={key}>
                    <label className="visualizer-catalog__field">
                      Nombre del metal
                      <input
                        value={patch.label ?? metal.label}
                        maxLength={120}
                        onChange={(event) => change("metals", key, "label", event.target.value)}
                      />
                    </label>
                    <ImageEditor
                      label={metal.label}
                      src={patch.image ?? metal.previewImage}
                      busy={uploading === `metals:${key}:image`}
                      onUpload={(file) =>
                        void upload("metals", key, "image", file)
                      }
                    />
                    <label className="visualizer-catalog__switch">
                      <input
                        type="checkbox"
                        checked={visible(document, "metals", key)}
                        onChange={(event) => change("metals", key, "enabled", event.target.checked)}
                      />{" "}
                      Visible
                    </label>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="visualizer-catalog__block">
            <h3>Técnicas de personalización</h3>
            <div className="visualizer-catalog__option-grid">
              {catalogTechniques.map((technique) => {
                const patch = effective(document, "techniques", technique.id);
                return (
                  <article
                    className="visualizer-catalog__option"
                    key={technique.id}
                  >
                    <div className="visualizer-catalog__option-head">
                      <label className="visualizer-catalog__switch">
                        <input
                          type="checkbox"
                          checked={visible(
                            document,
                            "techniques",
                            technique.id,
                          )}
                          onChange={(event) =>
                            change(
                              "techniques",
                              technique.id,
                              "enabled",
                              event.target.checked,
                            )
                          }
                        />{" "}
                        Visible
                      </label>
                    </div>
                    <ImageEditor
                      label={technique.label}
                      src={patch.image ?? technique.image}
                      busy={uploading === `techniques:${technique.id}:image`}
                      onUpload={(file) =>
                        void upload("techniques", technique.id, "image", file)
                      }
                    />
                    <label className="visualizer-catalog__field">
                      Nombre
                      <input
                        value={patch.label ?? technique.label}
                        maxLength={120}
                        onChange={(event) =>
                          change(
                            "techniques",
                            technique.id,
                            "label",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="visualizer-catalog__field">
                      Descripción
                      <textarea
                        value={patch.description ?? technique.description}
                        maxLength={240}
                        onChange={(event) =>
                          change(
                            "techniques",
                            technique.id,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    {technique.flejeImage && (
                      <ImageEditor
                        label={`${technique.label} en fleje`}
                        src={patch.flejeImage ?? technique.flejeImage}
                        busy={
                          uploading === `techniques:${technique.id}:flejeImage`
                        }
                        onUpload={(file) =>
                          void upload(
                            "techniques",
                            technique.id,
                            "flejeImage",
                            file,
                          )
                        }
                      />
                    )}
                    {technique.torpedoImage && (
                      <ImageEditor
                        label={`${technique.label} en torpedo`}
                        src={patch.torpedoImage ?? technique.torpedoImage}
                        busy={
                          uploading ===
                          `techniques:${technique.id}:torpedoImage`
                        }
                        onUpload={(file) =>
                          void upload(
                            "techniques",
                            technique.id,
                            "torpedoImage",
                            file,
                          )
                        }
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </div>
          <div className="visualizer-catalog__block">
            <h3>Disponibilidad por construcción</h3>
            <div className="visualizer-catalog__availability">
              {(["virola", "fleje"] as const).map((area) => (
                <section className="visualizer-catalog__availability-panel" key={area}>
                  <h4>{area === "virola" ? "Virola" : "Fleje"}</h4>
                  <small className="visualizer-catalog__scroll-hint">Deslizá para ver todas las técnicas</small>
                  <div className="visualizer-catalog__availability-scroll" role="region" aria-label={`Disponibilidad de ${area}`} tabIndex={0}>
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Mate y construcción</th>
                          {catalogTechniques.map((technique) => (
                            <th scope="col" key={technique.id}>
                              {effective(document, "techniques", technique.id).label ?? technique.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {constructions.map(({ item, variant }) => {
                          const key = entryKey(item.id, variant.id);
                          const patch = effective(document, "textures", key);
                          const baseline = getEngravingCapabilities(item.id, variant.id);
                          const selected = patch[area] ?? baseline[area === "virola" ? "virolaEngravingTypes" : "flejeEngravingTypes"];
                          const unavailable = area === "fleje" && !variant.capabilities.hasFleje;
                          return (
                            <tr key={key}>
                              <th scope="row">
                                <strong>{effective(document, "families", item.id).label ?? item.label}</strong>
                                <small>{patch.label ?? variant.label}</small>
                              </th>
                              {catalogTechniques.map((technique) => (
                                <td key={technique.id}>
                                  {unavailable ? (
                                    <small aria-label="No lleva fleje" title="No lleva fleje">—</small>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      aria-label={`${area === "virola" ? "Virola" : "Fleje"} · ${item.label} · ${patch.label ?? variant.label} · ${effective(document, "techniques", technique.id).label ?? technique.label}`}
                                      checked={selected.includes(technique.id)}
                                      onChange={(event) =>
                                        change(
                                          "textures",
                                          key,
                                          area,
                                          event.target.checked
                                            ? [...selected, technique.id]
                                            : selected.filter((value) => value !== technique.id),
                                        )
                                      }
                                    />
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </>
      )}
      {confirmPublish && (
        <div
          className="visualizer-pricing__confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="visualizer-catalog-publish-title"
        >
          <div>
            <h3 id="visualizer-catalog-publish-title">Publicar catálogo</h3>
            <div>
              Los cambios se mostrarán a quienes abran el Visualizador después
              de publicar. Los pedidos ya realizados no se modifican.
            </div>
            <div>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmPublish(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => void publish()}
              >
                {busy ? "Publicando…" : "Confirmar publicación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
