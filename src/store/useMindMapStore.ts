import { create } from 'zustand';
import { MindNodeData, ConnectionData, CanvasTransform } from '../types';

const INITIAL_NODES: MindNodeData[] = [
  {
    id: 'n1',
    x: 100,
    y: 100,
    width: 250,
    height: 100,
    content: '<b>MindNode Canvas v2</b><br/>Nhấp đúp (Double-click) để chỉnh sửa khái niệm này...',
  },
  {
    id: 'n2',
    x: 450,
    y: 200,
    width: 280,
    height: 100,
    content: 'Bạn có thể kéo thả các khối tự do trên không gian.<br/><i>Hỗ trợ gõ tiếng Việt mượt mà!</i>',
  }
];

const INITIAL_CONNECTIONS: ConnectionData[] = [
  { id: 'e1', source: 'n1', target: 'n2' }
];

interface HistoryState {
  nodes: MindNodeData[];
  connections: ConnectionData[];
}

interface MindMapStore {
  // State
  mapId: string;
  nodes: MindNodeData[];
  connections: ConnectionData[];
  transform: CanvasTransform;
  selectedNodeId: string | null;
  selectedConnectionId: string | null;
  editNodeId: string | null;
  history: HistoryState[];
  future: HistoryState[];

  // General Actions
  loadMap: (mapId: string) => void;
  setTransform: (transform: CanvasTransform | ((t: CanvasTransform) => CanvasTransform)) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedConnectionId: (id: string | null) => void;
  setEditNodeId: (id: string | null) => void;

  // Node Mutations
  addNode: (node: MindNodeData) => void;
  updateNodeContent: (id: string, content: string) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  updateNodeSize: (id: string, width: number, height: number) => void;
  toggleCollapseNode: (id: string) => void;
  deleteSelected: () => void;

  // Connection Mutations
  addConnection: (source: string, target: string) => void;

  // History Actions
  saveSnapshot: () => void;
  undo: () => void;
  redo: () => void;

  // Auto Layout
  autoLayout: (nodeDims: Record<string, { w: number; h: number }>) => void;

  // Presentation Mode
  isPresenting: boolean;
  presentationIndex: number;
  presentationNodes: string[];
  startPresentation: () => void;
  stopPresentation: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  importMapData: (nodes: MindNodeData[], connections: ConnectionData[]) => void;
}

// Deep copy helper to avoid reference sharing
const cloneState = (nodes: MindNodeData[], connections: ConnectionData[]): HistoryState => {
  return {
    nodes: JSON.parse(JSON.stringify(nodes)),
    connections: JSON.parse(JSON.stringify(connections)),
  };
};

// Helper to calculate the optimal transform for a node in Presentation Mode
const getOptimalPresentationTransform = (node: MindNodeData): CanvasTransform => {
  const nodeEl = document.querySelector(`[data-node-id="${node.id}"]`) as HTMLDivElement | null;
  const actualWidth = nodeEl ? nodeEl.offsetWidth : node.width;
  const actualHeight = nodeEl ? nodeEl.offsetHeight : node.height;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Spacing / Safety margins around the node content
  // Horizontal padding: 60px each side
  const paddingX = 120;
  // Vertical padding: 80px top, 160px bottom (extra room for HUD controls)
  const paddingY = 240;

  // Calculate the max allowed scale to fit both width and height within padding limits
  const maxScaleX = (vw - paddingX) / actualWidth;
  const maxScaleY = (vh - paddingY) / actualHeight;

  // Choose the smaller of the two scales to ensure full visibility,
  // cap maximum scale at 1.4 to maintain crisp typography,
  // and set a minimum scale of 0.4.
  let scale = Math.min(1.4, maxScaleX, maxScaleY);
  if (scale < 0.4) scale = 0.4;

  // Center horizontally and vertically (but shift center Y slightly up to clear bottom HUD)
  const targetCenterX = vw / 2;
  const targetCenterY = (vh - 100) / 2;

  const x = targetCenterX - (node.x + actualWidth / 2) * scale;
  const y = targetCenterY - (node.y + actualHeight / 2) * scale;

  return { x, y, scale };
};

