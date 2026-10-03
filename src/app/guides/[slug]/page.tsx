import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuides } from "@/lib/guides";
import { ORG, SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuides().find((entry) => entry.slug === slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      publishedTime: guide.date,
    },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

const prose =
  "grid gap-4 text-[15px] leading-7 text-muted-foreground " +
  "[&_h2]:mt-8 [&_h2]:font-[family-name:var(--font-fraunces)] [&_h2]:text-2xl [&_h2]:text-foreground " +
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-foreground " +
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 " +
  "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:p-4 [&_pre]:text-xs " +
  "[&_code]:font-mono [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 " +
  "[&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:p-2";

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuides().find((entry) => entry.slug === slug);
  if (!guide) notFound();
  const url = `${SITE_URL}/guides/${guide.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.title,
      description: guide.description,
      datePublished: guide.date,
      dateModified: guide.date,
      inLanguage: "en",
      mainEntityOfPage: url,
      author: ORG,
      publisher: ORG,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Offhand", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
        { "@type": "ListItem", position: 3, name: guide.title, item: url },
      ],
    },
    ...(guide.faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: guide.faq.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          },
        ]
      : []),
  ];
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-12">
      <nav className="text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Offhand
        </Link>{" "}
        /{" "}
        <Link href="/guides" className="underline-offset-4 hover:underline">
          Guides
        </Link>
      </nav>
      <article className="grid gap-4">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl leading-tight tracking-tight">{guide.title}</h1>
        <p className="text-sm text-muted-foreground">Published {guide.date} · Nytto Labs</p>
        <div className={prose} dangerouslySetInnerHTML={{ __html: guide.html }} />
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
