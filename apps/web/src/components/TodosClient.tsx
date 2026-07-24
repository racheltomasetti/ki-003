'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createTodo, updateTodo } from '@ki/services'
import type {
  Pursuit,
  Todo,
  TodoPriority,
  TodoStatus,
} from '@ki/types'

interface TodosClientProps {
  userId: string
  initialTodos: Todo[]
  pursuits: Pursuit[]
}

type StatusFilter = 'active' | TodoStatus
type PriorityFilter = 'all' | TodoPriority
type DueDateFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'none'
type SortKey = 'title' | 'status' | 'priority' | 'due_date' | 'pursuit'
type SortDirection = 'asc' | 'desc'

const STATUS_LABELS: Record<TodoStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete',
  archived: 'Archived',
}

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const STATUS_ORDER: Record<TodoStatus, number> = {
  in_progress: 0,
  not_started: 1,
  complete: 2,
  archived: 3,
}

const PRIORITY_ORDER: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const fieldClass =
  'w-full rounded-[10px] border border-charcoal/10 bg-charcoal/[0.035] px-3 py-2.5 font-sans text-[13px] text-charcoal outline-none transition-colors focus:border-terra/45 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#f0ede8]'

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function todayDateKey(): string {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function todoErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function TodosClient({ userId, initialTodos, pursuits }: TodosClientProps) {
  const supabase = createClient()
  const [todos, setTodos] = useState(initialTodos)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('all')
  const [pursuitFilter, setPursuitFilter] = useState('all')
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pursuitById = useMemo(
    () => new Map(pursuits.map(pursuit => [pursuit.id, pursuit])),
    [pursuits]
  )

  const visibleTodos = useMemo(() => {
    const today = todayDateKey()
    const filtered = todos.filter(todo => {
      const matchesStatus = statusFilter === 'active'
        ? todo.status !== 'archived'
        : todo.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || todo.priority === priorityFilter
      const matchesDueDate = dueDateFilter === 'all'
        || (dueDateFilter === 'none' && todo.due_date === null)
        || (dueDateFilter === 'today' && todo.due_date === today)
        || (dueDateFilter === 'upcoming' && todo.due_date !== null && todo.due_date > today)
        || (
          dueDateFilter === 'overdue'
          && todo.due_date !== null
          && todo.due_date < today
          && todo.status !== 'complete'
          && todo.status !== 'archived'
        )
      const matchesPursuit = pursuitFilter === 'all'
        || (pursuitFilter === 'none'
          ? todo.pursuit_id === null
          : todo.pursuit_id === pursuitFilter)
      return matchesStatus && matchesPriority && matchesDueDate && matchesPursuit
    })

    return [...filtered].sort((a, b) => {
      if (sortKey === 'due_date') {
        if (a.due_date === null && b.due_date === null) return 0
        if (a.due_date === null) return 1
        if (b.due_date === null) return -1
      }

      let comparison = 0
      if (sortKey === 'title') comparison = a.title.localeCompare(b.title)
      if (sortKey === 'status') comparison = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (sortKey === 'priority') comparison = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (sortKey === 'due_date') comparison = (a.due_date ?? '').localeCompare(b.due_date ?? '')
      if (sortKey === 'pursuit') {
        const aName = a.pursuit_id ? pursuitById.get(a.pursuit_id)?.name ?? '' : ''
        const bName = b.pursuit_id ? pursuitById.get(b.pursuit_id)?.name ?? '' : ''
        comparison = aName.localeCompare(bName)
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [
    dueDateFilter,
    priorityFilter,
    pursuitById,
    pursuitFilter,
    sortDirection,
    sortKey,
    statusFilter,
    todos,
  ])

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const handleStatusChange = async (todo: Todo, status: TodoStatus) => {
    setUpdatingTodoId(todo.id)
    setError(null)
    try {
      const updated = await updateTodo(supabase, userId, todo.id, { status })
      setTodos(current => current.map(item => item.id === updated.id ? updated : item))
    } catch (statusError) {
      setError(todoErrorMessage(statusError))
    } finally {
      setUpdatingTodoId(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="shrink-0 border-b border-charcoal/8 px-8 py-6 dark:border-white/[0.07]">
        <div className="mx-auto flex max-w-[1180px] items-end justify-between gap-6">
          <div>
            <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-terra">
              Thinking into action
            </p>
            <h1 className="font-serif text-[28px] font-light text-charcoal dark:text-[#f0ede8]">
              Todos
            </h1>
            <p className="mt-1 font-serif text-[13px] font-light text-charcoal/45 dark:text-[#77736f]">
              The next actions that move what you are carrying forward.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-full bg-terra px-4 py-2.5 font-sans text-[12px] font-medium text-cream transition-opacity hover:opacity-90"
          >
            + New todo
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="todo-status-filter">Filter by status</label>
            <select
              id="todo-status-filter"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-full border border-charcoal/10 bg-transparent px-3 py-2 font-sans text-[11px] text-charcoal/65 outline-none dark:border-white/[0.09] dark:text-[#9e9b96]"
            >
              <option value="active">All active</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="todo-priority-filter">Filter by priority</label>
            <select
              id="todo-priority-filter"
              value={priorityFilter}
              onChange={event => setPriorityFilter(event.target.value as PriorityFilter)}
              className="rounded-full border border-charcoal/10 bg-transparent px-3 py-2 font-sans text-[11px] text-charcoal/65 outline-none dark:border-white/[0.09] dark:text-[#9e9b96]"
            >
              <option value="all">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="todo-due-date-filter">Filter by due date</label>
            <select
              id="todo-due-date-filter"
              value={dueDateFilter}
              onChange={event => setDueDateFilter(event.target.value as DueDateFilter)}
              className="rounded-full border border-charcoal/10 bg-transparent px-3 py-2 font-sans text-[11px] text-charcoal/65 outline-none dark:border-white/[0.09] dark:text-[#9e9b96]"
            >
              <option value="all">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming</option>
              <option value="none">No due date</option>
            </select>

            <label className="sr-only" htmlFor="todo-pursuit-filter">Filter by pursuit</label>
            <select
              id="todo-pursuit-filter"
              value={pursuitFilter}
              onChange={event => setPursuitFilter(event.target.value)}
              className="max-w-[220px] rounded-full border border-charcoal/10 bg-transparent px-3 py-2 font-sans text-[11px] text-charcoal/65 outline-none dark:border-white/[0.09] dark:text-[#9e9b96]"
            >
              <option value="all">All pursuits</option>
              <option value="none">No pursuit</option>
              {pursuits.map(pursuit => (
                <option key={pursuit.id} value={pursuit.id}>{pursuit.name}</option>
              ))}
            </select>

            <span className="ml-auto font-sans text-[10px] text-charcoal/35 dark:text-[#5c5a57]">
              {visibleTodos.length} todo{visibleTodos.length === 1 ? '' : 's'}
            </span>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between rounded-[10px] border border-terra/25 bg-terra/[0.05] px-3 py-2 font-sans text-[11px] text-terra">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button>
            </div>
          )}

          <div className="overflow-x-auto rounded-[14px] border border-charcoal/8 bg-charcoal/[0.02] dark:border-white/[0.07] dark:bg-[#161514]">
            <table className="w-full min-w-[780px] border-collapse">
              <thead>
                <tr className="border-b border-charcoal/8 dark:border-white/[0.07]">
                  <TodoHeading label="Todo" column="title" current={sortKey} direction={sortDirection} onSort={setSort} />
                  <TodoHeading label="Status" column="status" current={sortKey} direction={sortDirection} onSort={setSort} />
                  <TodoHeading label="Priority" column="priority" current={sortKey} direction={sortDirection} onSort={setSort} />
                  <TodoHeading label="Due" column="due_date" current={sortKey} direction={sortDirection} onSort={setSort} />
                  <TodoHeading label="Pursuit" column="pursuit" current={sortKey} direction={sortDirection} onSort={setSort} />
                </tr>
              </thead>
              <tbody>
                {visibleTodos.map(todo => {
                  const pursuit = todo.pursuit_id ? pursuitById.get(todo.pursuit_id) : null
                  return (
                    <tr
                      key={todo.id}
                      className="border-b border-charcoal/[0.06] last:border-0 dark:border-white/[0.05]"
                    >
                      <td className="max-w-[420px] px-4 py-4 align-top">
                        <div className={[
                          'font-serif text-[14px] font-light text-charcoal dark:text-[#f0ede8]',
                          todo.status === 'complete' ? 'line-through opacity-45' : '',
                        ].join(' ')}>
                          {todo.title}
                        </div>
                        {todo.notes && (
                          <p className="mt-1 line-clamp-2 font-serif text-[11px] font-light leading-relaxed text-charcoal/40 dark:text-[#77736f]">
                            {todo.notes}
                          </p>
                        )}
                        {todo.source === 'agent' && (
                          <span className="mt-1.5 inline-block font-sans text-[9px] uppercase tracking-wider text-pacific">
                            From Ki
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <select
                          aria-label={`Status for ${todo.title}`}
                          value={todo.status}
                          disabled={updatingTodoId === todo.id}
                          onChange={event => handleStatusChange(todo, event.target.value as TodoStatus)}
                          className="w-[122px] rounded-full border border-charcoal/10 bg-transparent px-2.5 py-1.5 font-sans text-[10px] text-charcoal/60 outline-none disabled:opacity-50 dark:border-white/[0.09] dark:text-[#9e9b96]"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span className="inline-flex items-center gap-2 font-sans text-[11px] text-charcoal/55 dark:text-[#9e9b96]">
                          <span className={[
                            'h-1.5 w-1.5 rounded-full',
                            todo.priority === 'high'
                              ? 'bg-terra'
                              : todo.priority === 'medium'
                                ? 'bg-pacific'
                                : 'bg-charcoal/25 dark:bg-white/25',
                          ].join(' ')} />
                          {PRIORITY_LABELS[todo.priority]}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top font-sans text-[11px] text-charcoal/50 dark:text-[#77736f]">
                        {todo.due_date ? displayDate(todo.due_date) : '—'}
                      </td>
                      <td className="px-4 py-4 align-top">
                        {pursuit ? (
                          <span className="inline-flex max-w-[190px] items-center gap-1.5 font-sans text-[11px] text-charcoal/55 dark:text-[#9e9b96]">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: pursuit.color ?? 'var(--color-terra)' }}
                            />
                            <span className="truncate">{pursuit.name}</span>
                          </span>
                        ) : (
                          <span className="font-sans text-[11px] text-charcoal/25 dark:text-[#5c5a57]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {visibleTodos.length === 0 && (
              <div className="px-6 py-16 text-center">
                <p className="font-serif text-[15px] font-light text-charcoal/50 dark:text-[#77736f]">
                  {todos.length === 0 ? 'Nothing is asking for action yet.' : 'No todos match these filters.'}
                </p>
                {todos.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="mt-3 font-sans text-[11px] text-terra hover:underline"
                  >
                    Create the first todo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateTodoModal
          pursuits={pursuits}
          onClose={() => setShowCreate(false)}
          onCreated={todo => {
            setTodos(current => [todo, ...current])
            setShowCreate(false)
          }}
          create={input => createTodo(supabase, userId, input)}
        />
      )}
    </div>
  )
}

function TodoHeading({
  label,
  column,
  current,
  direction,
  onSort,
}: {
  label: string
  column: SortKey
  current: SortKey
  direction: SortDirection
  onSort: (column: SortKey) => void
}) {
  const active = current === column
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          'font-sans text-[9px] font-semibold uppercase tracking-[0.12em] transition-colors',
          active ? 'text-terra' : 'text-charcoal/35 hover:text-charcoal/60 dark:text-[#5c5a57] dark:hover:text-[#9e9b96]',
        ].join(' ')}
      >
        {label} <span aria-hidden>{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  )
}

function CreateTodoModal({
  pursuits,
  create,
  onCreated,
  onClose,
}: {
  pursuits: Pursuit[]
  create: (input: {
    title: string
    notes: string | null
    status: TodoStatus
    priority: TodoPriority
    due_date: string | null
    pursuit_id: string | null
    source: 'manual'
  }) => Promise<Todo>
  onCreated: (todo: Todo) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TodoStatus>('not_started')
  const [priority, setPriority] = useState<TodoPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [pursuitId, setPursuitId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const todo = await create({
        title,
        notes: notes || null,
        status,
        priority,
        due_date: dueDate || null,
        pursuit_id: pursuitId || null,
        source: 'manual',
      })
      onCreated(todo)
    } catch (createError) {
      setError(todoErrorMessage(createError))
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-[18px] border border-charcoal/10 bg-cream shadow-2xl dark:border-white/[0.09] dark:bg-[#161514]"
      >
        <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4 dark:border-white/[0.07]">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-terra">New todo</p>
            <p className="mt-0.5 font-serif text-[12px] font-light text-charcoal/45 dark:text-[#77736f]">
              What needs to happen next?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-7 w-7 rounded-full font-sans text-charcoal/40 transition-colors hover:bg-charcoal/5 hover:text-charcoal dark:text-[#77736f] dark:hover:bg-white/5"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label htmlFor="todo-title" className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 dark:text-[#77736f]">
              Todo
            </label>
            <input
              id="todo-title"
              autoFocus
              required
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Make the next action clear"
              className={`${fieldClass} font-serif text-[15px]`}
            />
          </div>

          <div>
            <label htmlFor="todo-notes" className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 dark:text-[#77736f]">
              Notes <span className="font-normal normal-case tracking-normal opacity-60">optional</span>
            </label>
            <textarea
              id="todo-notes"
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={4}
              placeholder="Context, links, or thinking that belongs with this action"
              className={`${fieldClass} resize-none font-serif font-light leading-relaxed`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TodoField label="Status" htmlFor="new-todo-status">
              <select id="new-todo-status" value={status} onChange={event => setStatus(event.target.value as TodoStatus)} className={fieldClass}>
                {Object.entries(STATUS_LABELS).filter(([value]) => value !== 'archived').map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </TodoField>

            <TodoField label="Priority" htmlFor="new-todo-priority">
              <select id="new-todo-priority" value={priority} onChange={event => setPriority(event.target.value as TodoPriority)} className={fieldClass}>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </TodoField>

            <TodoField label="Due date" htmlFor="new-todo-due-date" optional>
              <input id="new-todo-due-date" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className={fieldClass} />
            </TodoField>

            <TodoField label="Pursuit" htmlFor="new-todo-pursuit" optional>
              <select id="new-todo-pursuit" value={pursuitId} onChange={event => setPursuitId(event.target.value)} className={fieldClass}>
                <option value="">No pursuit</option>
                {pursuits.map(pursuit => (
                  <option key={pursuit.id} value={pursuit.id}>{pursuit.name}</option>
                ))}
              </select>
            </TodoField>
          </div>

          {error && <p className="font-sans text-[11px] text-terra">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-charcoal/8 px-5 py-4 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 font-sans text-[11px] text-charcoal/50 transition-colors hover:bg-charcoal/5 dark:text-[#77736f] dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || saving}
            className="rounded-full bg-terra px-5 py-2 font-sans text-[11px] font-medium text-cream transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Create todo'}
          </button>
        </div>
      </form>
    </div>
  )
}

function TodoField({
  label,
  htmlFor,
  optional = false,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 dark:text-[#77736f]">
        {label}
        {optional && <span className="ml-1 font-normal normal-case tracking-normal opacity-60">optional</span>}
      </label>
      {children}
    </div>
  )
}
