import { useEffect, useMemo, useState } from "react";
import { localFlejeLogos, type LocalPersonalizationDraft } from "./localPersonalization";

export function useLocalFlejeLogos(draft: LocalPersonalizationDraft) {
  const logos = useMemo(() => localFlejeLogos(draft), [draft.flejeLogos, draft.flejeLogoFile, draft.flejeLogoSides, draft.designTransforms?.["fleje-upload"]?.side]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const next = Object.fromEntries(logos.filter(logo => logo.file.type.startsWith("image/")).map(logo => [logo.id, URL.createObjectURL(logo.file)]));
    setUrls(next);
    return () => Object.values(next).forEach(url => URL.revokeObjectURL(url));
  }, [logos]);
  return { logos, urls };
}
