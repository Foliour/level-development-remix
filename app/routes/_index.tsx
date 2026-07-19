import type { MetaFunction } from "@remix-run/cloudflare";

export const meta: MetaFunction = () => {
  return [
    { title: "Level Development | AI Development Enablement" },
    {
      name: "description",
      content:
        "We help engineering, product, and design teams become agentic-first. Consulting, speaking, and hands-on builds.",
    },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Level Development</span>
        <a
          href="mailto:info@leveldevelopment.org"
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Get in touch
        </a>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 md:pt-32">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
          Your team can ship with AI.
          <br />
          We'll show you how.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Level helps engineering, product, and design organizations adopt
          agentic workflows, not as a side experiment, but as the way work gets
          done. We bring hands-on experience transforming how teams build
          software with AI.
        </p>
      </section>

      {/* Services */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            What we do
          </h2>
          <div className="mt-10 grid gap-12 md:grid-cols-3">
            <div>
              <h3 className="text-xl font-semibold">Org Enablement</h3>
              <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
                We work with your engineering, product, and design leaders to
                build an agentic-first culture, from tooling and workflows to
                team structure and rituals. Not a workshop you forget. A lasting
                shift in how your org operates.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold">Speaking & Workshops</h3>
              <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
                Talks and hands-on sessions for teams and conferences on what
                agentic engineering actually looks like in practice: the
                patterns that work, the ones that don't, and how to get your
                people excited rather than anxious.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold">Hands-On Builds</h3>
              <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
                Need something built, fixed, or made production-ready? We do
                small app builds, codebase refreshes, and take vibe-coded
                prototypes to real, shippable products.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Our approach
          </h2>
          <div className="mt-10 max-w-3xl space-y-6 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
            <p>
              We don't sell AI hype. We've been building this way, shipping real
              products with agentic tools, and we teach from that experience.
            </p>
            <p>
              The shift to agentic engineering isn't about replacing people. It's
              about giving your existing team leverage they didn't have before:
              faster iteration, higher quality, more ambitious scope with the
              same headcount.
            </p>
            <p>
              Every engagement is tailored to where your org actually is today,
              not where a generic playbook assumes you should be.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Let's talk about what's possible.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-600 dark:text-gray-400">
            Whether you're exploring agentic workflows for the first time or
            ready to go all-in, we'd love to hear what you're working on.
          </p>
          <a
            href="mailto:info@leveldevelopment.org"
            className="mt-8 inline-block rounded-full bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            info@leveldevelopment.org
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-gray-500 dark:text-gray-500">
          &copy; {new Date().getFullYear()} Level Development
        </div>
      </footer>
    </div>
  );
}
