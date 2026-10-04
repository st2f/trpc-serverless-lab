import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { createApi, Theme } from "./api";

export function App({ trpc }: { trpc: ReturnType<typeof createApi>["trpc"] }) {
  const [theme, setTheme] = useState<Theme>("day");
  const quotes = useQuery(trpc.quotes.get.queryOptions({ theme }));

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-[var(--page)] text-[var(--ink)] transition-colors duration-300"
    >
      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-12 sm:py-12">
        <header className="flex flex-wrap items-center justify-between gap-6 border-b border-[var(--line)] pb-7">
          <p className="text-sm font-semibold tracking-[0.2em] uppercase">
            Day & Night <span className="text-[var(--accent)]">/</span> Quotes
          </p>
          <div
            role="group"
            aria-label="Theme"
            className="flex gap-1 rounded-full border border-[var(--line)] p-1"
          >
            {(["day", "night"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={theme === option}
                onClick={() => setTheme(option)}
                className={`rounded-full px-5 py-2 text-sm capitalize transition-colors ${theme === option ? "bg-[var(--ink)] text-[var(--page)]" : "hover:bg-[var(--card)]"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </header>

        <main className="py-12 sm:py-20">
          <p className="mb-5 text-xs tracking-[0.2em] text-[var(--muted)] uppercase">
            Three thoughts for your {theme === "day" ? "day" : "evening"}
          </p>
          <h1 className="max-w-2xl font-serif text-5xl leading-tight tracking-tight sm:text-7xl">
            {theme === "day" ? "A little perspective." : "A moment to unwind."}
          </h1>
          <p className="mt-5 max-w-lg text-[var(--muted)]">
            {theme === "day"
              ? "Take a breath. Find a thought to carry with you."
              : "Slow down. Let a few quiet thoughts settle in."}
          </p>

          <div className="mt-10 flex min-h-10 flex-wrap items-center justify-between gap-4">
            <p role="status" className="text-sm text-[var(--muted)]">
              {quotes.isFetching
                ? "Finding three thoughts…"
                : quotes.isError
                  ? "Try again when you’re ready."
                  : "A random selection, just for now."}
            </p>
            <button
              type="button"
              onClick={() => void quotes.refetch()}
              disabled={quotes.isFetching}
              className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--card)] disabled:cursor-wait disabled:opacity-50"
            >
              {quotes.isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {quotes.isError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--card)] p-5"
            >
              <p className="font-medium">We couldn’t load your quotes.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Please try Refresh in a moment.
              </p>
            </div>
          )}

          <ol
            aria-label={`${theme === "day" ? "Day" : "Night"} quotes`}
            aria-busy={quotes.isFetching}
            className="mt-5 grid gap-4 sm:grid-cols-3"
          >
            {quotes.data?.map((quote, index) => (
              <li
                key={quote.id}
                className="flex min-h-64 flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--card)] p-7 sm:min-h-80"
              >
                <span
                  aria-hidden="true"
                  className="text-xs tracking-widest text-[var(--accent)]"
                >
                  0{index + 1}
                </span>
                <blockquote className="my-8 font-serif text-2xl leading-relaxed">
                  {quote.text}
                </blockquote>
                <span
                  aria-hidden="true"
                  className="h-px w-8 bg-[var(--accent)]"
                />
              </li>
            ))}
          </ol>
        </main>
        <footer className="border-t border-[var(--line)] pt-6 text-xs text-[var(--muted)]">
          Stay curious. Make room for a pause.
        </footer>
      </div>
    </div>
  );
}
