import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@ki/services'
import type { Project } from '@ki/types'

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

      {/* Brief indicator */}
      {project.brief && (
        <p className="font-sans text-xs text-sage mt-3 ml-[1.375rem]">Brief ready</p>
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
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-charcoal dark:text-cream mb-1">Projects</h1>
        <p className="font-sans text-sm text-charcoal/45 dark:text-cream/45">
          Your thinking, organized.
        </p>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="font-sans text-sm text-charcoal/40 dark:text-cream/40 py-12 text-center">
          No projects yet. Create one from the mobile app.
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