export const useMindMapStore = create<MindMapStore>((set, get) => {
  // Helper to persist to localStorage
  const persistToLocalStorage = (mapId: string, nodes: MindNodeData[], connections: ConnectionData[]) => {
    localStorage.setItem(`mindnode_nodes_${mapId}`, JSON.stringify(nodes));
    localStorage.setItem(`mindnode_connections_${mapId}`, JSON.stringify(connections));
  };

  return {
    // Initial State
    mapId: '',
    nodes: [],
    connections: [],
    transform: { x: 0, y: 0, scale: 1 },
    selectedNodeId: null,
    selectedConnectionId: null,
    editNodeId: null,
    history: [],
    future: [],
    
    // Presentation State
    isPresenting: false,
    presentationIndex: 0,
    presentationNodes: [],

    // General Actions
    loadMap: (mapId) => {
      const savedNodes = localStorage.getItem(`mindnode_nodes_${mapId}`);
      const savedConns = localStorage.getItem(`mindnode_connections_${mapId}`);
      
      let nodes: MindNodeData[] = [];
      let connections: ConnectionData[] = [];

      if (savedNodes) {
        try {
          nodes = JSON.parse(savedNodes);
        } catch (e) {
          nodes = [];
        }
      }

      if (savedConns) {
        try {
          connections = JSON.parse(savedConns);
        } catch (e) {
          connections = [];
        }
      }

      // Fallbacks
      if (!savedNodes) {
        if (mapId === 'map_default') {
          nodes = INITIAL_NODES;
          connections = INITIAL_CONNECTIONS;
        } else {
          // New map default root node
          nodes = [
            {
              id: `n_${Date.now()}`,
              x: 150,
              y: 150,
              width: 250,
              height: 100,
              content: '<b>Ý tưởng trung tâm mới</b><br/>Nhấp đúp để chỉnh sửa...',
            }
          ];
          connections = [];
        }
        persistToLocalStorage(mapId, nodes, connections);
      }

      set({
        mapId,
        nodes,
        connections,
        selectedNodeId: null,
        selectedConnectionId: null,
        editNodeId: null,
        history: [],
        future: [],
      });
    },

    setTransform: (transform) => {
      set((state) => ({
        transform: typeof transform === 'function' ? transform(state.transform) : transform,
      }));
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id, selectedConnectionId: null }),
    setSelectedConnectionId: (id) => set({ selectedConnectionId: id, selectedNodeId: null }),
    setEditNodeId: (id) => set({ editNodeId: id }),

    // Node Mutations
    addNode: (node) => {
      get().saveSnapshot();
      set((state) => {
        const newNodes = [...state.nodes, node];
        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    updateNodeContent: (id, content) => {
      set((state) => {
        const newNodes = state.nodes.map((n) => (n.id === id ? { ...n, content } : n));
        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    updateNodePosition: (id, x, y) => {
      set((state) => {
        const newNodes = state.nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    updateNodeSize: (id, width, height) => {
      set((state) => {
        const newNodes = state.nodes.map((n) => (n.id === id ? { ...n, width, height } : n));
        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    toggleCollapseNode: (id) => {
      get().saveSnapshot();
      set((state) => {
        const newNodes = state.nodes.map((n) =>
          n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n
        );
        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    deleteSelected: () => {
      const { selectedNodeId, selectedConnectionId, nodes, connections } = get();
      if (!selectedNodeId && !selectedConnectionId) return;

      get().saveSnapshot();

      set((state) => {
        let newNodes = state.nodes;
        let newConnections = state.connections;

        if (state.selectedNodeId) {
          newNodes = state.nodes.filter((n) => n.id !== state.selectedNodeId);
          newConnections = state.connections.filter(
            (c) => c.source !== state.selectedNodeId && c.target !== state.selectedNodeId
          );
        } else if (state.selectedConnectionId) {
          newConnections = state.connections.filter((c) => c.id !== state.selectedConnectionId);
        }

        persistToLocalStorage(state.mapId, newNodes, newConnections);
        return {
          nodes: newNodes,
          connections: newConnections,
          selectedNodeId: null,
          selectedConnectionId: null,
        };
      });
    },

    // Connection Mutations
    addConnection: (source, target) => {
      const { connections, mapId } = get();
      if (connections.some((c) => c.source === source && c.target === target)) return;

      get().saveSnapshot();

      set((state) => {
        const newConnections = [
          ...state.connections,
          { id: `c_${Date.now()}`, source, target },
        ];
        persistToLocalStorage(mapId, state.nodes, newConnections);
        return { connections: newConnections };
      });
    },

    // History Actions
    saveSnapshot: () => {
      const { nodes, connections, history } = get();
      set({
        history: [...history, cloneState(nodes, connections)],
        future: [], // Clear redo stack on new action
      });
    },

    undo: () => {
      const { history, future, nodes, connections, mapId } = get();
      if (history.length === 0) return;

      const previousState = history[history.length - 1];
      const newHistory = history.slice(0, history.length - 1);
      const currentSnapshot = cloneState(nodes, connections);

      set({
        nodes: previousState.nodes,
        connections: previousState.connections,
        history: newHistory,
        future: [...future, currentSnapshot],
        selectedNodeId: null,
        selectedConnectionId: null,
      });

      persistToLocalStorage(mapId, previousState.nodes, previousState.connections);
    },

    redo: () => {
      const { history, future, nodes, connections, mapId } = get();
      if (future.length === 0) return;

      const nextState = future[future.length - 1];
      const newFuture = future.slice(0, future.length - 1);
      const currentSnapshot = cloneState(nodes, connections);

      set({
        nodes: nextState.nodes,
        connections: nextState.connections,
        history: [...history, currentSnapshot],
        future: newFuture,
        selectedNodeId: null,
        selectedConnectionId: null,
      });

      persistToLocalStorage(mapId, nextState.nodes, nextState.connections);
    },

    // Auto Layout (Pure math, using measured dims passed from React component)
    autoLayout: (nodeDims) => {
      get().saveSnapshot();

      set((state) => {
        const newNodes = state.nodes.map((n) => ({ ...n }));
        const HORIZONTAL_SPACING = 120;
        const VERTICAL_SPACING = 30;

        const targetIds = new Set(state.connections.map((c) => c.target));
        const roots = newNodes.filter((n) => !targetIds.has(n.id));

        const adjList: Record<string, string[]> = {};
        state.connections.forEach((c) => {
          if (!adjList[c.source]) adjList[c.source] = [];
          adjList[c.source].push(c.target);
        });

        const subtreeHeights: Record<string, number> = {};

        // 1. Calculate height of each subtree based on child node dimensions
        const calculateSubtreeHeight = (nodeId: string) => {
          const node = newNodes.find((n) => n.id === nodeId);
          if (!node) return 0;

          const dims = nodeDims[nodeId] || { w: node.width, h: node.height };
          const children = adjList[nodeId] || [];

          if (node.isCollapsed || children.length === 0) {
            subtreeHeights[nodeId] = dims.h;
            return dims.h;
          }

          let totalChildrenHeight = 0;
          children.forEach((childId, index) => {
            totalChildrenHeight += calculateSubtreeHeight(childId);
            if (index < children.length - 1) totalChildrenHeight += VERTICAL_SPACING;
          });

          subtreeHeights[nodeId] = Math.max(dims.h, totalChildrenHeight);
          return subtreeHeights[nodeId];
        };

        // 2. Position nodes recursively
        const positionNodes = (nodeId: string, startX: number, startY: number) => {
          const node = newNodes.find((n) => n.id === nodeId);
          if (!node) return;

          const dims = nodeDims[nodeId] || { w: node.width, h: node.height };
          node.x = startX;

          const nodeSubtreeH = subtreeHeights[nodeId] || dims.h;
          node.y = startY + nodeSubtreeH / 2 - dims.h / 2;

          const children = adjList[nodeId] || [];
          if (node.isCollapsed || children.length === 0) return;

          let totalChildrenH = 0;
          children.forEach((childId, i) => {
            totalChildrenH += subtreeHeights[childId];
            if (i < children.length - 1) totalChildrenH += VERTICAL_SPACING;
          });

          let currentChildY = startY + nodeSubtreeH / 2 - totalChildrenH / 2;

          children.forEach((childId) => {
            const childSubtreeH = subtreeHeights[childId] || 0;
            const parentWidth = dims.w;
            positionNodes(childId, startX + parentWidth + HORIZONTAL_SPACING, currentChildY);
            currentChildY += childSubtreeH + VERTICAL_SPACING;
          });
        };

        // 3. Layout each tree root
        let currentRootY = 100;
        roots.forEach((root) => {
          calculateSubtreeHeight(root.id);
          const rootDims = nodeDims[root.id] || { w: root.width, h: root.height };
          positionNodes(root.id, 100, currentRootY);
          currentRootY += (subtreeHeights[root.id] || rootDims.h) + VERTICAL_SPACING * 3;
        });

        persistToLocalStorage(state.mapId, newNodes, state.connections);
        return { nodes: newNodes };
      });
    },

    // Presentation Mode Actions
    startPresentation: () => {
      const state = get();
      const { nodes, connections } = state;
      
      const targetIds = new Set(connections.map((c) => c.target));
      const roots = nodes.filter((n) => !targetIds.has(n.id));
      
      const adjList: Record<string, string[]> = {};
      connections.forEach((c) => {
        if (!adjList[c.source]) adjList[c.source] = [];
        adjList[c.source].push(c.target);
      });
      
      const visited = new Set<string>();
      const presentationOrder: string[] = [];

      const dfs = (nodeId: string) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        presentationOrder.push(nodeId);
        
        const children = adjList[nodeId] || [];
        children.forEach((childId) => dfs(childId));
      };

      roots.forEach((r) => dfs(r.id));
      
      // Thu thập nốt các node mồ côi (không kết nối với root)
      nodes.forEach((n) => {
        if (!visited.has(n.id)) dfs(n.id);
      });

      if (presentationOrder.length > 0) {
        set({ isPresenting: true, presentationIndex: 0, presentationNodes: presentationOrder });
        
        const firstNode = nodes.find(n => n.id === presentationOrder[0]);
        if (firstNode) {
          const { x, y, scale } = getOptimalPresentationTransform(firstNode);
          set({ transform: { x, y, scale } });
        }
      }
    },
    
    stopPresentation: () => {
      set({ isPresenting: false });
    },
    
    nextSlide: () => {
      const state = get();
      if (!state.isPresenting) return;
      
      if (state.presentationIndex < state.presentationNodes.length - 1) {
        const nextIndex = state.presentationIndex + 1;
        const targetNodeId = state.presentationNodes[nextIndex];
        const targetNode = state.nodes.find(n => n.id === targetNodeId);
        
        if (targetNode) {
          const { x, y, scale } = getOptimalPresentationTransform(targetNode);
          set({ presentationIndex: nextIndex, transform: { x, y, scale } });
        } else {
          set({ presentationIndex: nextIndex });
        }
      }
    },
    
    prevSlide: () => {
      const state = get();
      if (!state.isPresenting) return;
      
      if (state.presentationIndex > 0) {
        const prevIndex = state.presentationIndex - 1;
        const targetNodeId = state.presentationNodes[prevIndex];
        const targetNode = state.nodes.find(n => n.id === targetNodeId);
        
        if (targetNode) {
          const { x, y, scale } = getOptimalPresentationTransform(targetNode);
          set({ presentationIndex: prevIndex, transform: { x, y, scale } });
        } else {
          set({ presentationIndex: prevIndex });
        }
      }
    },

    importMapData: (nodes, connections) => {
      get().saveSnapshot();
      set({
        nodes,
        connections,
        selectedNodeId: null,
        selectedConnectionId: null,
        editNodeId: null,
      });
      persistToLocalStorage(get().mapId, nodes, connections);
    },
  };
});
