import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { publishedPage, publishedPages } from "@/lib/content";
import { Markup, plainText } from "@/lib/markup";
import { dhakaDateTime } from "@/lib/time";

export async function generateStaticParams() {
  const pages = await publishedPages();
  return pages.length ? pages.map((p) => ({ slug: p.slug })) : [{ slug: "about" }];
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await publishedPage(slug);
  if (!p) return { robots: { index: false } };
  return { title: p.title, description: p.meta_description || plainText(p.body), alternates: { canonical: `/p/${p.slug}` } };
}

export default function ContentPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<div className="wrap auth-page wide"><p className="lead">লোড হচ্ছে...</p></div>}>
      <ContentView params={params} />
    </Suspense>
  );
}

async function ContentView({ params }: { params: PageProps<"/p/[slug]">["params"] }) {
  const { slug } = await params;
  const p = await publishedPage(slug);
  if (!p) notFound();
  return (
    <article className="wrap auth-page wide prose-page">
      <nav className="crumbs" aria-label="আপনি এখানে আছেন"><ol><li><Link href="/">হোম</Link></li><li aria-current="page">{p.title}</li></ol></nav>
      <h1>{p.title}</h1>
      <div className="prose-body"><Markup text={p.body} /></div>
      <p className="hint">শেষ হালনাগাদ: {dhakaDateTime(p.updated_at)}</p>
    </article>
  );
}
