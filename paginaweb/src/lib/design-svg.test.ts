import { describe, expect, it } from "vitest";
import { sanitizeDesignSvg } from "./design-svg";

describe("SVG persistido", () => {
  it("elimina eventos, scripts, HTML y referencias externas", () => {
    const clean = sanitizeDesignSvg('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div>HTML</div></foreignObject><path onclick="alert(1)" fill="url(&#104;ttps://example.com/a)" d="M0 0"/></svg>');
    expect(clean).not.toMatch(/onload|onclick|script|foreignObject|https:|HTML/);
    expect(clean).toContain('d="M0 0"');
  });
  it("conserva mayúsculas SVG, gradientes y referencias locales", () => {
    const clean = sanitizeDesignSvg('<svg viewBox="0 0 20 20"><defs><linearGradient id="paint" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="red"/></linearGradient></defs><path fill="url(#paint)" d="M0 0"/></svg>');
    expect(clean).toContain('viewBox="0 0 20 20"');
    expect(clean).toContain('<linearGradient');
    expect(clean).toContain('fill="url(#paint)"');
  });
  it("rechaza entidades y elimina escapes CSS", () => {
    expect(() => sanitizeDesignSvg('<!DOCTYPE svg><svg/>')).toThrow();
    expect(sanitizeDesignSvg('<svg><path fill="u\\72l(https://example.com/a)"/></svg>')).not.toContain('fill=');
  });
});
