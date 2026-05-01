import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@ki/services'
import type { Project } from '@ki/types'

function NewProjectButton() {
  return (
    <Link
      href="/projects/new"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-terra text-cream font-sans text-sm font-semibold hover:bg-terra/90 transition-colors"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      New project
    </Link>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const color = project.color ?? '#58a4b0'

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block p-5 rounded-xl border border-charcoal/10 dark:border-cream/10 hover:border-charcoal/20 dark:hover:border-cream/20 hover:shadow-sm transition-all bg-cream dark:bg-charcoal"
    >
      {/* Color dot + name */}
      <div className="flex items-center gap-3 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="font-serif text-base font-bold text-charcoal dark:text-cream leading-snug group-hover:text-terra transition-colors line-clamp-1">
          {project.name}
        </h3>
      </div>

      {/* Description */}
      {project.description && (
        <p className="font-sans text-sm text-charcoal/55 dark:text-cream/55 leading-relaxed line-clamp-2 ml-[1.375rem]">
          {project.description}
        </p>
      )}
    </Link>
  )
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: projects } = await getProjects(supabase, user.id)

  return (
    <div className="max-w-3xl mx-auto py-10 px-6">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-charcoal dark:text-cream mb-1">projects</h1>
        </div>
        <NewProjectButton />
      </div>

      {(!projects || projects.length === 0) && (
        <div className="font-sans text-sm text-charcoal/40 dark:text-cream/40 py-12 text-center">
          No projects yet.
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project as Project} />
          ))}
        </div>
      )}
    </div>
  )
}
