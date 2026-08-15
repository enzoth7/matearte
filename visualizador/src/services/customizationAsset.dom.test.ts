// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { sanitizeSvgMarkup } from "./customizationAsset";

describe("sanitización de SVG", () => {
  it("elimina scripts, eventos y recursos externos", () => {
    const unsafe = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <script>alert('xss')</script>
        <foreignObject><div>HTML</div></foreignObject>
        <image href="https://example.com/tracker.png" onload="alert(1)" />
        <path d="M0 0h20v20z" fill="url(https://example.com/pattern.svg#x)" onclick="alert(1)" />
      </svg>`;

    const safe = sanitizeSvgMarkup(unsafe);
    expect(safe).not.toContain("script");
    expect(safe).not.toContain("foreignObject");
    expect(safe).not.toContain("onload");
    expect(safe).not.toContain("onclick");
    expect(safe).not.toContain("https://");
    expect(safe).toContain("<path");
  });

  it("rechaza contenido que no sea un SVG válido", () => {
    expect(() => sanitizeSvgMarkup("<html><body>No es un SVG</body></html>")).toThrow(/SVG/);
  });
});

