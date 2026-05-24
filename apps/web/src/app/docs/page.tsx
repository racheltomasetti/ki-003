import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'

export const metadata = {
  title: 'Docs — Ki',
  description: 'Learn what Ki is and how to use it.',
}

function Section({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <section className="py-10 border-b border-charcoal/8 dark:border-cream/8 last:border-none">
      <p className="font-sans text-xs uppercase tracking-widest text-pacific mb-2">{label}</p>
      <h2 className="font-serif text-2xl font-bold text-charcoal dark:text-cream mb-4">{title}</h2>
      <div className="font-sans text-sm text-charcoal/70 dark:text-cream/70 leading-relaxed space-y-3 max-w-2xl">
        {children}
      </div>
    </section>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-[#0f0e0e] flex flex-col">
      <MarketingNav />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        {/* Header */}
        <div className="mb-14">
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-charcoal dark:text-cream mb-4">
            What is Ki?
          </h1>
          <p className="font-sans text-base text-charcoal/60 dark:text-cream/60 leading-relaxed max-w-xl">
            Ki is a thinking tool — the space where your raw, unfinished thinking
            becomes something you can actually work with. Not a note-taking app.
            Not a journal. A system for thinking out loud and then thinking deeper.
          </p>
        </div>

        <Section label="Philosophy" title="Building your Self and building systems are the same act.">
          <p>
            What you feed your mind shapes who you become. What you feed a system shapes what it produces.
            Ki is built on this parallel — not as metaphor, but as methodology.
          </p>
          <p>
            Ki exists for anyone intentionally creating something in their life — whether that&apos;s
            software, a business, a creative practice, or a better understanding of who they are becoming.
            The builder and the person becoming are the same person.
          </p>
        </Section>

        <Section label="Core concept" title="Pursuits — what you are carrying.">
          <p>
            The central entity in Ki is a <strong className="text-charcoal dark:text-cream font-semibold">pursuit</strong>.
            A pursuit is not a project with a deadline. It is something you are carrying — a question
            you are living, a thing you are building, a direction you are moving in.
          </p>
          <p>
            At its center is a <strong className="text-charcoal dark:text-cream font-semibold">core question</strong>:
            the guiding light that gives the pursuit its meaning and makes new information relevant or not.
            For example: <em>&ldquo;What does it look like to build software that is deeply alive?&rdquo;</em>
          </p>
          <p>
            You carry a maximum of <strong className="text-charcoal dark:text-cream font-semibold">three active pursuits</strong> at
            any time. This is intentional. Three is enough to hold the complexity of a life in motion —
            not so many that attention fragments and nothing receives what it deserves.
            Constraints create focus. Focus creates depth.
          </p>
          <p>
            The broader landscape of what you are curious about but not yet fully carrying lives as
            <strong className="text-charcoal dark:text-cream font-semibold"> curiosities</strong> — the antechamber.
            Some will crystallize into pursuits when a slot opens and the question becomes live enough to carry.
          </p>
        </Section>

        <Section label="Captures" title="Catch it as it lands.">
          <p>
            Inspiration does not wait. A thought mid-walk, a quote that hit different, an observation
            that felt important — these are <strong className="text-charcoal dark:text-cream font-semibold">captures</strong>.
          </p>
          <p>
            Ki holds each capture, enriches it with context, and connects it to the pursuits you are
            actively carrying. Over time, your corpus deepens. What felt scattered starts to cohere.
          </p>
          <p>
            Captures are available across mobile and web. Mobile exists for convenience — capture
            anywhere. The web is the primary thinking environment: where you return to do the deeper work
            of distilling, connecting, and arriving at clarity.
          </p>
        </Section>

        <Section label="Library" title="Everything you have ever captured.">
          <p>
            Your library is the full record of what you have brought into Ki. Every capture, across
            all pursuits. Searchable, filterable, always there.
          </p>
          <p>
            The library is not an archive — it is a living resource. New pursuits can reach back
            into everything you have already captured and find connections you did not see at the time.
            The past reorganizes around the present.
          </p>
        </Section>

        <Section label="Explore" title="Patterns surface over time.">
          <p>
            As your corpus deepens, Ki reflects back what is emerging — patterns, tensions, threads of
            clarity that run across your captures and pursuits.
          </p>
          <p>
            Explore is where you go to think with your corpus, not just look at it. Surface what is
            recurring. Ask Ki what it is noticing. Let the accumulation of your thinking become
            something you can think with.
          </p>
        </Section>

        <Section label="Canvas" title="A space to think inside a pursuit.">
          <p>
            Every active pursuit has a canvas — an infinite whiteboard where you can think visually,
            map ideas, connect captures, and work through the complexity of what you are carrying.
          </p>
          <p>
            The canvas is pursuit-scoped. It belongs to the question you are living.
          </p>
        </Section>

        {/* Getting started */}
        <section className="py-10">
          <p className="font-sans text-xs uppercase tracking-widest text-pacific mb-2">Getting started</p>
          <h2 className="font-serif text-2xl font-bold text-charcoal dark:text-cream mb-8">
            Your first steps in Ki.
          </h2>

          <ol className="space-y-6">
            {[
              {
                step: '01',
                title: 'Create your account',
                body: 'Sign up with your email. Ki is in early access — you will be using it as it is being built.',
              },
              {
                step: '02',
                title: 'Define your first pursuit',
                body: 'What question are you living right now? Start there. Name your pursuit and write its core question — the guiding light that makes new information relevant or not.',
              },
              {
                step: '03',
                title: 'Start capturing',
                body: 'Use Quick Capture on the home page or the mobile app to log thoughts as they arise. Do not overthink it. Ki holds the raw material. You come back to it.',
              },
              {
                step: '04',
                title: 'Return and deepen',
                body: 'Ki is not a daily habit you have to maintain — it rewards return. Come back when something is stirring. Look at what has accumulated. Let the patterns speak.',
              },
            ].map(({ step, title, body }) => (
              <li key={step} className="flex gap-6">
                <span className="font-serif text-2xl font-bold text-charcoal/20 dark:text-cream/20 w-8 shrink-0 mt-0.5">
                  {step}
                </span>
                <div>
                  <p className="font-sans font-semibold text-sm text-charcoal dark:text-cream mb-1">{title}</p>
                  <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <div className="pt-8 pb-4 flex flex-col sm:flex-row items-start gap-4">
          <Link
            href="/sign-up"
            className="font-sans font-semibold text-sm bg-terra text-cream px-7 py-3.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Create your account
          </Link>
          <Link
            href="/sign-in"
            className="font-sans text-sm text-charcoal/60 dark:text-cream/60 border border-charcoal/15 dark:border-cream/15 px-7 py-3.5 rounded-xl hover:border-charcoal/30 dark:hover:border-cream/30 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-charcoal/8 dark:border-cream/8 px-6 py-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-serif text-lg font-bold text-charcoal dark:text-cream">Ki</Link>
          <div className="flex gap-6">
            <Link href="/" className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors">
              Home
            </Link>
            <Link href="/sign-in" className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
