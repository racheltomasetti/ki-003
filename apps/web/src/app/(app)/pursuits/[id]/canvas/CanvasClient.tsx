'use client'

import { useRef, useCallback } from 'react'
import {
  Tldraw,
  Editor,
  TLShape,
  TLGeoShape,
  TLArrowShape,
  TLShapeId,
  TLRichText,
  TLGeoShapeGeoStyle,
  getArrowBindings,
  renderPlaintextFromRichText,
  toRichText,
} from 'tldraw'
import 'tldraw/tldraw.css'
import Link from 'next/link'
import { LuArrowLeft } from 'react-icons/lu'
import { createClient } from '@/lib/supabase/client'
import {
  upsertCanvasNode,
  upsertCanvasEdge,
  deleteCanvasNode,
  deleteCanvasEdge,
  deleteEdgesForNode,
} from '@ki/services'
import type { CanvasNode, CanvasEdge, CanvasNodeInsert, CanvasEdgeInsert } from '@ki/types'

// ─── Type mapping helpers ──────────────────────────────────────────────────────

function getNodeType(shape: TLShape): string | null {
  if (shape.type === 'text') return 'text'
  if (shape.type === 'note') return 'sticky'
  if (shape.type === 'geo') {
    const geo = (shape as TLGeoShape).props.geo
    if (geo === 'ellipse') return 'circle'
    if (geo === 'diamond') return 'diamond'
    return 'box'
  }
  return null
}

function extractText(editor: Editor, shape: TLShape): string {
  const richText = (shape.props as Record<string, unknown>).richText as TLRichText | undefined
  if (!richText) return ''
  return renderPlaintextFromRichText(editor, richText)
}

function shapeToNodeInsert(
  editor: Editor,
  shape: TLShape,
  projectId: string,
  userId: string,
): CanvasNodeInsert | null {
  const nodeType = getNodeType(shape)
  if (!nodeType) return null

  const props = shape.props as Record<string, unknown>
  const meta = (shape.meta ?? {}) as Record<string, unknown>

  return {
    project_id: projectId,
    user_id: userId,
    node_id: shape.id,
    type: nodeType,
    title: (meta.ki_title as string | null) ?? null,
    body: extractText(editor, shape) || null,
    url: (meta.ki_url as string | null) ?? null,
    url_title: (meta.ki_url_title as string | null) ?? null,
    media_paths: null,
    position_x: shape.x,
    position_y: shape.y,
    width: typeof props.w === 'number' ? props.w : null,
    height: typeof props.h === 'number' ? props.h : null,
    style: null,
    created_by: 'user',
    status: 'accepted',
  }
}

function arrowToEdgeInsert(
  editor: Editor,
  shape: TLArrowShape,
  projectId: string,
  userId: string,
): CanvasEdgeInsert | null {
  const bindings = getArrowBindings(editor, shape)
  if (!bindings.start?.toId || !bindings.end?.toId) return null

  const meta = (shape.meta ?? {}) as Record<string, unknown>

  return {
    project_id: projectId,
    user_id: userId,
    edge_id: shape.id,
    source_id: bindings.start.toId,
    target_id: bindings.end.toId,
    label: (meta.ki_label as string | null) ?? null,
    style: null,
    created_by: 'user',
    status: 'accepted',
  }
}

// ─── DB → tldraw hydration ────────────────────────────────────────────────────

function hydrateCanvas(
  editor: Editor,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
) {
  if (nodes.length === 0 && edges.length === 0) return

  editor.run(() => {
    // Create node shapes
    const nodeShapes = nodes
      .map((node) => {
        const id = node.node_id as TLShapeId
        const richText = toRichText(node.body ?? '')

        switch (node.type) {
          case 'box':
          case 'circle':
          case 'diamond': {
            const geoMap: Record<string, TLGeoShapeGeoStyle> = {
              box: 'rectangle',
              circle: 'ellipse',
              diamond: 'diamond',
            }
            return {
              id,
              type: 'geo' as const,
              x: node.position_x,
              y: node.position_y,
              props: {
                geo: geoMap[node.type] ?? ('rectangle' as TLGeoShapeGeoStyle),
                w: node.width ?? 200,
                h: node.height ?? 120,
                richText: richText as TLRichText,
              },
              meta: {
                ki_title: node.title,
                ki_url: node.url,
                ki_url_title: node.url_title,
              },
            }
          }
          case 'text':
            return {
              id,
              type: 'text' as const,
              x: node.position_x,
              y: node.position_y,
              props: { richText: richText as TLRichText },
              meta: {
                ki_title: node.title,
                ki_url: node.url,
                ki_url_title: node.url_title,
              },
            }
          case 'sticky':
            return {
              id,
              type: 'note' as const,
              x: node.position_x,
              y: node.position_y,
              props: { richText: richText as TLRichText },
              meta: {
                ki_title: node.title,
                ki_url: node.url,
                ki_url_title: node.url_title,
              },
            }
          default:
            // Unknown type — fall back to box
            return {
              id,
              type: 'geo' as const,
              x: node.position_x,
              y: node.position_y,
              props: { geo: 'rectangle' as TLGeoShapeGeoStyle, w: node.width ?? 200, h: node.height ?? 120, richText: richText as TLRichText },
              meta: {},
            }
        }
      })

    editor.createShapes(nodeShapes)

    // Create arrow shapes + bindings
    for (const edge of edges) {
      const arrowId = edge.edge_id as TLShapeId
      const sourceId = edge.source_id as TLShapeId
      const targetId = edge.target_id as TLShapeId

      // Only create the arrow if both endpoint shapes exist
      if (!editor.getShape(sourceId) || !editor.getShape(targetId)) continue

      editor.createShape({
        id: arrowId,
        type: 'arrow',
        x: 0,
        y: 0,
        props: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
        meta: { ki_label: edge.label },
      })

      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: sourceId,
        props: {
          terminal: 'start',
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false,
          snap: 'none',
        },
      })

      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: targetId,
        props: {
          terminal: 'end',
          normalizedAnchor: { x: 0.5, y: 0.5 },
          isExact: false,
          isPrecise: false,
          snap: 'none',
        },
      })
    }
  }, { history: 'ignore' })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  userId: string
  projectName: string
  initialNodes: CanvasNode[]
  initialEdges: CanvasEdge[]
}

