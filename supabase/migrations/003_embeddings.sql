-- ─── Ki — pgvector embeddings ────────────────────────────────────────────────
-- text-embedding-3-small produces 1536-dimensional vectors.
-- Used for RAG retrieval in Chat with Ki.

create extension if not exists vector;

alter table public.enrichments
  add column embedding vector(1536);

-- HNSW index for approximate nearest-neighbor search.
--
-- HNSW (Hierarchical Navigable Small World) builds a layered graph where each
-- embedding connects to its nearest neighbors across multiple levels. Search
-- traverses this graph top-down — literally navigating a network of related
-- thoughts. This is the right structure for Ki: works from row 1, consistent
-- O(log n) query performance at any corpus size, no retuning required.
--
-- Parameters:
--   m = 16              connections per node per layer. Higher = better recall + more memory.
--                       16 is the standard sweet spot.
--   ef_construction = 64  candidate list size during index build. Higher = better recall
--                       quality at build time, slower build. 64 is the standard default.
--
-- Query-time tuning (set per session if needed):
--   SET hnsw.ef_search = 100;  -- default 40. raise for better recall on large corpora.
--
-- Future scale: HNSW scales cleanly. No migration needed as corpus grows.
-- If memory becomes a concern at very large scale, revisit m (lower = less memory).
create index enrichments_embedding_idx
  on public.enrichments
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
