import type * as React from "react";

/**
 * The one layout every task-like detail page uses (tasks, AfrikaBurn deadlines): it reads like a
 * page, not a form. Title and status first, then the description, the facts grouped in a list,
 * the content sections, and the editing tools in a narrower column on the right (below on a phone).
 */
export function DetailLayout({
  back,
  title,
  badges,
  facts,
  description,
  children,
  aside,
}: {
  back?: React.ReactNode;
  title: string;
  badges?: React.ReactNode;
  facts: [label: string, value: React.ReactNode][];
  description?: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <article className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          {back ? <div className="text-sm">{back}</div> : null}
          <h1 className="heading text-xl leading-tight">{title}</h1>
          {badges ? <div className="flex flex-wrap gap-2">{badges}</div> : null}
        </header>
        {description ? (
          <div className="max-w-prose whitespace-pre-wrap text-base leading-relaxed">
            {description}
          </div>
        ) : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border bg-card p-4 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0">{value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </article>
      {aside ? <aside className="flex min-w-0 flex-col gap-4">{aside}</aside> : null}
    </div>
  );
}

/** A titled block on a detail page. `boxed` puts it in a card (used for comments and tools). */
export function DetailSection({
  title,
  boxed = false,
  children,
}: {
  title: React.ReactNode;
  boxed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`flex flex-col gap-3 ${boxed ? "rounded-2xl border bg-card p-4" : ""}`}>
      <h2 className="heading text-sm">{title}</h2>
      {children}
    </section>
  );
}
