import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@ki/services'
import Link from 'next/link'
import type { Project } from '@ki/types'

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: string
  sub: string
  valueColor?: string
}) {
  return (
    <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-4">
      <div className="text-[10px] font-medium text-charcoal/40 dark:text-[#5c5a57] uppercase tracking-[0.08em] mb-2">{label}</div>
      <div
        className="font-serif text-[28px] font-light leading-none text-charcoal dark:text-[#f0ede8]"
        style={valueColor ? { color: valueColor } : {}}
      >
        {value}
      </div>
      <div className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] mt-[5px]">{sub}</div>
    </div>
  )
}

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
          {project.description ?? `"${project.what}"`}
        </p>
      )}
    </Link>
  )
}

const STREAK_DAYS = Array.from({ length: 14 }, (_, i) => i < 13)

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: projects } = await getProjects(supabase, user.id)
  const projectList = (projects ?? []) as Project[]

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="px-6 py-6 max-w-[900px] mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          <StatCard label="Total captures" value="—" sub="loading..." />
          <StatCard label="Capture streak" value="0" sub="days" valueColor="#9e2a2b" />
          <StatCard label="Active projects" value={String(projectList.length)} sub="in progress" />
          <StatCard label="Enriched" value="—" sub="loading..." valueColor="#efcb68" />
        </div>

        {/* Quick capture */}
        <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-5 py-[18px] mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-medium text-charcoal/55 dark:text-[#9e9b96]">Quick capture</div>
            <div className="flex items-center gap-[6px] text-[11px] text-charcoal/35 dark:text-[#5c5a57] px-[10px] py-1 border border-charcoal/8 dark:border-white/[0.07] rounded-full bg-charcoal/[0.03] dark:bg-[#1d1b1a] cursor-pointer select-none">
              <span className="w-[6px] h-[6px] rounded-full bg-terra" />
              no project
              <span className="text-[9px]">▾</span>
            </div>
          </div>
          <textarea
            className="w-full bg-charcoal/5 dark:bg-[#1d1b1a] border border-charcoal/8 dark:border-white/[0.07] rounded-[10px] px-[14px] py-3 text-[13px] text-charcoal dark:text-[#f0ede8] font-serif font-light resize-none min-h-[70px] leading-relaxed outline-none focus:border-charcoal/20 dark:focus:border-white/[0.13] transition-colors placeholder:text-charcoal/30 dark:placeholder:text-[#5c5a57] placeholder:italic"
            placeholder="What's on your mind..."
          />
          <div className="flex items-center justify-between mt-[10px]">
            <div className="flex gap-1">
              {['✎ text', '🎙 voice', '📎 file'].map((label, i) => (
                <button
                  key={label}
                  className={[
                    'px-3 py-1 rounded-full text-[11px] border cursor-pointer transition-all',
                    i === 0
                      ? 'border-terra text-terra bg-terra/10'
                      : 'border-charcoal/8 dark:border-white/[0.07] text-charcoal/35 dark:text-[#5c5a57] bg-transparent hover:border-charcoal/15 dark:hover:border-white/[0.13] hover:text-charcoal/60 dark:hover:text-[#9e9b96]',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="px-3 py-[4px] text-[12px] font-medium rounded-[10px] bg-terra text-white cursor-pointer hover:bg-[#b83333] transition-colors">
              capture
            </button>
          </div>
        </div>

        {/* Projects + recent activity */}
        <div className="grid grid-cols-[1fr_300px] gap-4 mb-4">

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">Projects</div>
              <Link href="/projects" className="text-[11px] text-terra">view all →</Link>
            </div>
            <div className="space-y-2">
              {projectList.slice(0, 3).map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
              {projectList.length === 0 && (
                <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-8 text-center">
                  <p className="font-serif text-[13px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">No projects yet.</p>
                  <Link href="/projects/new" className="inline-block mt-3 text-[12px] text-terra hover:text-[#b83333] transition-colors">
                    + create your first project
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">Recent activity</div>
              <Link href="/library" className="text-[11px] text-terra">library →</Link>
            </div>
            <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-[11px]">
                <div className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[12px] shrink-0 bg-pacific/10">
                  ▤
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] text-charcoal/55 dark:text-[#9e9b96]">Your captures appear here</div>
                  <div className="text-[10px] text-charcoal/35 dark:text-[#5c5a57] mt-[1px]">as you build your corpus</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Themes + streak */}
        <div className="grid grid-cols-2 gap-4">

          <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">Recurring themes</div>
              <Link href="/explore" className="text-[11px] text-terra">explore →</Link>
            </div>
            <p className="font-serif text-[12px] font-light italic text-charcoal/35 dark:text-[#5c5a57]">
              Themes appear as your corpus grows.
            </p>
          </div>

          <div className="bg-charcoal/[0.03] dark:bg-[#161514] border border-charcoal/8 dark:border-white/[0.07] rounded-[14px] px-[18px] py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-medium text-charcoal/55 dark:text-[#9e9b96] uppercase tracking-[0.07em]">Capture streak</div>
              <div className="font-serif text-[24px] font-light text-terra">0</div>
            </div>
            <div className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] mb-2">consecutive days</div>
            <div className="flex gap-1 flex-wrap">
              {STREAK_DAYS.map((active, i) => (
                <div
                  key={i}
                  className={[
                    'w-[22px] h-[22px] rounded-[5px]',
                    active
                      ? 'bg-terra border border-terra'
                      : 'bg-transparent border border-charcoal/8 dark:border-white/[0.07]',
                  ].join(' ')}
                />
              ))}
            </div>
            <div className="text-[11px] text-charcoal/35 dark:text-[#5c5a57] mt-[9px]">capture today to keep the streak</div>
          </div>

        </div>

      </div>
    </div>
  )
}
