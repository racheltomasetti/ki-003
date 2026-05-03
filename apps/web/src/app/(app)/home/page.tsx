import type { ComponentType } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getProjects, getCaptureCounts, getCaptures } from '@ki/services'
import Link from 'next/link'
import { MdKeyboardVoice } from 'react-icons/md'
import { FaPencil } from 'react-icons/fa6'
import { IoAttach } from 'react-icons/io5'
import { QuickCapture } from '@/components/QuickCapture'
import type { Project, CaptureWithEnrichment } from '@ki/types'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-4">
      <div className="text-[10px] font-medium text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.08em] mb-4">{label}</div>
      <div
        className="font-serif text-[28px] font-light leading-none text-charcoal dark:text-[#f0ede8] mb-2"
        style={valueColor ? { color: valueColor } : {}}
      >
        {value}
      </div>
    </div>
  )
}

// ─── Project card ─────────────────────────────────────────────────────────────

const MODE_COLORS: Record<string, string> = {
  building: '#9e2a2b',
  creating: '#efcb68',
  researching: '#58a4b0',
  figuring_out: '#67934d',
}

const MODE_LABELS: Record<string, string> = {
  building: 'building',
  creating: 'creating',
  researching: 'researching',
  figuring_out: 'figuring out',
}

function ProjectCard({ project }: { project: Project }) {
  const color = project.color ?? '#9e9b96'
  const mode = project.project_mode
  const modeColor = mode ? MODE_COLORS[mode] : null
  const modeLabel = mode ? MODE_LABELS[mode] : null

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-4 hover:border-charcoal/15 dark:hover:border-white/[0.13] hover:bg-charcoal/[0.05] dark:hover:bg-[#1d1b1a] transition-all"
    >
      <div className="flex items-center gap-2 mb-[6px] flex-wrap">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[14px] font-medium text-charcoal dark:text-[#f0ede8]">{project.name}</span>
        {modeLabel && modeColor && (
          <span
            className="text-[9px] font-medium px-2 py-[2px] rounded-full uppercase tracking-[0.06em]"
            style={{ background: `${modeColor}20`, color: modeColor }}
          >
            {modeLabel}
          </span>
        )}
      </div>
      {(project.description || project.what) && (
        <p className="font-serif text-[12px] font-light italic text-charcoal/50 dark:text-[#9e9b96] leading-relaxed line-clamp-2 ml-[14px]">
          {project.description ?? project.what}
        </p>
      )}
    </Link>
  )
}

// ─── Recent captures feed ─────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHrs < 24) return `${diffHrs}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SOURCE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  voice: MdKeyboardVoice,
  text: FaPencil,
  file: IoAttach,
  file_attached: IoAttach,
  manual: FaPencil,
}

function RecentCaptures({ captures }: { captures: CaptureWithEnrichment[] }) {
  if (captures.length === 0) {
    return (
      <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-8 text-center">
        <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
          No captures yet. Record a thought on mobile or use quick capture above.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden">
      {captures.map((c, i) => {
        const label = c.title ?? c.body?.slice(0, 80) ?? 'Untitled'
        const Icon = SOURCE_ICONS[c.source_type] ?? SOURCE_ICONS[c.type] ?? FaPencil
        const isDistilled = c.source_type === 'distilled'
        const summary = c.enrichments?.summary

        return (
          <div
            key={c.id}
            className={[
              'flex items-start gap-3 px-4 py-[11px]',
              i < captures.length - 1 ? 'border-b border-charcoal/5 dark:border-white/[0.05]' : '',
            ].join(' ')}
          >
            <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px] shrink-0 bg-charcoal/5 dark:bg-white/[0.05] mt-[1px]">
              {isDistilled ? '◈' : <Icon className="text-[14px]" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-charcoal dark:text-[#f0ede8] truncate leading-snug">
                {label}
              </p>
              {summary && (
                <p className="font-serif text-[11px] font-light italic text-charcoal/45 dark:text-[#5c5a57] mt-[2px] line-clamp-1">
                  {summary}
                </p>
              )}
            </div>
            <div className="text-[10px] text-charcoal/30 dark:text-[#5c5a57] shrink-0 mt-[2px]">
              {relativeTime(c.captured_at)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [
    { data: projects },
    counts,
    { data: recentRows },
  ] = await Promise.all([
    getProjects(supabase, user.id),
    getCaptureCounts(supabase, user.id),
    getCaptures(supabase, { status: 'active', limit: 8 }),
  ])

  const projectList = (projects ?? []) as Project[]
  const recentCaptures = (recentRows ?? []) as CaptureWithEnrichment[]

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="px-6 py-6 max-w-[1120px] mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard label="Total captures" value={counts.total} />
          <StatCard label="Active projects" value={projectList.length} />
          <StatCard label="Distilled thoughts" value={counts.distilled} />
        </div>

        {/* Quick capture + Projects — equal height columns on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 md:items-stretch">
          <div className="min-w-0 flex flex-col h-full min-h-0">
            <QuickCapture projects={projectList} userId={user.id} />
          </div>

          <div className="min-w-0 h-full min-h-0 flex flex-col bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 pt-4 pb-[14px]">
            <div className="mb-3 shrink-0">
              <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">
                Projects
                <span className="ml-1.5 text-charcoal/30 dark:text-[#5c5a57] font-normal normal-case tracking-normal">{projectList.length}/3</span>
              </div>
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map(i => {
                const p = projectList[i]
                if (p) return <ProjectCard key={p.id} project={p} />
                return (
                  <div
                    key={i}
                    className="rounded-[12px] border border-dashed border-charcoal/10 dark:border-white/[0.06] px-[18px] py-[14px] flex items-center justify-center min-h-[58px]"
                  >
                    {i === 0 ? (
                      <Link href="/projects/new" className="text-[12px] text-terra hover:text-[#b83333] transition-colors">
                        + create your first project
                      </Link>
                    ) : projectList.length === 0 ? (
                      <span className="text-[11px] text-charcoal/20 dark:text-[#5c5a57]">slot {i + 1}</span>
                    ) : (
                      <Link href="/projects/new" className="text-[11px] text-charcoal/25 dark:text-[#5c5a57] hover:text-terra transition-colors">
                        + add project
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent captures */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">Recent captures</div>
            <Link href="/library" className="text-[11px] text-terra hover:text-[#b83333] transition-colors">library →</Link>
          </div>
          <RecentCaptures captures={recentCaptures} />
        </div>

      </div>
    </div>
  )
}
