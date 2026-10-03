import type { MetadataRoute } from "next";
import { getGuides } from "@/lib/guides";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = getGuides();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/guides`, changeFrequency: "weekly", priority: 0.8 },
    ...guides.map((guide) => ({
      url: `${SITE_URL}/guides/${guide.slug}`,
      lastModified: guide.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
