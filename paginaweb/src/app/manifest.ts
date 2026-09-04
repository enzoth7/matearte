import type { MetadataRoute } from "next";
import { buildManifestFile } from "@/lib/seo-files";

export default function manifest(): MetadataRoute.Manifest {
  return buildManifestFile();
}
