import type { MetadataRoute } from "next";
import { buildRobotsFile } from "@/lib/seo-files";

export default function robots(): MetadataRoute.Robots {
  return buildRobotsFile();
}
