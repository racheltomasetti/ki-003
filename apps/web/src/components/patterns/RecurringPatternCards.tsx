import { MENSTRUAL_LABELS, type CyclePhase } from '@ki/utils'
import { PHASE_STYLES } from '@/lib/enrichmentStyles'

interface PatternCardItem {
  phase: CyclePhase
  label: string
  count: number
}

const PHASE_ORDER: CyclePhase[] = ['rest', 'build', 'peak', 'release']

/** Recurring themes/moods (or daily-log emotions/body signals), grouped by
 * phase and sorted by frequency — the "you've captured this 3 times, always
 * this phase" moment, made explicit instead of requiring a chat prompt. */
export function RecurringPatternCards({
  items,
  emptyMessage,
}: {
  items: PatternCardItem[]
  emptyMessage: string
}) {
  if (items.length === 0) {
    return (
      <p className="font-serif text-[12px] font-light italic text-charcoal/40 dark:text-[#5c5a57]">
        {emptyMessage}
      </p>
    )
  }

  const byPhase = new Map<CyclePhase, PatternCardItem[]>()
  for (const item of items) {
    const list = byPhase.get(item.phase) ?? []
    list.push(item)
    byPhase.set(item.phase, list)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PHASE_ORDER.filter(phase => byPhase.has(phase)).map(phase => (
        <div
          key={phase}
          className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[12px] p-4"
        >
          <div className={`inline-block font-sans text-[9px] px-[8px] py-[3px] rounded-full border mb-3 ${PHASE_STYLES[phase]}`}>
            {MENSTRUAL_LABELS[phase]}
          </div>
          <ul className="space-y-2">
            {byPhase.get(phase)!.map(item => (
              <li key={item.label} className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[13px] font-light text-charcoal/75 dark:text-[#d8d5cf] capitalize">
                  {item.label}
                </span>
                <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57] shrink-0">
                  {item.count}×
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
