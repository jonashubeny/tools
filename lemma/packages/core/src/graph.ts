/**
 * Utilities for the prerequisite graph: validation, ordering and a layered layout for the
 * skill tree.
 */

export interface GraphNode {
  id: string;
  prereqs: readonly string[];
}

/** A cycle in the prerequisite graph, as a list of ids, or null if there is none. */
export function findCycle(nodes: readonly GraphNode[]): string[] | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const state = new Map<string, 0 | 1 | 2>(); // 1 = on the stack, 2 = done
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    const s = state.get(id);
    if (s === 2) return null;
    if (s === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const pre of byId.get(id)?.prereqs ?? []) {
      if (!byId.has(pre)) continue;
      const cycle = visit(pre);
      if (cycle) return cycle;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };

  for (const node of nodes) {
    const cycle = visit(node.id);
    if (cycle) return cycle;
  }
  return null;
}

/** Ids ordered so that every prerequisite comes before what depends on it. */
export function topologicalOrder(nodes: readonly GraphNode[]): string[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const done = new Set<string>();
  const out: string[] = [];
  const visit = (id: string): void => {
    if (done.has(id)) return;
    done.add(id);
    for (const pre of byId.get(id)?.prereqs ?? []) if (byId.has(pre)) visit(pre);
    out.push(id);
  };
  for (const node of nodes) visit(node.id);
  return out;
}

/** All direct and indirect prerequisites of a node. */
export function ancestorsOf(nodes: readonly GraphNode[], id: string): Set<string> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const out = new Set<string>();
  const visit = (current: string): void => {
    for (const pre of byId.get(current)?.prereqs ?? []) {
      if (!out.has(pre) && byId.has(pre)) {
        out.add(pre);
        visit(pre);
      }
    }
  };
  visit(id);
  return out;
}

/** Nodes that list `id` as a direct prerequisite. */
export function dependentsOf(nodes: readonly GraphNode[], id: string): string[] {
  return nodes.filter((node) => node.prereqs.includes(id)).map((node) => node.id);
}

export interface LayoutNode extends GraphNode {
  /** Column group the node belongs to. */
  lane: string;
}

export interface LaidOutNode {
  id: string;
  lane: string;
  /** Row: length of the longest prerequisite chain leading to the node. */
  depth: number;
  x: number;
  y: number;
}

export interface GraphLayout {
  nodes: LaidOutNode[];
  lanes: { id: string; x: number; width: number }[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  gapX: number;
  /** Vertical space between one depth and the next. */
  gapY: number;
  laneGap: number;
  /** Order of the lanes, left to right. Lanes without nodes are dropped. */
  laneOrder: readonly string[];
  /**
   * At most this many nodes side by side within a lane; the rest of a depth wraps onto
   * further lines below. Keeps the drawing narrow enough to read without scrolling
   * sideways. Default: no limit.
   */
  maxPerRow?: number;
  /** Vertical space between wrapped lines of the same depth. Default: 8. */
  rowGap?: number;
}

/**
 * A layered layout: prerequisites above, dependants below; one column group per lane.
 *
 * Every node sits in the band of its depth (the length of the longest prerequisite chain
 * leading to it), so every edge points downwards. Within a band and a lane, nodes are
 * ordered by the average position of their prerequisites, which removes most edge
 * crossings without a full Sugiyama implementation. A band is as tall as its fullest lane.
 */
export function layoutGraph(nodes: readonly LayoutNode[], options: LayoutOptions): GraphLayout {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen: Set<string> = new Set()): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0; // defensive: cycles are rejected by the content linter
    seen.add(id);
    const pres = (byId.get(id)?.prereqs ?? []).filter((pre) => byId.has(pre));
    const d = pres.length === 0 ? 0 : Math.max(...pres.map((pre) => depthOf(pre, seen))) + 1;
    depth.set(id, d);
    return d;
  };
  for (const node of nodes) depthOf(node.id);

  // Without a limit a line can hold every node; a finite number keeps the arithmetic below plain.
  const perRow = Math.max(1, Math.floor(options.maxPerRow ?? Math.max(1, nodes.length)));
  const rowGap = options.rowGap ?? 8;
  const laneIds = options.laneOrder.filter((lane) => nodes.some((node) => node.lane === lane));
  const maxDepth = Math.max(0, ...depth.values());
  const cell = options.nodeWidth + options.gapX;
  const group = (lane: string, d: number): LayoutNode[] =>
    nodes.filter((node) => node.lane === lane && depth.get(node.id) === d);

  // A lane is as wide as its fullest line; a band is as tall as its fullest lane.
  const lanes: GraphLayout['lanes'] = [];
  let cursor = 0;
  for (const lane of laneIds) {
    let widest = 1;
    for (let d = 0; d <= maxDepth; d++) widest = Math.max(widest, Math.min(perRow, group(lane, d).length));
    const width = widest * cell - options.gapX;
    lanes.push({ id: lane, x: cursor, width });
    cursor += width + options.laneGap;
  }
  const totalWidth = Math.max(0, cursor - options.laneGap);

  const bandTop: number[] = [];
  let y = 0;
  for (let d = 0; d <= maxDepth; d++) {
    bandTop.push(y);
    const lines = Math.max(1, ...laneIds.map((lane) => Math.ceil(group(lane, d).length / perRow)));
    y += lines * options.nodeHeight + (lines - 1) * rowGap + options.gapY;
  }
  const totalHeight = nodes.length === 0 ? 0 : y - options.gapY;

  const position = new Map<string, { x: number; y: number }>();
  const authoredIndex = new Map(nodes.map((node, index) => [node.id, index]));

  for (let d = 0; d <= maxDepth; d++) {
    for (const lane of lanes) {
      const row = group(lane.id, d);
      const barycenter = (node: LayoutNode): number => {
        const xs = node.prereqs.map((pre) => position.get(pre)?.x).filter((x): x is number => x !== undefined);
        return xs.length === 0 ? Number.NaN : xs.reduce((sum, x) => sum + x, 0) / xs.length;
      };
      row.sort((a, b) => {
        const ba = barycenter(a);
        const bb = barycenter(b);
        if (!Number.isNaN(ba) && !Number.isNaN(bb) && ba !== bb) return ba - bb;
        return authoredIndex.get(a.id)! - authoredIndex.get(b.id)!;
      });
      row.forEach((node, index) => {
        const line = Math.floor(index / perRow);
        const inLine = Math.min(perRow, row.length - line * perRow);
        const lineWidth = inLine * cell - options.gapX;
        position.set(node.id, {
          x: lane.x + (lane.width - lineWidth) / 2 + (index % perRow) * cell,
          y: bandTop[d]! + line * (options.nodeHeight + rowGap),
        });
      });
    }
  }

  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      lane: node.lane,
      depth: depth.get(node.id)!,
      ...position.get(node.id)!,
    })),
    lanes,
    width: totalWidth,
    height: totalHeight,
  };
}
