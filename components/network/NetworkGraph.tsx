'use client'

import { useEffect, useRef, useState } from 'react'
import type { NetworkGraphData } from './types'
import { computeNetworkEdges, filterEdges, nodesForEdges } from './computeNetworkEdges'
import { mixRgb } from './pointsGiven'

interface NetworkGraphProps {
  data: NetworkGraphData
  egoEntity?: string | null
  minWeight?: number
  /** Optional display labels keyed by entity id (e.g. player display names). */
  labels?: Record<string, string>
  /**
   * When ego is selected: net points with each node from ego's perspective.
   * Positive = they paid ego (bamboo). Negative = ego paid them (cinnabar).
   */
  netPointsWithEgo?: Record<string, number> | null
  /** Click a node to react in the host (e.g. set as ego entity). */
  onNodeClick?: (entityId: string) => void
  height?: number // px, default 600
}

/** Read a space-separated RGB CSS variable as an `rgb()` / `rgba()` string. */
function themeColor(name: string, alpha?: number): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  if (!raw) return alpha === undefined ? '#18694f' : `rgba(24, 105, 79, ${alpha})`
  if (alpha === undefined) return `rgb(${raw.split(/\s+/).join(', ')})`
  return `rgba(${raw.split(/\s+/).join(', ')}, ${alpha})`
}

function useIsDarkTheme() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

function formatNetTooltip(name: string, net: number) {
  const rounded = Math.round(net)
  if (rounded > 0) return `${name}: +${rounded} net (they paid selected more)`
  if (rounded < 0) return `${name}: ${rounded} net (selected paid them more)`
  return `${name}: even (0 net)`
}

export function NetworkGraph({
  data,
  egoEntity,
  minWeight = 1,
  labels,
  netPointsWithEgo,
  onNodeClick,
  height = 600,
}: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDark = useIsDarkTheme()

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let network: any

    const allEdges = computeNetworkEdges(data)
    const edges = filterEdges(allEdges, { minWeight, egoEntity })
    const nodeIds = nodesForEdges(data.entities, edges, egoEntity)

    const bamboo = themeColor('--bamboo')
    const bambooBright = themeColor('--bamboo-bright')
    const cinnabar = themeColor('--cinnabar')
    const ink = themeColor('--ink')
    const line = themeColor('--line')
    const surface2 = themeColor('--surface-2')
    // Light-mode cream stays readable on dark green surfaces (CSS vars swap in dark).
    const lightCream = 'rgb(255, 252, 239)'
    const positivePole = isDark ? lightCream : bamboo
    const negativePole = cinnabar
    const meterBase = isDark ? themeColor('--surface-1') : surface2

    const useMeter = Boolean(egoEntity && netPointsWithEgo)
    const maxAbs = useMeter
      ? Math.max(0, ...nodeIds.map((id) => (id === egoEntity ? 0 : Math.abs(netPointsWithEgo?.[id] ?? 0))))
      : 0

    async function render() {
      // vis-network touches `window` at import time — dynamic import keeps SSR safe.
      const { Network, DataSet } = await import('vis-network/standalone')
      if (cancelled || !containerRef.current) return

      const nodes = new DataSet(
        nodeIds.map((id) => {
          const name = labels?.[id] ?? id
          const isEgo = id === egoEntity
          const net = netPointsWithEgo?.[id] ?? 0
          const label = isEgo ? `⭐ ${name}` : name

          if (!useMeter || isEgo) {
            const defaultFill = isDark ? lightCream : bamboo
            const defaultBorder = isDark ? 'rgb(235, 229, 204)' : bambooBright
            return {
              id,
              label,
              font: { color: ink },
              color: isEgo
                ? {
                    background: isDark ? lightCream : bambooBright,
                    border: isDark ? bambooBright : bamboo,
                    highlight: { background: isDark ? lightCream : bambooBright, border: bamboo },
                  }
                : {
                    background: defaultFill,
                    border: defaultBorder,
                    highlight: { background: isDark ? lightCream : bambooBright, border: bamboo },
                  },
              title: isEgo ? `${name} (selected)` : name,
            }
          }

          const intensity = maxAbs > 0 ? Math.abs(net) / maxAbs : 0
          const pole = net >= 0 ? positivePole : negativePole
          const background = mixRgb(meterBase, pole, 0.25 + intensity * 0.75)
          const border = mixRgb(line, pole, 0.35 + intensity * 0.65)
          return {
            id,
            label,
            font: { color: ink },
            color: {
              background,
              border,
              highlight: { background: pole, border: isDark ? lightCream : bambooBright },
            },
            title: formatNetTooltip(name, net),
          }
        })
      )
      const edgeSet = new DataSet(
        edges.map((e, i) => ({
          id: i,
          from: e.from,
          to: e.to,
          value: e.weight,
          title: `${e.weight} shared game${e.weight === 1 ? '' : 's'}`,
        }))
      )

      network = new Network(
        containerRef.current,
        { nodes, edges: edgeSet },
        {
          nodes: {
            shape: 'dot',
            size: 18,
            font: { size: 14, color: ink, face: 'inherit' },
            borderWidth: 2,
          },
          edges: {
            color: { color: line, highlight: bamboo },
            smooth: false,
            scaling: { min: 1, max: 8 },
          },
          physics: {
            stabilization: true,
            barnesHut: { gravitationalConstant: -4000, springLength: 120 },
          },
          interaction: { hover: true, tooltipDelay: 100 },
        }
      )

      if (onNodeClick) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        network.on('click', (params: any) => {
          if (params.nodes.length > 0) onNodeClick(params.nodes[0])
        })
      }
    }
    render()

    return () => {
      cancelled = true
      network?.destroy()
    }
  }, [data, egoEntity, minWeight, labels, netPointsWithEgo, onNodeClick, isDark])

  const hasData = data.entities.length > 0 && data.events.length > 0
  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500"
        style={{ height }}
      >
        No games recorded yet.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-[10px] border border-slate-200 bg-slate-50"
      style={{ height }}
    />
  )
}
