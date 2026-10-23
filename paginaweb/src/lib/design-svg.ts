import sanitizeHtml from "sanitize-html";

/** The returned bytes, never the submitted source, are the trusted upload. */
export function sanitizeDesignSvg(source: string): string {
  if (!/^\s*<svg[\s>]/i.test(source) || /<!\s*(?:doctype|entity)\b/i.test(source)) {
    throw new Error("El SVG contiene contenido no permitido.");
  }
  const clean = sanitizeHtml(source, {
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    allowedTags: ["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "title", "desc", "text", "tspan"],
    allowedAttributes: { "*": ["id", "transform", "fill", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "viewBox", "points", "offset", "stop-color", "stop-opacity", "clip-path", "clipPathUnits", "mask", "maskUnits", "xmlns", "preserveAspectRatio", "gradientUnits", "gradientTransform", "font-size", "font-family", "text-anchor"] },
    allowedSchemes: [],
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "foreignObject", "iframe", "object", "embed"],
    transformTags: {
      "*": (tagName, attribs) => {
        for (const [name, value] of Object.entries(attribs)) {
          // No CSS escapes or remote paint servers, including entity-encoded URLs.
          if (/[\\\u0000-\u001f]/.test(value) || (/url\s*\(/i.test(value) && !/^url\(\s*['"]?#[a-zA-Z0-9_-]+['"]?\s*\)$/.test(value))) delete attribs[name];
        }
        return { tagName, attribs };
      },
    },
  });
  if (!clean.startsWith("<svg") && !/^\s*<svg[\s>]/.test(clean)) throw new Error("El SVG quedó vacío después de sanitizarlo.");
  return clean;
}