export function CanvasClient({
  projectId,
  userId,
  projectName,
  initialNodes,
  initialEdges,
}: Props) {
  const supabase = createClient()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedNodeIds = useRef<Set<string>>(new Set(initialNodes.map((n) => n.node_id)))
  const savedEdgeIds = useRef<Set<string>>(new Set(initialEdges.map((e) => e.edge_id)))
  const isHydrating = useRef(false)

  const syncToDb = useCallback(
    (editor: Editor) => {
      const shapes = editor.getCurrentPageShapes()
      const currentNodeIds = new Set<string>()
      const currentEdgeIds = new Set<string>()

      const nodeUpserts: Promise<unknown>[] = []
      const edgeUpserts: Promise<unknown>[] = []

      for (const shape of shapes) {
        if (shape.type === 'arrow') {
          const edgeInsert = arrowToEdgeInsert(editor, shape as TLArrowShape, projectId, userId)
          if (edgeInsert) {
            currentEdgeIds.add(shape.id)
            edgeUpserts.push(upsertCanvasEdge(supabase, edgeInsert))
          }
        } else {
          const nodeInsert = shapeToNodeInsert(editor, shape, projectId, userId)
          if (nodeInsert) {
            currentNodeIds.add(shape.id)
            nodeUpserts.push(upsertCanvasNode(supabase, nodeInsert))
          }
        }
      }

      // Delete nodes that were removed
      const deletedNodeIds = [...savedNodeIds.current].filter((id) => !currentNodeIds.has(id))
      const nodeDeletes = deletedNodeIds.flatMap((nodeId) => [
        deleteEdgesForNode(supabase, projectId, nodeId),
        deleteCanvasNode(supabase, projectId, nodeId),
      ])

      // Delete edges that were removed
      const deletedEdgeIds = [...savedEdgeIds.current].filter((id) => !currentEdgeIds.has(id))
      const edgeDeletes = deletedEdgeIds.map((edgeId) =>
        deleteCanvasEdge(supabase, projectId, edgeId),
      )

      void Promise.all([...nodeUpserts, ...edgeUpserts, ...nodeDeletes, ...edgeDeletes])

      savedNodeIds.current = currentNodeIds
      savedEdgeIds.current = currentEdgeIds
    },
    [projectId, userId, supabase],
  )

  const handleMount = useCallback(
    (editor: Editor) => {
      // Hydrate canvas from DB data
      isHydrating.current = true
      hydrateCanvas(editor, initialNodes, initialEdges)
      isHydrating.current = false

      // Listen for changes and sync to DB with debounce
      editor.store.listen(
        () => {
          if (isHydrating.current) return
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => syncToDb(editor), 500)
        },
        { source: 'user', scope: 'document' },
      )
    },
    [initialNodes, initialEdges, syncToDb],
  )

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Floating back button */}
      <div className="absolute top-4 left-4 z-[300] flex items-center gap-2">
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-cream/90 dark:bg-charcoal/90 dark:border-cream/15 backdrop-blur-sm px-3 py-1.5 text-sm font-sans text-charcoal dark:text-cream hover:bg-cream dark:hover:bg-charcoal transition-colors"
        >
          <LuArrowLeft className="size-3.5" />
          <span>{projectName}</span>
        </Link>
      </div>

      <Tldraw
        onMount={handleMount}
        inferDarkMode
        components={{ PageMenu: null }}
      />
    </div>
  )
}
