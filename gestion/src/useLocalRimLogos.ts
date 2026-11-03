import { useEffect, useMemo, useState } from "react";
import { localRimLogos, type LocalPersonalizationDraft } from "./localPersonalization";

export function useLocalRimLogos(draft: LocalPersonalizationDraft) {
  const logos = useMemo(() => localRimLogos({ rimLogos: draft.rimLogos, rimLogoFile: draft.rimLogoFile }), [draft.rimLogos, draft.rimLogoFile]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const next = Object.fromEntries(logos.filter(logo => logo.file.type.startsWith("image/")).map(logo => [logo.id, URL.createObjectURL(logo.file)]));
    setUrls(next);
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url));
  }, [logos]);
  return { logos, urls };
}
