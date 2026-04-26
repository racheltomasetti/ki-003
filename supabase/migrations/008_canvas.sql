-- Ki — canvas schema
--
-- Three tables back the canvas workspace:
--
--   canvas_nodes        — every shape/card on a project's canvas.
--                         Content fields are all nullable — any combination
--                         is valid. type controls the visual container only.
--
--   canvas_edges        — connections between nodes (arrows, lines).
--
--   canvas_conversations — the persistent chat history between the user and
--                          Ki in the canvas sidebar. Gives the agent memory
--                          across sessions.

-- ─── canvas_nodes ─────────────────────────────────────────────────────────────

create table public.canvas_nodes (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id)  on delete cascade,
  user_id     uuid        not null references public.profiles(id)  on delete cascade,

  -- tldraw shape ID — stable across sessions
  node_id     text        not null,

  -- Visual container type: box | circle | diamond | text | sticky
  -- Free text — no check constraint so new types can be added without migrations
  type        text        not null,

  -- Content — all nullable, any combination valid
  title       text,                    -- optional heading
  body        text,                    -- optional body / longer text
  url         text,                    -- optional attached link
  url_title   text,                    -- human-readable label for the link
  media_paths text[],                  -- optional attached images / files (upload UI later)

  -- Layout
  position_x  float       not null,
  position_y  float       not null,
  width       float,
  height      float,

  -- Visual style overrides (color, font size, etc.) stored as freeform JSON
  style       jsonb,

  -- Provenance
  created_by  text        not null default 'user'
              check (created_by in ('user', 'agent')),

  -- Phantom flow: pending = agent proposal, accepted = permanent, rejected = transient before delete
  status      text        not null default 'accepted'
              check (status in ('pending', 'accepted', 'rejected')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (project_id, node_id)
);

-- ─── canvas_edges ─────────────────────────────────────────────────────────────

create table public.canvas_edges (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id)  on delete cascade,
  user_id     uuid        not null references public.profiles(id)  on delete cascade,

  edge_id     text        not null,
  source_id   text        not null,   -- node_id of the source node
  target_id   text        not null,   -- node_id of the target node
  label       text,                   -- optional edge label

  style       jsonb,

  created_by  text        not null default 'user'
              check (created_by in ('user', 'agent')),

  status      text        not null default 'accepted'
              check (status in ('pending', 'accepted', 'rejected')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (project_id, edge_id)
);

-- ─── canvas_conversations ─────────────────────────────────────────────────────

create table public.canvas_conversations (
  id          uuid        primary key default gen_random_uuid(),
  project_id  uuid        not null references public.projects(id)  on delete cascade,
  user_id     uuid        not null references public.profiles(id)  on delete cascade,

  role        text        not null check (role in ('user', 'assistant')),
  content     text        not null,

  created_at  timestamptz not null default now()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.canvas_nodes          enable row level security;
alter table public.canvas_edges          enable row level security;
alter table public.canvas_conversations  enable row level security;

create policy "Users manage their own canvas nodes"
  on public.canvas_nodes for all
  using (auth.uid() = user_id);

create policy "Users manage their own canvas edges"
  on public.canvas_edges for all
  using (auth.uid() = user_id);

create policy "Users manage their own canvas conversations"
  on public.canvas_conversations for all
  using (auth.uid() = user_id);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

create trigger set_canvas_nodes_updated_at
  before update on public.canvas_nodes
  for each row execute procedure public.handle_updated_at();

create trigger set_canvas_edges_updated_at
  before update on public.canvas_edges
  for each row execute procedure public.handle_updated_at();
