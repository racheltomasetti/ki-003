'use client'

import { useMemo, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createTodo, updateTodo } from '@ki/services'
import type {
  Pursuit,
  Todo,
  TodoPriority,
  TodoStatus,
  TodoUpdate,
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

const STATUS_BADGE: Record<TodoStatus, string> = {
  not_started: 'bg-terra/10 text-terra border-terra/25',
  in_progress: 'bg-pacific/10 text-pacific border-pacific/25',
  complete: 'bg-sage/10 text-sage border-sage/25',
  archived: 'bg-charcoal/5 text-charcoal/45 border-charcoal/10 dark:bg-white/[0.06] dark:text-[#9e9b96] dark:border-white/[0.1]',
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
  'w-full rounded-[10px] border border-charcoal/10 bg-charcoal/[0.035] px-3 py-2.5 font-sans text-[13px] text-charcoal outline-none transition-colors focus:border-accent/45 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#f0ede8]'

/** Fixed height so select + date inputs match across browsers. */
const metaFieldClass =
  'w-full h-10 box-border rounded-[10px] border border-charcoal/10 bg-charcoal/[0.035] px-3 font-sans text-[13px] leading-none text-charcoal outline-none transition-colors focus:border-accent/45 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-[#f0ede8]'

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
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
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

  const applyTodoUpdate = (updated: Todo) => {
    setTodos(current => current.map(item => item.id === updated.id ? updated : item))
    setSelectedTodo(current => current?.id === updated.id ? updated : current)
  }

  const handleStatusCycle = async (todo: Todo) => {
    if (todo.status === 'archived') return
    const nextStatus: TodoStatus =
      todo.status === 'not_started'
        ? 'in_progress'
        : todo.status === 'in_progress'
          ? 'complete'
          : 'not_started'
    setUpdatingTodoId(todo.id)
    setError(null)
    try {
      const updated = await updateTodo(supabase, userId, todo.id, { status: nextStatus })
      applyTodoUpdate(updated)
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
            <p className="mb-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
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
            className="rounded-full bg-accent px-4 py-2.5 font-sans text-[12px] font-medium text-on-accent transition-opacity hover:opacity-90"
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
                  <th className="w-12 px-4 py-3" aria-label="Complete" />
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
                  const isComplete = todo.status === 'complete'
                  return (
                    <tr
                      key={todo.id}
                      onClick={() => setSelectedTodo(todo)}
                      className="cursor-pointer border-b border-charcoal/[0.06] last:border-0 transition-colors hover:bg-charcoal/[0.03] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-4 align-middle">
                        <button
                          type="button"
                          disabled={updatingTodoId === todo.id || todo.status === 'archived'}
                          aria-label={
                            todo.status === 'complete'
                              ? `Mark ${todo.title} not started`
                              : todo.status === 'in_progress'
                                ? `Mark ${todo.title} complete`
                                : `Mark ${todo.title} in progress`
                          }
                          aria-checked={todo.status === 'complete' ? true : todo.status === 'in_progress' ? 'mixed' : false}
                          role="checkbox"
                          onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation()
                            void handleStatusCycle(todo)
                          }}
                          className={[
                            'relative flex size-4 items-center justify-center rounded-[4px] border-2 transition-colors',
                            'disabled:cursor-not-allowed disabled:opacity-40',
                            todo.status === 'complete'
                              ? 'border-accent bg-accent text-on-accent'
                              : todo.status === 'in_progress'
                                ? 'border-accent bg-transparent'
                                : 'border-charcoal/25 bg-transparent dark:border-white/25',
                          ].join(' ')}
                        >
                          {todo.status === 'complete' && (
                            <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden>
                              <path
                                d="M2.5 6.2L4.8 8.5L9.5 3.5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="max-w-[420px] px-4 py-4 align-middle">
                        <div className={[
                          'font-serif text-[14px] font-light text-charcoal dark:text-[#f0ede8]',
                          isComplete ? 'line-through opacity-45' : '',
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
                      <td className="px-4 py-4 align-middle">
                        <span className={[
                          'inline-flex items-center rounded-full border px-2.5 py-[3px]',
                          'font-sans text-[10px] font-medium leading-none',
                          STATUS_BADGE[todo.status],
                        ].join(' ')}>
                          {STATUS_LABELS[todo.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center gap-2 font-sans text-[11px] leading-none text-charcoal/55 dark:text-[#9e9b96]">
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
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center font-sans text-[11px] leading-none text-charcoal/50 dark:text-[#77736f]">
                          {todo.due_date ? displayDate(todo.due_date) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        {pursuit ? (
                          <span className="inline-flex max-w-[190px] items-center gap-1.5 font-sans text-[11px] leading-none text-charcoal/55 dark:text-[#9e9b96]">
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: pursuit.color ?? 'var(--color-terra)' }}
                            />
                            <span className="truncate">{pursuit.name}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center font-sans text-[11px] leading-none text-charcoal/25 dark:text-[#5c5a57]">—</span>
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
                    className="mt-3 font-sans text-[11px] text-accent hover:underline"
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

      {selectedTodo && (
        <EditTodoModal
          todo={selectedTodo}
          pursuits={pursuits}
          onClose={() => setSelectedTodo(null)}
          onSaved={applyTodoUpdate}
          save={input => updateTodo(supabase, userId, selectedTodo.id, input)}
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
          active ? 'text-accent' : 'text-charcoal/35 hover:text-charcoal/60 dark:text-[#5c5a57] dark:hover:text-[#9e9b96]',
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
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">New todo</p>
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

        <TodoFormFields
          idPrefix="new"
          title={title}
          notes={notes}
          status={status}
          priority={priority}
          dueDate={dueDate}
          pursuitId={pursuitId}
          pursuits={pursuits}
          includeArchivedStatus={false}
          onTitleChange={setTitle}
          onNotesChange={setNotes}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onDueDateChange={setDueDate}
          onPursuitIdChange={setPursuitId}
        />

        {error && <p className="px-5 pb-2 font-sans text-[11px] text-terra">{error}</p>}

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
            className="rounded-full bg-accent px-5 py-2 font-sans text-[11px] font-medium text-on-accent transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Create todo'}
          </button>
        </div>
      </form>
    </div>
  )
}

function EditTodoModal({
  todo,
  pursuits,
  save,
  onSaved,
  onClose,
}: {
  todo: Todo
  pursuits: Pursuit[]
  save: (input: TodoUpdate) => Promise<Todo>
  onSaved: (todo: Todo) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(todo.title)
  const [notes, setNotes] = useState(todo.notes ?? '')
  const [status, setStatus] = useState<TodoStatus>(todo.status)
  const [priority, setPriority] = useState<TodoPriority>(todo.priority)
  const [dueDate, setDueDate] = useState(todo.due_date ?? '')
  const [pursuitId, setPursuitId] = useState(todo.pursuit_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildUpdate = (): TodoUpdate => ({
    title,
    notes: notes || null,
    status,
    priority,
    due_date: dueDate || null,
    pursuit_id: pursuitId || null,
  })

  const isDirty =
    title.trim() !== todo.title
    || (notes || null) !== (todo.notes ?? null)
    || status !== todo.status
    || priority !== todo.priority
    || (dueDate || null) !== (todo.due_date ?? null)
    || (pursuitId || null) !== (todo.pursuit_id ?? null)

  const persist = async (nextStatus?: TodoStatus) => {
    if (!title.trim() || saving) return false
    setSaving(true)
    setError(null)
    try {
      const updated = await save({
        ...buildUpdate(),
        ...(nextStatus ? { status: nextStatus } : {}),
      })
      onSaved(updated)
      return true
    } catch (saveError) {
      setError(todoErrorMessage(saveError))
      setSaving(false)
      return false
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isDirty) {
      onClose()
      return
    }
    const ok = await persist()
    if (ok) onClose()
  }

  const handleDismiss = async () => {
    if (!isDirty) {
      onClose()
      return
    }
    if (!title.trim()) {
      onClose()
      return
    }
    const ok = await persist()
    if (ok) onClose()
  }

  const handleArchive = async () => {
    if (todo.status === 'archived' && !isDirty) {
      onClose()
      return
    }
    const ok = await persist('archived')
    if (ok) onClose()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return
    const target = event.target as HTMLElement
    if (target.tagName === 'TEXTAREA') return
    event.preventDefault()
    void handleDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={event => {
        if (event.target === event.currentTarget) void handleDismiss()
      }}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-[18px] border border-charcoal/10 bg-cream shadow-2xl dark:border-white/[0.09] dark:bg-[#161514]"
      >
        <div className="flex items-center justify-between border-b border-charcoal/8 px-5 py-4 dark:border-white/[0.07]">
          <div>
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Todo</p>
            <p className="mt-0.5 font-serif text-[12px] font-light text-charcoal/45 dark:text-[#77736f]">
              Edit this action
            </p>
          </div>
          <button
            type="button"
            onClick={() => void handleDismiss()}
            aria-label="Close"
            className="h-7 w-7 rounded-full font-sans text-charcoal/40 transition-colors hover:bg-charcoal/5 hover:text-charcoal dark:text-[#77736f] dark:hover:bg-white/5"
          >
            ×
          </button>
        </div>

        <TodoFormFields
          idPrefix="edit"
          title={title}
          notes={notes}
          status={status}
          priority={priority}
          dueDate={dueDate}
          pursuitId={pursuitId}
          pursuits={pursuits}
          includeArchivedStatus
          onTitleChange={setTitle}
          onNotesChange={setNotes}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onDueDateChange={setDueDate}
          onPursuitIdChange={setPursuitId}
        />

        {error && <p className="px-5 pb-2 font-sans text-[11px] text-terra">{error}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-charcoal/8 px-5 py-4 dark:border-white/[0.07]">
          <button
            type="button"
            onClick={() => void handleArchive()}
            disabled={saving || status === 'archived'}
            className="rounded-full border border-charcoal/15 px-4 py-2 font-sans text-[11px] text-charcoal/55 transition-colors hover:border-charcoal/25 hover:bg-charcoal/5 hover:text-charcoal disabled:opacity-40 dark:border-white/[0.12] dark:text-[#9e9b96] dark:hover:border-white/[0.2] dark:hover:bg-white/5 dark:hover:text-[#f0ede8]"
          >
            Archive
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleDismiss()}
              className="rounded-full border border-charcoal/15 px-4 py-2 font-sans text-[11px] text-charcoal/55 transition-colors hover:border-charcoal/25 hover:bg-charcoal/5 hover:text-charcoal dark:border-white/[0.12] dark:text-[#9e9b96] dark:hover:border-white/[0.2] dark:hover:bg-white/5 dark:hover:text-[#f0ede8]"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="rounded-full bg-accent px-5 py-2 font-sans text-[11px] font-medium text-on-accent transition-opacity disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function TodoFormFields({
  idPrefix,
  title,
  notes,
  status,
  priority,
  dueDate,
  pursuitId,
  pursuits,
  includeArchivedStatus,
  onTitleChange,
  onNotesChange,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onPursuitIdChange,
}: {
  idPrefix: string
  title: string
  notes: string
  status: TodoStatus
  priority: TodoPriority
  dueDate: string
  pursuitId: string
  pursuits: Pursuit[]
  includeArchivedStatus: boolean
  onTitleChange: (value: string) => void
  onNotesChange: (value: string) => void
  onStatusChange: (value: TodoStatus) => void
  onPriorityChange: (value: TodoPriority) => void
  onDueDateChange: (value: string) => void
  onPursuitIdChange: (value: string) => void
}) {
  const titleId = `${idPrefix}-todo-title`
  const notesId = `${idPrefix}-todo-notes`
  const statusId = `${idPrefix}-todo-status`
  const priorityId = `${idPrefix}-todo-priority`
  const dueDateId = `${idPrefix}-todo-due-date`
  const pursuitIdField = `${idPrefix}-todo-pursuit`

  const statusOptions = Object.entries(STATUS_LABELS).filter(([value]) =>
    includeArchivedStatus || value !== 'archived'
  )

  return (
    <div className="space-y-4 px-5 py-5">
      <div>
        <label htmlFor={titleId} className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 dark:text-[#77736f]">
          Todo
        </label>
        <input
          id={titleId}
          autoFocus
          required
          value={title}
          onChange={event => onTitleChange(event.target.value)}
          placeholder="Make the next action clear"
          className={`${fieldClass} font-serif text-[15px]`}
        />
      </div>

      <div>
        <label htmlFor={notesId} className="mb-1.5 block font-sans text-[10px] font-semibold uppercase tracking-widest text-charcoal/40 dark:text-[#77736f]">
          Notes <span className="font-normal normal-case tracking-normal opacity-60">optional</span>
        </label>
        <textarea
          id={notesId}
          value={notes}
          onChange={event => onNotesChange(event.target.value)}
          rows={4}
          placeholder="Context, links, or thinking that belongs with this action"
          className={`${fieldClass} resize-none font-serif font-light leading-relaxed`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TodoField label="Status" htmlFor={statusId}>
          <select id={statusId} value={status} onChange={event => onStatusChange(event.target.value as TodoStatus)} className={metaFieldClass}>
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </TodoField>

        <TodoField label="Priority" htmlFor={priorityId}>
          <select id={priorityId} value={priority} onChange={event => onPriorityChange(event.target.value as TodoPriority)} className={metaFieldClass}>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </TodoField>

        <TodoField label="Due date" htmlFor={dueDateId} optional>
          <input id={dueDateId} type="date" value={dueDate} onChange={event => onDueDateChange(event.target.value)} className={metaFieldClass} />
        </TodoField>

        <TodoField label="Pursuit" htmlFor={pursuitIdField} optional>
          <select id={pursuitIdField} value={pursuitId} onChange={event => onPursuitIdChange(event.target.value)} className={metaFieldClass}>
            <option value="">No pursuit</option>
            {pursuits.map(pursuit => (
              <option key={pursuit.id} value={pursuit.id}>{pursuit.name}</option>
            ))}
          </select>
        </TodoField>
      </div>
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
