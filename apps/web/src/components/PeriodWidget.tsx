'use client'

// Home-page period widget. Minimal by design (see docs/active/cycle-tracker.md
// "Explicitly Not Building Now") — status + Start/End actions only. The full
// history/edit view stays in Profile → Settings (CycleTracking).

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  getActivePeriodState,
  getCurrentCycleInfo,
  startPeriod,
  endPeriod,
  ensureTodayLoggedIfActive,
} from '@ki/services'
import { resolveCyclePhase, getLocalYYYYMMDD } from '@ki/utils'
import type { Profile } from '@ki/types'

export function PeriodWidget({ profile }: { profile: Profile }) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [pendingAction, setPendingAction] = useState<'start' | 'end' | null>(null)
  const [pendingDate, setPendingDate] = useState(getLocalYYYYMMDD())
  const [busy, setBusy] = useState(false)

  const activeStateKey = ['active-period-state', profile.id]
  const cycleInfoKey = ['cycle-info', profile.id]

  const { data: activeState } = useQuery({
    queryKey: activeStateKey,
    queryFn: () => getActivePeriodState(supabase, profile.id),
    enabled: profile.cycle_type === 'menstrual',
  })
  const { data: cycleInfo } = useQuery({
    queryKey: cycleInfoKey,
    queryFn: () => getCurrentCycleInfo(supabase, profile.id),
    enabled: profile.cycle_type === 'menstrual',
  })

  // Silently keep today logged while a period is active, so mid-period
  // captures still get the correct cycle_day stamp without a daily tap.
  useEffect(() => {
    if (!activeState?.startedOn) return
    ensureTodayLoggedIfActive(supabase, profile.id).then(() => {
      queryClient.invalidateQueries({ queryKey: cycleInfoKey })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeState?.startedOn])

  if (profile.cycle_type !== 'menstrual') return null

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: activeStateKey })
    queryClient.invalidateQueries({ queryKey: cycleInfoKey })
    queryClient.invalidateQueries({ queryKey: ['period-logs', profile.id] })
    queryClient.invalidateQueries({ queryKey: ['period-instances', profile.id] })
  }

  const openAction = (action: 'start' | 'end') => {
    setPendingDate(getLocalYYYYMMDD())
    setPendingAction(action)
  }

  const confirmAction = async () => {
    setBusy(true)
    try {
      if (pendingAction === 'start') await startPeriod(supabase, profile.id, pendingDate)
      if (pendingAction === 'end') await endPeriod(supabase, profile.id, pendingDate)
      invalidate()
      setPendingAction(null)
    } finally {
      setBusy(false)
    }
  }

  const isActive = !!activeState?.startedOn
  const phaseInfo = cycleInfo?.cycleDay
    ? resolveCyclePhase(cycleInfo.cycleDay, {
        averageCycleLength: profile.average_cycle_length,
        averagePeriodLength: profile.average_period_length,
      })
    : null

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-sans text-[13px] font-medium text-charcoal dark:text-[#f0ede8] mb-[3px]">
            {isActive
              ? `Day ${activeState!.dayCount} of your period`
              : phaseInfo
                ? `Day ${cycleInfo!.cycleDay} · ${phaseInfo.label}`
                : 'No period logged yet'}
          </div>
          {isActive && (
            <div className="font-sans text-[11px] text-charcoal/40 dark:text-[#5c5a57]">
              Started {new Date(activeState!.startedOn + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
        {pendingAction === null && (
          <button
            onClick={() => openAction(isActive ? 'end' : 'start')}
            className={[
              'shrink-0 px-4 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium transition-all cursor-pointer shadow-sm',
              isActive ? 'bg-charcoal/[0.06] dark:bg-white/[0.08] text-charcoal dark:text-[#f0ede8] hover:bg-charcoal/10 dark:hover:bg-white/[0.12]' : 'bg-accent text-on-accent hover:opacity-90',
            ].join(' ')}
          >
            {isActive ? 'End Period' : 'Start Period'}
          </button>
        )}
      </div>

      {pendingAction !== null && (
        <div className="mt-3 pt-3 border-t border-charcoal/8 dark:border-white/[0.07] flex items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
              {pendingAction === 'start' ? 'Started on' : 'Ended on'}
            </span>
            <input
              type="date"
              value={pendingDate}
              max={getLocalYYYYMMDD()}
              onChange={e => setPendingDate(e.target.value)}
              className="bg-charcoal/[0.04] dark:bg-white/[0.04] border border-charcoal/8 dark:border-white/[0.07] rounded-[8px] px-2.5 py-1.5 font-sans text-[12px] text-charcoal dark:text-[#f0ede8] outline-none focus:border-accent/40"
            />
          </label>
          <button
            onClick={confirmAction}
            disabled={busy}
            className="px-3.5 py-[7px] rounded-[10px] font-sans text-[11.5px] font-medium bg-accent text-on-accent hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Confirm'}
          </button>
          <button
            onClick={() => setPendingAction(null)}
            disabled={busy}
            className="px-2 py-[7px] font-sans text-[11.5px] text-charcoal/45 dark:text-[#5c5a57] hover:text-charcoal dark:hover:text-[#f0ede8] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
