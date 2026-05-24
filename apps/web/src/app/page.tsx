import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarketingNav from '@/components/MarketingNav'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/library')

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0f0e0e] flex flex-col">
      <MarketingNav />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center max-w-4xl mx-auto w-full">
        <p className="font-sans text-xs uppercase tracking-widest text-charcoal/40 dark:text-cream/40 mb-6">
          A thinking tool
        </p>

        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl font-bold text-charcoal dark:text-cream leading-tight mb-6">
          A living extension<br />of your mind.
        </h1>

        <p className="font-sans text-base sm:text-lg text-charcoal/60 dark:text-cream/60 max-w-xl leading-relaxed mb-10">
          Ki is the space where your raw, unfinished thinking becomes something
          you can actually work with — where captures accumulate into clarity,
          and clarity becomes action.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/sign-up"
            className="font-sans font-semibold text-sm bg-terra text-cream px-7 py-3.5 rounded-xl hover:opacity-90 active:opacity-80 transition-opacity"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/sign-in"
            className="font-sans text-sm text-charcoal/60 dark:text-cream/60 border border-charcoal/15 dark:border-cream/15 px-7 py-3.5 rounded-xl hover:border-charcoal/30 dark:hover:border-cream/30 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </main>

      {/* What Ki is built around */}
      <section className="border-t border-charcoal/8 dark:border-cream/8 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl font-bold text-charcoal dark:text-cream mb-12 text-center">
            How Ki works
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-pacific mb-3">Pursuits</p>
              <p className="font-serif text-lg font-bold text-charcoal dark:text-cream mb-2">
                Three at a time.
              </p>
              <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed">
                Carry up to three active pursuits — the questions and intentions
                that are most alive for you right now. Constraints create focus.
                Focus creates depth.
              </p>
            </div>

            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-pacific mb-3">Captures</p>
              <p className="font-serif text-lg font-bold text-charcoal dark:text-cream mb-2">
                Catch it as it lands.
              </p>
              <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed">
                A thought mid-walk, a quote that hit different, an observation
                that felt important. Ki holds it, enriches it, and connects it
                to what you are already carrying.
              </p>
            </div>

            <div>
              <p className="font-sans text-xs uppercase tracking-widest text-pacific mb-3">Clarity</p>
              <p className="font-serif text-lg font-bold text-charcoal dark:text-cream mb-2">
                Patterns surface over time.
              </p>
              <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 leading-relaxed">
                As your corpus deepens, Ki reflects back what is emerging —
                patterns, tensions, threads of clarity — so you can act,
                create, and decide.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quote / pull */}
      <section className="px-6 py-20 bg-charcoal dark:bg-cream/5">
        <div className="max-w-2xl mx-auto text-center">
          <blockquote className="font-serif text-2xl sm:text-3xl text-cream dark:text-cream font-bold leading-snug mb-6">
            &ldquo;It is not a note-taking app. It is not a journal. It is the
            space where your raw thinking becomes something you can work with.&rdquo;
          </blockquote>
          <Link
            href="/docs"
            className="font-sans text-sm text-cream/60 hover:text-cream transition-colors underline underline-offset-4"
          >
            Learn more about Ki →
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-md mx-auto">
          <h2 className="font-serif text-3xl font-bold text-charcoal dark:text-cream mb-4">
            Ready to think deeper?
          </h2>
          <p className="font-sans text-sm text-charcoal/60 dark:text-cream/60 mb-8">
            Ki is in early access. Create your account and start building your corpus today.
          </p>
          <Link
            href="/sign-up"
            className="inline-block font-sans font-semibold text-sm bg-terra text-cream px-8 py-3.5 rounded-xl hover:opacity-90 active:opacity-80 transition-opacity"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-charcoal/8 dark:border-cream/8 px-6 py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-serif text-lg font-bold text-charcoal dark:text-cream">Ki</span>
          <div className="flex gap-6">
            <Link href="/docs" className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors">
              Docs
            </Link>
            <Link href="/sign-in" className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors">
              Sign in
            </Link>
            <Link href="/sign-up" className="font-sans text-xs text-charcoal/40 dark:text-cream/40 hover:text-charcoal dark:hover:text-cream transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
