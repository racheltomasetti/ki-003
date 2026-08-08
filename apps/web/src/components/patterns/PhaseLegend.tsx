import type { PhaseRange } from '@ki/utils'
import { PHASE_STYLES } from '@/lib/enrichmentStyles'

/** The 4 phase bands for the user's average cycle length, as color chips. */
export function PhaseLegend({ phaseBands }: { phaseBands: PhaseRange[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {phaseBands.map(band => (
        <div
          key={band.phase}
          className={`flex items-center gap-[6px] font-sans text-[10px] px-[10px] py-[5px] rounded-full border whitespace-nowrap ${PHASE_STYLES[band.phase]}`}
        >
          <span className="font-medium">{band.label}</span>
          <span className="opacity-60">Day {band.startDay}–{band.endDay}</span>
        </div>
      ))}
    </div>
  )
}
