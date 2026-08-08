import type { Pursuit, PursuitConnection } from '@ki/types'

// "Resonates with" — renders enrichments.pursuit_connections resolved against
// the pursuit list for name/color. No outer padding/border: callers wrap this
// in whatever section shell matches their surface (Library's detail panel and
// Explore's modal use different spacing scales).

export function PursuitConnections({
  connections,
  pursuits,
}: {
  connections: PursuitConnection[] | null | undefined
  pursuits: Pursuit[]
}) {
  if (!connections || connections.length === 0) return null

  const resolved = connections
    .map(c => ({ connection: c, pursuit: pursuits.find(p => p.id === c.pursuit_id) }))
    .filter((r): r is { connection: PursuitConnection; pursuit: Pursuit } => !!r.pursuit)

  if (resolved.length === 0) return null

  return (
    <>
      <div className="text-[9px] font-semibold text-charcoal/30 dark:text-[#5c5a57] uppercase tracking-[0.12em] mb-[6px]">
        Resonates with
      </div>
      <div className="space-y-[10px]">
        {resolved.map(({ connection, pursuit }) => (
          <div key={pursuit.id} className="flex items-start gap-2">
            <span
              className="size-[0.375rem] rounded-full shrink-0 mt-[0.3125rem]"
              style={{ backgroundColor: pursuit.color ?? '#9e2a2b' }}
            />
            <div className="min-w-0">
              <div className="font-sans text-[11px] font-medium text-charcoal dark:text-[#f0ede8]">
                {pursuit.name}
              </div>
              <p className="font-serif text-[11px] font-light italic text-charcoal/50 dark:text-[#5c5a57] leading-relaxed mt-[2px]">
                {connection.reason}
              </p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
