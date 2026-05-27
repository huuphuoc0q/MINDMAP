import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { MindNodeData, CanvasTransform, ConnectionData } from '../types';
import { EditorNode } from './EditorNode';
import { FloatingToolbar } from './Toolbar';
import { useMindMapStore } from '../store/useMindMapStore';

// Helper to calculate elegant curved paths
const getPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.abs(x2 - x1) * 0.4;
  const cx = Math.max(dx, 50);
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
};

export function Canvas({ mapId }: { mapId: string; key?: string }) {
  // Pull state and actions from Zustand store
  const {
    nodes,
    connections,
    transform,
    selectedNodeId,
    selectedNodeIds,
    selectedConnectionId,
    editNodeId,
    loadMap,
    setTransform,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedConnectionId,
    setEditNodeId,
    addNode,
    updateNodeContent,
    toggleCollapseNode,
    addConnection,
    deleteSelected,
    undo,
    redo,
    autoLayout,
    isPresenting,
    nextSlide,
    prevSlide,
    stopPresentation,
  } = useMindMapStore();

  // Load the current map on mount or mapId change
  useEffect(() => {
    loadMap(mapId);
  }, [mapId, loadMap]);

  const [isConnecting, setIsConnecting] = useState(false);

  // Key Event Listeners with protection against stale closures
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Do not trigger shortcuts when typing inside a node
      const currentEditNodeId = useMindMapStore.getState().editNodeId;
      if (currentEditNodeId) return;

      const state = useMindMapStore.getState();

      // 2. Presentation Mode Shortcuts
      if (state.isPresenting) {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          state.nextSlide();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          state.prevSlide();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          state.stopPresentation();
        }
        return; // Block other shortcuts while presenting
      }

      // 3. Ctrl + Z or Cmd + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // 3. Ctrl + Y or Cmd + Shift + Z (Redo)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }

      // 4. Enter key pressed (exactly one node selected)
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (state.selectedNodeIds.length === 1) {
          e.preventDefault();
          const parentId = state.selectedNodeIds[0];
          const parentNode = state.nodes.find(n => n.id === parentId);
          if (parentNode) {
            const parentChildren = state.connections.filter(c => c.source === parentId);
            const childCount = parentChildren.length;
            
            const newNodeWidth = 250;
            const newNodeHeight = 100;
            const x = parentNode.x + parentNode.width + 120;
            
            // Place the child node below all other existing child nodes to avoid overlap
            let y = parentNode.y + (parentNode.height / 2) - (newNodeHeight / 2);
            if (childCount > 0) {
              const childrenIds = parentChildren.map(c => c.target);
              const childrenNodes = state.nodes.filter(n => childrenIds.includes(n.id));
              if (childrenNodes.length > 0) {
                let lowestY = -Infinity;
                childrenNodes.forEach(child => {
                  const el = nodeRefs.current[child.id];
                  const h = el ? el.offsetHeight : child.height;
                  const bottomY = child.y + h;
                  if (bottomY > lowestY) {
                    lowestY = bottomY;
                  }
                });
                y = lowestY + 30; // 30px spacing below the lowest node
              }
            }
            
            state.saveSnapshot();
            
            const childId = `n${Date.now()}`;
            const newChildNode: MindNodeData = {
              id: childId,
              x,
              y,
              width: newNodeWidth,
              height: newNodeHeight,
              content: 'Ý tưởng con mới...',
            };
            
            state.addNode(newChildNode);
            state.addConnection(parentId, childId);
            
            // Focus and edit the child node immediately
            state.setSelectedNodeIds([childId]);
            state.setEditNodeId(childId);

            // Automatically layout the mindmap to arrange the newly created node beautifully
            setTimeout(() => {
              const latestState = useMindMapStore.getState();
              const nodeDims: Record<string, { w: number; h: number }> = {};
              latestState.nodes.forEach((n) => {
                const el = nodeRefs.current[n.id];
                nodeDims[n.id] = {
                  w: el ? el.offsetWidth : n.width,
                  h: el ? el.offsetHeight : n.height,
                };
              });
              latestState.autoLayout(nodeDims);
            }, 50);
          }
        }
      }

      // 5. Delete or Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, deleteSelected]);

  // DOM Refs for direct style modification during 60fps dragging
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const connRefs = useRef<Record<string, SVGPathElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tempLineRef = useRef<SVGPathElement | null>(null);

  // Lasso Selection Box State & Refs
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const selectionBoxActiveRef = useRef(false);
  const selectionBoxRef = useRef<{ 
    startX: number; 
    startY: number; 
    currentX: number; 
    currentY: number;
    cachedVisibleNodes?: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  } | null>(null);

  // Dragging/Resizing State Refs
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  const draggedNodesRef = useRef<{
    triggerNodeId: string;
    pointerStartX: number;
    pointerStartY: number;
    nodes: Array<{ id: string; startX: number; startY: number; width: number; height: number }>;
    relevantConnections?: Array<{
      id: string;
      source: string;
      target: string;
      sourceIsDragged: boolean;
      targetIsDragged: boolean;
      staticSourceX?: number;
      staticSourceY?: number;
      staticTargetX?: number;
      staticTargetY?: number;
    }>;
  } | null>(null);
  const connectingRef = useRef<{ sourceNodeId: string; startX: number; startY: number } | null>(null);
  const resizingNodeRef = useRef<{ id: string; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);

  // DFS Calculations for Node Levels and Visibility
  const treeData = useMemo(() => {
    const levels: Record<string, number> = {};
    const visibleNodes = new Set<string>();
    const hasChildren: Record<string, boolean> = {};

    const targetIds = new Set(connections.map((c) => c.target));
    const roots = nodes.filter((n) => !targetIds.has(n.id));

    const adjList: Record<string, string[]> = {};
    connections.forEach((c) => {
      if (!adjList[c.source]) adjList[c.source] = [];
      adjList[c.source].push(c.target);
    });

    const visited = new Set<string>();

    const dfs = (nodeId: string, currentLevel: number, isVisible: boolean) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      levels[nodeId] = currentLevel;
      if (isVisible) visibleNodes.add(nodeId);

      const children = adjList[nodeId] || [];
      hasChildren[nodeId] = children.length > 0;

      const node = nodes.find((n) => n.id === nodeId);
      const childrenVisible = isVisible && !node?.isCollapsed;

      children.forEach((childId) => {
        dfs(childId, currentLevel + 1, childrenVisible);
      });
    };

    roots.forEach((r) => dfs(r.id, 0, true));

    // Process orphan nodes
    nodes.forEach((n) => {
      if (levels[n.id] === undefined) dfs(n.id, 0, true);
    });

    return { levels, visibleNodes, hasChildren };
  }, [nodes, connections]);

  // Global Canvas Pointer Interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only process left click

    // Check if Shift or Ctrl is pressed to activate Lasso Selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      isPanningRef.current = false;
      selectionBoxActiveRef.current = true;
      
      // Perform DFS ONCE to find visible nodes when lasso starts
      const activeNodes = useMindMapStore.getState().nodes;
      const activeConns = useMindMapStore.getState().connections;
      const targetIds = new Set(activeConns.map((c) => c.target));
      const roots = activeNodes.filter((n) => !targetIds.has(n.id));

      const adjList: Record<string, string[]> = {};
      activeConns.forEach((c) => {
        if (!adjList[c.source]) adjList[c.source] = [];
        adjList[c.source].push(c.target);
      });

      const visibleNodes = new Set<string>();
      const visited = new Set<string>();

      const dfs = (nodeId: string, isVisible: boolean) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        if (isVisible) visibleNodes.add(nodeId);

        const children = adjList[nodeId] || [];
        const node = activeNodes.find((n) => n.id === nodeId);
        const childrenVisible = isVisible && !node?.isCollapsed;

        children.forEach((childId) => {
          dfs(childId, childrenVisible);
        });
      };

      roots.forEach((r) => dfs(r.id, true));
      activeNodes.forEach((n) => {
        if (!visited.has(n.id)) dfs(n.id, true);
      });

      const cachedVisibleNodes = activeNodes
        .filter(n => visibleNodes.has(n.id))
        .map(n => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height }));

      const box = { 
        startX: e.clientX, 
        startY: e.clientY, 
        currentX: e.clientX, 
        currentY: e.clientY,
        cachedVisibleNodes 
      };
      
      selectionBoxRef.current = box;
      setSelectionBox({ startX: box.startX, startY: box.startY, currentX: box.currentX, currentY: box.currentY });
      setSelectedConnectionId(null);
    } else {
      isPanningRef.current = true;
      selectionBoxActiveRef.current = false;
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeIds([]);
      setSelectedConnectionId(null);
      setEditNodeId(null);
    }

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch { }
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // 1. Canvas Panning
    if (isPanningRef.current && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // 2. Lasso Selection Box Calculations
    if (selectionBoxActiveRef.current && containerRef.current && selectionBoxRef.current) {
      selectionBoxRef.current.currentX = e.clientX;
      selectionBoxRef.current.currentY = e.clientY;

      // Update state for rendering Lasso box visual overlay
      setSelectionBox({ 
        startX: selectionBoxRef.current.startX,
        startY: selectionBoxRef.current.startY,
        currentX: selectionBoxRef.current.currentX,
        currentY: selectionBoxRef.current.currentY
      });

      const xMin = Math.min(selectionBoxRef.current.startX, selectionBoxRef.current.currentX);
      const xMax = Math.max(selectionBoxRef.current.startX, selectionBoxRef.current.currentX);
      const yMin = Math.min(selectionBoxRef.current.startY, selectionBoxRef.current.currentY);
      const yMax = Math.max(selectionBoxRef.current.startY, selectionBoxRef.current.currentY);

      const containerRect = containerRef.current.getBoundingClientRect();
      const t = useMindMapStore.getState().transform;

      const canvasXMin = (xMin - containerRect.left - t.x) / t.scale;
      const canvasXMax = (xMax - containerRect.left - t.x) / t.scale;
      const canvasYMin = (yMin - containerRect.top - t.y) / t.scale;
      const canvasYMax = (yMax - containerRect.top - t.y) / t.scale;

      const activeNodeIds: string[] = [];
      const cachedNodes = selectionBoxRef.current.cachedVisibleNodes || [];
      
      for (const node of cachedNodes) {
        const intersects =
          node.x < canvasXMax &&
          node.x + node.width > canvasXMin &&
          node.y < canvasYMax &&
          node.y + node.height > canvasYMin;

        if (intersects) {
          activeNodeIds.push(node.id);
        }
      }

      useMindMapStore.getState().setSelectedNodeIds(activeNodeIds);
      return;
    }

    // 3. High-performance MULTIPLE Node Dragging (60fps)
    if (draggedNodesRef.current) {
      const { pointerStartX, pointerStartY, nodes: dNodes, relevantConnections } = draggedNodesRef.current;
      const t = useMindMapStore.getState().transform;
      const dx = (e.clientX - pointerStartX) / t.scale;
      const dy = (e.clientY - pointerStartY) / t.scale;

      const dNodesMap = new Map<string, { id: string; startX: number; startY: number; width: number; height: number }>(dNodes.map(dn => [dn.id, dn]));

      dNodes.forEach((dn) => {
        const finalX = dn.startX + dx;
        const finalY = dn.startY + dy;

        const nodeEl = nodeRefs.current[dn.id];
        if (nodeEl) {
          nodeEl.style.left = `${finalX}px`;
          nodeEl.style.top = `${finalY}px`;
        }
      });

      if (relevantConnections) {
        relevantConnections.forEach((conn) => {
          const pathEl = connRefs.current[conn.id];
          if (!pathEl) return;

          let x1, y1, x2, y2;

          if (conn.sourceIsDragged) {
            const dn = dNodesMap.get(conn.source);
            if (dn) {
              x1 = dn.startX + dx + dn.width;
              y1 = dn.startY + dy + dn.height / 2;
            }
          } else {
            x1 = conn.staticSourceX;
            y1 = conn.staticSourceY;
          }

          if (conn.targetIsDragged) {
            const dn = dNodesMap.get(conn.target);
            if (dn) {
              x2 = dn.startX + dx - 6; // Offset target end point by 6px
              y2 = dn.startY + dy + dn.height / 2;
            }
          } else {
            x2 = conn.staticTargetX;
            y2 = conn.staticTargetY;
          }

          if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            pathEl.setAttribute('d', getPath(x1, y1, x2, y2));
          }
        });
      }
      return;
    }

    // 4. High-performance Resizing (60fps)
    if (resizingNodeRef.current) {
      const { id, startWidth, startHeight, startX, startY } = resizingNodeRef.current;
      const t = useMindMapStore.getState().transform;

      const dx = (e.clientX - startX) / t.scale;
      const dy = (e.clientY - startY) / t.scale;

      const newWidth = Math.max(150, startWidth + dx);
      const newHeight = Math.max(80, startHeight + dy);

      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        nodeEl.style.width = `${newWidth}px`;
        nodeEl.style.minHeight = `${newHeight}px`;

        const mappedX = parseFloat(nodeEl.style.left);
        const mappedY = parseFloat(nodeEl.style.top);

        const activeConns = useMindMapStore.getState().connections;
        const activeNodes = useMindMapStore.getState().nodes;

        activeConns.forEach((conn) => {
          if (conn.source !== id && conn.target !== id) return;
          const pathEl = connRefs.current[conn.id];
          if (!pathEl) return;

          let x1, y1, x2, y2;

          if (conn.source === id) {
            x1 = mappedX + newWidth;
            y1 = mappedY + newHeight / 2;
          } else {
            const srcNode = activeNodes.find((n) => n.id === conn.source);
            x1 = srcNode ? srcNode.x + srcNode.width : 0;
            y1 = srcNode ? srcNode.y + srcNode.height / 2 : 0;
          }

          if (conn.target === id) {
            x2 = mappedX - 6; // Offset target end point by 6px for sleek arrowheads
            y2 = mappedY + newHeight / 2;
          } else {
            const tgtNode = activeNodes.find((n) => n.id === conn.target);
            x2 = tgtNode ? tgtNode.x - 6 : 0;
            y2 = tgtNode ? tgtNode.y + tgtNode.height / 2 : 0;
          }

          pathEl.setAttribute('d', getPath(x1, y1, x2, y2));
        });
      }
      return;
    }

    // 5. Dynamic Dotted Connection Drawing
    if (connectingRef.current && tempLineRef.current) {
      const { startX, startY } = connectingRef.current;
      const t = useMindMapStore.getState().transform;
      const targetX = (e.clientX - t.x) / t.scale;
      const targetY = (e.clientY - t.y) / t.scale;
      tempLineRef.current.setAttribute('d', getPath(startX, startY, targetX, targetY));
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isPanningRef.current = false;
    lastPanPointRef.current = null;

    // Reset Lasso Selection Box
    if (selectionBoxActiveRef.current) {
      selectionBoxActiveRef.current = false;
      selectionBoxRef.current = null;
      setSelectionBox(null);
    }

    // Sync dragged multiple nodes position to Zustand
    if (draggedNodesRef.current) {
      const { pointerStartX, pointerStartY, nodes: dNodes } = draggedNodesRef.current;
      const t = useMindMapStore.getState().transform;
      const dx = (e.clientX - pointerStartX) / t.scale;
      const dy = (e.clientY - pointerStartY) / t.scale;

      useMindMapStore.getState().saveSnapshot();

      dNodes.forEach((dn) => {
        const finalX = dn.startX + dx;
        const finalY = dn.startY + dy;
        useMindMapStore.getState().updateNodePosition(dn.id, finalX, finalY);
      });

      draggedNodesRef.current = null;
    }

    // Sync resized node dimensions to Zustand
    if (resizingNodeRef.current) {
      const { id } = resizingNodeRef.current;
      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        const finalWidth = parseFloat(nodeEl.style.width);
        const finalHeight = parseFloat(nodeEl.style.minHeight);

        useMindMapStore.getState().saveSnapshot();
        useMindMapStore.getState().updateNodeSize(id, finalWidth, finalHeight);
      }
      resizingNodeRef.current = null;
    }

    // Process new connection creation
    if (connectingRef.current) {
      if (tempLineRef.current) tempLineRef.current.style.display = 'none';

      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetNodeEl = elements.find((el) => el.hasAttribute('data-node-id'));

      if (targetNodeEl) {
        const targetId = targetNodeEl.getAttribute('data-node-id');
        const sourceId = connectingRef.current.sourceNodeId;

        if (targetId && targetId !== sourceId) {
          addConnection(sourceId, targetId);
        }
      }

      if (tempLineRef.current) tempLineRef.current.style.display = 'block';
      connectingRef.current = null;
      setIsConnecting(false);
    }

    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch { }
  }, [addConnection]);

  // Native mousewheel handling for smooth custom zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const t = useMindMapStore.getState().transform;
      const newScale = Math.max(0.1, Math.min(t.scale * scaleFactor, 5));

      const newX = cursorX - (cursorX - t.x) * (newScale / t.scale);
      const newY = cursorY - (cursorY - t.y) * (newScale / t.scale);

      setTransform({ x: newX, y: newY, scale: newScale });
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [setTransform]);

  // Node Callbacks
  const handleNodePointerDown = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();

    const currentEditId = useMindMapStore.getState().editNodeId;
    if (currentEditId === nodeId) return;

    const selectedNodeIds = useMindMapStore.getState().selectedNodeIds;
    let newSelectedIds = [...selectedNodeIds];

    // Check if Shift or Ctrl is held to toggle multi-selection
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (newSelectedIds.includes(nodeId)) {
        newSelectedIds = newSelectedIds.filter(id => id !== nodeId);
      } else {
        newSelectedIds.push(nodeId);
      }
      setSelectedNodeIds(newSelectedIds);
      // When selecting with modifier key, we do NOT initiate drag to avoid accidental movement
      return;
    } else {
      // If the node is not already selected, select it as the sole active node
      if (!selectedNodeIds.includes(nodeId)) {
        setSelectedNodeIds([nodeId]);
        newSelectedIds = [nodeId];
      }
    }

    const activeNodes = useMindMapStore.getState().nodes;

    // Gather positions and dimensions of all currently selected nodes for high-performance multi-dragging
    const dragNodes = newSelectedIds.map((id) => {
      const n = activeNodes.find((node) => node.id === id);
      const el = nodeRefs.current[id];
      return {
        id,
        startX: n ? n.x : 0,
        startY: n ? n.y : 0,
        width: el ? el.offsetWidth : (n ? n.width : 250),
        height: el ? el.offsetHeight : (n ? n.height : 100),
      };
    });

    // Cache related connections
    const activeConns = useMindMapStore.getState().connections;
    const draggedNodesSet = new Set(newSelectedIds);
    
    const relevantConnections = activeConns
      .filter(c => draggedNodesSet.has(c.source) || draggedNodesSet.has(c.target))
      .map(c => {
        const sourceIsDragged = draggedNodesSet.has(c.source);
        const targetIsDragged = draggedNodesSet.has(c.target);
        
        let staticSourceX, staticSourceY, staticTargetX, staticTargetY;
        
        if (!sourceIsDragged) {
          const n = activeNodes.find(node => node.id === c.source);
          const el = nodeRefs.current[c.source];
          const w = el ? el.offsetWidth : (n ? n.width : 250);
          const h = el ? el.offsetHeight : (n ? n.height : 100);
          staticSourceX = n ? n.x + w : 0;
          staticSourceY = n ? n.y + h / 2 : 0;
        }
        
        if (!targetIsDragged) {
          const n = activeNodes.find(node => node.id === c.target);
          const el = nodeRefs.current[c.target];
          const h = el ? el.offsetHeight : (n ? n.height : 100);
          staticTargetX = n ? n.x - 6 : 0;
          staticTargetY = n ? n.y + h / 2 : 0;
        }
        
        return {
          id: c.id,
          source: c.source,
          target: c.target,
          sourceIsDragged,
          targetIsDragged,
          staticSourceX,
          staticSourceY,
          staticTargetX,
          staticTargetY
        };
      });

    draggedNodesRef.current = {
      triggerNodeId: nodeId,
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      nodes: dragNodes,
      relevantConnections,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch { }
  }, [setSelectedNodeIds]);

  const handleNodeDoubleClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditNodeId(nodeId);
  }, [setEditNodeId]);

  const handleNodeChange = useCallback((id: string, newContent: string) => {
    updateNodeContent(id, newContent);
  }, [updateNodeContent]);

  const handleToggleCollapse = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    toggleCollapseNode(nodeId);
  }, [toggleCollapseNode]);

  const handleConnectionStart = useCallback((nodeId: string, e: React.PointerEvent) => {
    const activeNodes = useMindMapStore.getState().nodes;
    const node = activeNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const startX = node.x + node.width;
    const startY = node.y + node.height / 2;
    connectingRef.current = { sourceNodeId: nodeId, startX, startY };
    setIsConnecting(true);

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch { }
  }, []);

  const handleNodeResizeStart = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedNodeIds([nodeId]);

    const node = useMindMapStore.getState().nodes.find((n) => n.id === nodeId);
    const nodeEl = nodeRefs.current[nodeId];
    if (!node || !nodeEl) return;

    resizingNodeRef.current = {
      id: nodeId,
      startWidth: nodeEl.offsetWidth,
      startHeight: nodeEl.offsetHeight,
      startX: e.clientX,
      startY: e.clientY,
    };

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch { }
  }, [setSelectedNodeIds]);

  const handleBackgroundDoubleClick = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - transform.x) / transform.scale;
    const y = (e.clientY - rect.top - transform.y) / transform.scale;

    const newNode: MindNodeData = {
      id: `n${Date.now()}`,
      x,
      y,
      width: 250,
      height: 100,
      content: 'Khái niệm mới...',
    };

    addNode(newNode);
    setEditNodeId(newNode.id);
  };

  const handleAutoLayoutClick = () => {
    // Collect DOM node sizes for accurate auto layout spacing
    const nodeDims: Record<string, { w: number; h: number }> = {};
    nodes.forEach((n) => {
      const el = nodeRefs.current[n.id];
      nodeDims[n.id] = {
        w: el ? el.offsetWidth : n.width,
        h: el ? el.offsetHeight : n.height,
      };
    });

    autoLayout(nodeDims);
  };

  const renderConnections = () => {
    return connections.map((conn) => {
      if (!treeData.visibleNodes.has(conn.source) || !treeData.visibleNodes.has(conn.target)) return null;
      const source = nodes.find((n) => n.id === conn.source);
      const target = nodes.find((n) => n.id === conn.target);
      if (!source || !target) return null;

      // Draw from right edge of source to left edge of target (offset target for arrowheads)
      const x1 = source.x + source.width;
      const y1 = source.y + source.height / 2;
      const x2 = target.x - 6; // Offset target for sleek arrowheads
      const y2 = target.y + target.height / 2;

      const isSelected = conn.id === selectedConnectionId;

      return (
        <path
          key={conn.id}
          ref={(el) => {
            connRefs.current[conn.id] = el;
          }}
          d={getPath(x1, y1, x2, y2)}
          fill="none"
          stroke={isSelected ? '#EF4444' : 'rgba(255,255,255,0.2)'}
          strokeWidth={isSelected ? 4 : 3}
          className="cursor-pointer transition-all hover:stroke-red-400"
          style={{ pointerEvents: 'auto' }}
          markerEnd={isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
          onPointerDown={(e) => {
            e.stopPropagation();
            setSelectedConnectionId(conn.id);
          }}
        />
      );
    });
  };

  const editNode = nodes.find((n) => n.id === editNodeId);
  const isEmpty = nodes.length === 0;

  return (
    <div
      className="w-full h-full relative overflow-hidden bg-transparent text-[#E0E0E0] select-none"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1.5px, transparent 1.5px)',
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`,
      }}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      <div
        className={`absolute inset-0 origin-top-left will-change-transform ${isPresenting ? 'transition-transform duration-700 ease-in-out' : ''}`}
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* Connection Layer with Arrowhead Defs */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="12"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 2 2 L 9 5 L 2 8 L 4 5 Z" fill="rgba(255,255,255,0.4)" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="12"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path d="M 2 2 L 9 5 L 2 8 L 4 5 Z" fill="#EF4444" />
            </marker>
          </defs>
          {renderConnections()}
          {isConnecting && (
            <path
              ref={tempLineRef}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={2}
              strokeDasharray="5,5"
              className="opacity-70 animate-pulse pointer-events-none"
            />
          )}
        </svg>

        {/* Distributed Nodes Layer */}
        {nodes
          .filter((n) => treeData.visibleNodes.has(n.id))
          .map((node) => (
            <EditorNode
              key={node.id}
              ref={(el) => {
                nodeRefs.current[node.id] = el;
              }}
              node={node}
              level={treeData.levels[node.id]}
              hasChildren={treeData.hasChildren[node.id]}
              isCollapsed={!!node.isCollapsed}
              isEditing={editNodeId === node.id}
              isSelected={selectedNodeIds.includes(node.id)}
              onPointerDown={handleNodePointerDown}
              onDoubleClick={handleNodeDoubleClick}
              onChange={handleNodeChange}
              onConnectionStart={handleConnectionStart}
              onResizeStart={handleNodeResizeStart}
              onToggleCollapse={handleToggleCollapse}
            />
          ))}
      </div>

      {!isPresenting && editNode && (
        <FloatingToolbar
          x={editNode.x * transform.scale + transform.x + (editNode.width * transform.scale) / 2}
          y={editNode.y * transform.scale + transform.y - 10}
        />
      )}

      {/* Lasso Selection Box visual element */}
      {selectionBox && containerRef.current && (
        <div
          className="selection-box absolute pointer-events-none z-50 rounded"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX) - containerRef.current.getBoundingClientRect().left,
            top: Math.min(selectionBox.startY, selectionBox.currentY) - containerRef.current.getBoundingClientRect().top,
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY),
          }}
        />
      )}

      {/* Empty State Overlay */}
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 animate-fade-in">
          <div className="glass-panel p-10 rounded-3xl max-w-md w-full mx-4 flex flex-col items-center text-center pointer-events-auto border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition-all hover:border-white/20 hover:shadow-[0_40px_80px_rgba(0,0,0,0.9)]">
            {/* Glowing Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 flex items-center justify-center text-blue-400 mb-6 shadow-inner relative animate-pulse">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <div className="absolute -inset-1 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl opacity-20 blur-md -z-10" />
            </div>

            <h3 className="text-xl font-heading font-semibold text-white mb-2 tracking-tight">
              Không gian Sáng tạo Trống
            </h3>
            <p className="text-sm text-white/50 mb-8 leading-relaxed max-w-xs">
              Bắt đầu phác thảo ý tưởng, vẽ sơ đồ tư duy hoặc nhập dữ liệu để bắt đầu hành trình của bạn.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => {
                  const viewportWidth = window.innerWidth;
                  const viewportHeight = window.innerHeight;
                  const x = (viewportWidth / 2 - transform.x) / transform.scale - 125;
                  const y = (viewportHeight / 2 - transform.y) / transform.scale - 50;

                  const newNode: MindNodeData = {
                    id: `n${Date.now()}`,
                    x,
                    y,
                    width: 250,
                    height: 100,
                    content: '<b>Ý tưởng trung tâm mới</b><br/>Nhấp đúp để chỉnh sửa...',
                  };
                  addNode(newNode);
                  setEditNodeId(newNode.id);
                }}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] active:scale-[0.98] cursor-pointer"
              >
                Tạo Ý tưởng Trung tâm
              </button>

              <button
                onClick={() => {
                  loadMap('map_default');
                }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-semibold rounded-xl transition-all active:scale-[0.98] cursor-pointer"
              >
                Tải Sơ đồ Mẫu
              </button>
            </div>

            {/* Tiny guide */}
            <div className="mt-8 text-[11px] text-white/40 border-t border-white/5 pt-4 w-full flex items-center justify-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>Mẹo: Nhấp đúp vào nền để tạo nhanh một khối</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Central Control Bar */}
      {!isPresenting && !isEmpty && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-50">
          <div className="flex items-center gap-2 p-1.5 glass-panel rounded-2xl" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAutoLayoutClick();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600/80 to-purple-600/80 hover:from-blue-500 hover:to-purple-500 text-white text-sm font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.8)] active:scale-95 cursor-pointer"
              title="Tự động sắp xếp sơ đồ"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              Auto Layout
            </button>

            <div className="w-px h-6 bg-white/10 mx-1"></div>

            <button
              onClick={() => setTransform((t) => ({ ...t, scale: Math.min(t.scale * 1.2, 5) }))}
              className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Phóng to"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => setTransform((t) => ({ ...t, scale: Math.max(t.scale * 0.1, 0.1) }))}
              className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Thu nhỏ"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            </button>
            <button
              onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
              className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Căn giữa Canvas"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </button>
          </div>

          {/* HUD Instructions Panel */}
          <div className="px-4 py-1.5 glass-panel rounded-full text-[10px] text-white/50 tracking-wider pointer-events-none whitespace-nowrap font-medium uppercase shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            Dbl-click: <span className="text-white">New/Edit</span> &nbsp;&bull;&nbsp; Drag: <span className="text-white">Pan</span> &nbsp;&bull;&nbsp; Shift+Drag: <span className="text-white">Multi-Select</span> &nbsp;&bull;&nbsp; Del: <span className="text-white">Delete</span> &nbsp;&bull;&nbsp; Ctrl+Z/Y: <span className="text-white">Undo/Redo</span>
          </div>
        </div>
      )}
    </div>
  );
}
