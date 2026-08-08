import { MENSTRUAL_LABELS, type CyclePhase } from '@ki/utils'

const PHASE_ORDER: CyclePhase[] = ['rest', 'build', 'peak', 'release']

interface PhaseEnergy {
  high: number
  medium: number
  low: number
  total: number
}

/** Distribution of capture energy_level (high/medium/low) per cycle phase —
 * a stacked bar per phase, dependency-free (plain divs, no charting library). */
export function EnergyByPhase({ energyByPhase }: { energyByPhase: Record<CyclePhase, PhaseEnergy> }) {
  return (
    <div className="space-y-3">
      {PHASE_ORDER.map(phase => {
        const { high, medium, low, total } = energyByPhase[phase]
        return (
          <div key={phase} className="flex items-center gap-3">
            <div className="w-[84px] shrink-0 font-sans text-[11px] text-charcoal/55 dark:text-[#9e9b96]">
              {MENSTRUAL_LABELS[phase]}
            </div>
            <div className="flex-1 h-[10px] rounded-full overflow-hidden flex bg-charcoal/[0.05] dark:bg-white/[0.05]">
              {total > 0 && (
                <>
                  <div className="bg-terra h-full" style={{ width: `${(high / total) * 100}%` }} />
                  <div className="bg-pacific h-full" style={{ width: `${(medium / total) * 100}%` }} />
                  <div className="bg-charcoal/25 dark:bg-white/25 h-full" style={{ width: `${(low / total) * 100}%` }} />
                </>
              )}
            </div>
            <div className="w-[28px] shrink-0 text-right font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
              {total > 0 ? total : '—'}
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-4 pt-1 font-sans text-[9px] text-charcoal/40 dark:text-[#5c5a57]">
        <span className="flex items-center gap-[5px]"><span className="w-[7px] h-[7px] rounded-full bg-terra inline-block" /> High</span>
        <span className="flex items-center gap-[5px]"><span className="w-[7px] h-[7px] rounded-full bg-pacific inline-block" /> Medium</span>
        <span className="flex items-center gap-[5px]"><span className="w-[7px] h-[7px] rounded-full bg-charcoal/25 dark:bg-white/25 inline-block" /> Low</span>
      </div>
    </div>
  )
}
