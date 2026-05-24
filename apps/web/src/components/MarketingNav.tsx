import Link from 'next/link'

export default function MarketingNav() {
  return (
    <nav className="w-full flex items-center justify-between px-6 py-5 max-w-4xl mx-auto">
      <Link href="/" className="font-serif text-2xl font-bold text-charcoal dark:text-cream hover:opacity-80 transition-opacity">
        Ki
      </Link>

      <div className="flex items-center gap-6">
        <Link
          href="/docs"
          className="font-sans text-sm text-charcoal/60 dark:text-cream/60 hover:text-charcoal dark:hover:text-cream transition-colors"
        >
          Docs
        </Link>
        <Link
          href="/sign-in"
          className="font-sans text-sm text-charcoal/60 dark:text-cream/60 hover:text-charcoal dark:hover:text-cream transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/sign-up"
          className="font-sans text-sm font-semibold bg-terra text-cream px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Get started
        </Link>
      </div>
    </nav>
  )
}
