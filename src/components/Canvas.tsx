// import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
// Thêm useMemo vào trong dấu ngoặc nhọn
import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { MindNodeData, CanvasTransform, ConnectionData } from '../types';
import { EditorNode } from './EditorNode';
import { FloatingToolbar } from './Toolbar';

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

// Helper to calculate elegant curved paths
const getPath = (x1: number, y1: number, x2: number, y2: number) => {
  const dx = Math.abs(x2 - x1) * 0.4;
  const cx = Math.max(dx, 50);
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
};

export function Canvas({ mapId }: { mapId: string }) {
  // KHỞI TẠO NODES TỪ LOCAL STORAGE
  const [nodes, setNodes] = useState<MindNodeData[]>(() => {
    // Thêm mapId vào tên key
    const savedNodes = localStorage.getItem(`mindnode_nodes_${mapId}`); 
    if (savedNodes) {
      try { return JSON.parse(savedNodes); } catch (e) {}
    }
    return INITIAL_NODES; 
  });

  // KHỞI TẠO CONNECTIONS TỪ LOCAL STORAGE
  const [connections, setConnections] = useState<ConnectionData[]>(() => {
    // Thêm mapId vào tên key
    const savedConnections = localStorage.getItem(`mindnode_connections_${mapId}`); 
    if (savedConnections) {
      try { return JSON.parse(savedConnections); } catch (e) {}
    }
    return INITIAL_CONNECTIONS;
  });
  // const [connections, setConnections] = useState<ConnectionData[]>(INITIAL_CONNECTIONS);
  const [transform, setTransform] = useState<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Core Refs for 60fps DOM manipulation and stale-closure prevention
  const nodesRef = useRef(nodes);
  const transformRef = useRef(transform);
  const editNodeIdRef = useRef(editNodeId);
  // Thêm dòng này ngay dưới chỗ khai báo nodesRef
  const connectionsRef = useRef(connections);
  
  // Thêm dòng này ngay dưới useEffect của nodesRef
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
// Thêm state để biết Line nào đang được chọn
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Thêm state lưu lịch sử (History Stack) cho tính năng Undo
  // const [history, setHistory] = useState<{nodes: MindNodeData[], connections: ConnectionData[]}[]>([]);
  // Tìm dòng useState của history và thay bằng dòng này:
  const [history, setHistory] = useState<{nodes: MindNodeData[], connections: ConnectionData[]}[]>([]);

  // Thêm Refs để đồng bộ state cho sự kiện bàn phím (tránh lỗi stale closure)
  const selectedNodeIdRef = useRef(selectedNodeId);
  const selectedConnIdRef = useRef(selectedConnectionId);

  useEffect(() => { selectedNodeIdRef.current = selectedNodeId; }, [selectedNodeId]);
  useEffect(() => { selectedConnIdRef.current = selectedConnectionId; }, [selectedConnectionId]);
  // TỰ ĐỘNG LƯU NODES MỖI KHI CÓ THAY ĐỔI
  useEffect(() => {
    localStorage.setItem(`mindnode_nodes_${mapId}`, JSON.stringify(nodes));
  }, [nodes, mapId]);

  // TỰ ĐỘNG LƯU CONNECTIONS MỖI KHI CÓ THAY ĐỔI
  useEffect(() => {
    localStorage.setItem(`mindnode_connections_${mapId}`, JSON.stringify(connections));
  }, [connections, mapId]);
  const saveSnapshot = useCallback(() => {
    setHistory(prev => [
      ...prev, 
      {
        // Deep copy để đảm bảo lịch sử không bị tham chiếu chéo
        nodes: JSON.parse(JSON.stringify(nodesRef.current)),
        connections: JSON.parse(JSON.stringify(connectionsRef.current))
      }
    ]);
  }, []);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { transformRef.current = transform; }, [transform]);
  useEffect(() => { editNodeIdRef.current = editNodeId; }, [editNodeId]);
  const nodeLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    
    // 1. Tìm các Node gốc (Root Nodes) - là những Node không có dây nào trỏ tới
    const targetIds = new Set(connections.map(c => c.target));
    const roots = nodes.filter(n => !targetIds.has(n.id));

    // 2. Tạo danh sách kề (Adjacency List) để biết Node cha chỉ tới những Node con nào
    const adjList: Record<string, string[]> = {};
    connections.forEach(c => {
      if (!adjList[c.source]) adjList[c.source] = [];
      adjList[c.source].push(c.target);
    });

    // 3. Duyệt BFS để gán Level
    const queue: { id: string, level: number }[] = roots.map(r => ({ id: r.id, level: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      if (visited.has(id)) continue; // Tránh lặp vô tận nếu người dùng nối vòng tròn
      visited.add(id);

      levels[id] = level;

      if (adjList[id]) {
        adjList[id].forEach(childId => {
          queue.push({ id: childId, level: level + 1 });
        });
      }
    }

    // Đảm bảo mọi Node đều có level (kể cả Node đứng bơ vơ 1 mình)
    nodes.forEach(n => {
      if (levels[n.id] === undefined) levels[n.id] = 0;
    });

    return levels;
  }, [nodes, connections]);
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Không nhận phím tắt nếu người dùng đang gõ chữ trong Node
      if (editNodeIdRef.current) return;

      // 2. Xử lý Ctrl + Z hoặc Cmd + Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        setHistory(prev => {
          if (prev.length === 0) return prev; // Hết lịch sử thì thôi
          
          const newHistory = [...prev];
          const previousState = newHistory.pop(); // Lấy trạng thái gần nhất ra
          
          if (previousState) {
            setNodes(previousState.nodes);
            setConnections(previousState.connections);
            // Xóa vùng chọn để tránh lỗi hiển thị
            setSelectedNodeId(null);
            setSelectedConnectionId(null);
          }
          return newHistory; // Cập nhật lại mảng lịch sử
        });
        return;
      }

      // 3. Xử lý phím Delete hoặc Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const targetNode = selectedNodeIdRef.current;
        const targetConn = selectedConnIdRef.current;

        if (targetNode) {
          saveSnapshot(); // Lưu lịch sử trước khi xóa
          setNodes(prev => prev.filter(n => n.id !== targetNode));
          // Xóa luôn các dây nối liên quan đến Node bị xóa
          setConnections(prev => prev.filter(c => c.source !== targetNode && c.target !== targetNode));
          setSelectedNodeId(null);
        } else if (targetConn) {
          saveSnapshot(); // Lưu lịch sử trước khi xóa
          setConnections(prev => prev.filter(c => c.id !== targetConn));
          setSelectedConnectionId(null);
        }
      }
    };
// Tự động tính toán cấp độ (Level) của từng Node dựa trên Connections
  
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveSnapshot]);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const connRefs = useRef<Record<string, SVGPathElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const tempLineRef = useRef<SVGPathElement | null>(null);

  // Interaction State - Kept in Refs to prevent re-renders on active drag
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  // const draggedNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // Thêm thuộc tính width và height vào Ref
  const draggedNodeRef = useRef<{ id: string; offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const connectingRef = useRef<{ sourceNodeId: string; startX: number; startY: number } | null>(null);
  const resizingNodeRef = useRef<{ id: string; startWidth: number; startHeight: number; startX: number; startY: number } | null>(null);
  // Global Canvas Events
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only process left click
    
    // Fallback Background interactions
    isPanningRef.current = true;
    lastPanPointRef.current = { x: e.clientX, y: e.clientY };
    setSelectedNodeId(null);
    setEditNodeId(null);
    
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Canvas Panning (Relies on React State, usually fast enough for single translate layer)
    if (isPanningRef.current && lastPanPointRef.current) {
      const dx = e.clientX - lastPanPointRef.current.x;
      const dy = e.clientY - lastPanPointRef.current.y;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      lastPanPointRef.current = { x: e.clientX, y: e.clientY };
      return;
    } 
    
    // Hardware-accelerated 60fps Node Dragging (Bypasses React State during move)
    if (draggedNodeRef.current) {
      // Destructure thêm width và height từ Ref đã lưu
      const { id, offsetX, offsetY, width, height } = draggedNodeRef.current; 
      const t = transformRef.current;
      const mappedX = (e.clientX - t.x) / t.scale - offsetX;
      const mappedY = (e.clientY - t.y) / t.scale - offsetY;
      
      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        nodeEl.style.left = `${mappedX}px`;
        nodeEl.style.top = `${mappedY}px`;
        
        // Dynamically recalculate live SVGs
        connections.forEach(conn => {
          if (conn.source !== id && conn.target !== id) return;
          const pathEl = connRefs.current[conn.id];
          if (!pathEl) return;
          
          let x1, y1, x2, y2;
          
          // Determine source position
          if (conn.source === id) {
            x1 = mappedX + width;         // THAY THẾ nodeEl.offsetWidth BẰNG width
            y1 = mappedY + height / 2;    // THAY THẾ nodeEl.offsetHeight BẰNG height
          } else {
            const srcNode = nodesRef.current.find(n => n.id === conn.source);
            x1 = srcNode ? srcNode.x + srcNode.width : 0;
            y1 = srcNode ? srcNode.y + srcNode.height / 2 : 0;
          }
          
          // Determine target position
          if (conn.target === id) {
             x2 = mappedX;
             y2 = mappedY + height / 2;   // THAY THẾ nodeEl.offsetHeight BẰNG height
          } else {
             const tgtNode = nodesRef.current.find(n => n.id === conn.target);
             x2 = tgtNode ? tgtNode.x : 0;
             y2 = tgtNode ? tgtNode.y + tgtNode.height / 2 : 0;
          }
          
          pathEl.setAttribute('d', getPath(x1, y1, x2, y2));
        });
      }
      return;
    }
    // Live Resizing Feature (Hardware-accelerated)
    if (resizingNodeRef.current) {
      const { id, startWidth, startHeight, startX, startY } = resizingNodeRef.current;
      const t = transformRef.current;
      
      // Tính toán độ lệch chuột chia cho mức độ Zoom
      const dx = (e.clientX - startX) / t.scale;
      const dy = (e.clientY - startY) / t.scale;

      // Giới hạn kích thước tối thiểu để khối không bị bóp méo quá nhỏ
      const newWidth = Math.max(150, startWidth + dx);
      const newHeight = Math.max(80, startHeight + dy);

      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        nodeEl.style.width = `${newWidth}px`;
        nodeEl.style.minHeight = `${newHeight}px`;

        // Tính lại đường nối theo kích thước mới
        const mappedX = parseFloat(nodeEl.style.left);
        const mappedY = parseFloat(nodeEl.style.top);

        connections.forEach(conn => {
          if (conn.source !== id && conn.target !== id) return;
          const pathEl = connRefs.current[conn.id];
          if (!pathEl) return;
          
          let x1, y1, x2, y2;
          
          if (conn.source === id) {
            x1 = mappedX + newWidth;
            y1 = mappedY + newHeight / 2;
          } else {
            const srcNode = nodesRef.current.find(n => n.id === conn.source);
            x1 = srcNode ? srcNode.x + srcNode.width : 0;
            y1 = srcNode ? srcNode.y + srcNode.height / 2 : 0;
          }
          
          if (conn.target === id) {
             x2 = mappedX;
             y2 = mappedY + newHeight / 2;
          } else {
             const tgtNode = nodesRef.current.find(n => n.id === conn.target);
             x2 = tgtNode ? tgtNode.x : 0;
             y2 = tgtNode ? tgtNode.y + tgtNode.height / 2 : 0;
          }
          
          pathEl.setAttribute('d', getPath(x1, y1, x2, y2));
        });
      }
      return;
    }
    // Live Connecting Feature
    if (connectingRef.current && tempLineRef.current) {
      const { startX, startY } = connectingRef.current;
      const t = transformRef.current;
      const targetX = (e.clientX - t.x) / t.scale;
      const targetY = (e.clientY - t.y) / t.scale;
      tempLineRef.current.setAttribute('d', getPath(startX, startY, targetX, targetY));
    }
  }, [connections]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    isPanningRef.current = false;
    lastPanPointRef.current = null;
    
    // Re-sync Node back to React State after drag
    if (draggedNodeRef.current) {
      const { id } = draggedNodeRef.current;
      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        const finalX = parseFloat(nodeEl.style.left);
        const finalY = parseFloat(nodeEl.style.top);
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x: finalX, y: finalY } : n));
      }
      draggedNodeRef.current = null;
    }
    // Lưu State khi thả góc Resize
    if (resizingNodeRef.current) {
      const { id } = resizingNodeRef.current;
      const nodeEl = nodeRefs.current[id];
      if (nodeEl) {
        const finalWidth = parseFloat(nodeEl.style.width);
        const finalHeight = parseFloat(nodeEl.style.minHeight);
        
        saveSnapshot(); // Lưu Undo history
        setNodes(prev => prev.map(n => n.id === id ? { ...n, width: finalWidth, height: finalHeight } : n));
      }
      resizingNodeRef.current = null;
    }
    // Finalize Connection logic
    if (connectingRef.current) {
       // Temporarily hide temp line from Pointer Hit Testing
       if (tempLineRef.current) tempLineRef.current.style.display = 'none';
       
       const elements = document.elementsFromPoint(e.clientX, e.clientY);
       const targetNodeEl = elements.find(el => el.hasAttribute('data-node-id'));
       
       if (targetNodeEl) {
           const targetId = targetNodeEl.getAttribute('data-node-id');
           const sourceId = connectingRef.current.sourceNodeId;
           
           if (targetId && targetId !== sourceId) {
               // Update connection globally
               setConnections(prev => {
                   if (prev.some(c => c.source === sourceId && c.target === targetId)) return prev;
                   return [...prev, { id: `c${Date.now()}`, source: sourceId, target: targetId }];
               });
           }
       }
       if (tempLineRef.current) tempLineRef.current.style.display = 'block';
       connectingRef.current = null;
       setIsConnecting(false);
    }
    
    // Release pointer capture
    try {
      containerRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  // Thay thế hàm handleWheel cũ bằng cái này
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Vì passive: false nên gọi preventDefault() thoải mái để chặn trình duyệt tự cuộn/zoom
      e.preventDefault(); 
      
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const t = transformRef.current; // Lấy state mới nhất từ Ref
      const newScale = Math.max(0.1, Math.min(t.scale * scaleFactor, 5));

      const newX = cursorX - (cursorX - t.x) * (newScale / t.scale);
      const newY = cursorY - (cursorY - t.y) * (newScale / t.scale);
      
      setTransform({ x: newX, y: newY, scale: newScale });
    };

    // Đăng ký sự kiện với { passive: false }
    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  // -------------------------------------------------------------
  // Node Specific Callbacks (Fully Memoized)
  // -------------------------------------------------------------

  const handleNodePointerDown = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);

    // If currently editing this node, let it handle text selection natively
    if (editNodeIdRef.current === nodeId) return;

    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    // Đo kích thước thực tế của DOM Node ngay khi vừa bấm chuột
    const nodeEl = nodeRefs.current[nodeId];
    const actualWidth = nodeEl ? nodeEl.offsetWidth : node.width;
    const actualHeight = nodeEl ? nodeEl.offsetHeight : node.height;

    const t = transformRef.current;
    const offsetX = (e.clientX - t.x) / t.scale - node.x;
    const offsetY = (e.clientY - t.y) / t.scale - node.y;
    
    // Lưu width và height vào Ref
    draggedNodeRef.current = { id: nodeId, offsetX, offsetY, width: actualWidth, height: actualHeight };
    
    try {
      // FIX 1: Chuyển quyền capture pointer cho chính cái Node đang được bấm
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditNodeId(nodeId);
  }, []);

  const handleNodeChange = useCallback((id: string, newContent: string) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, content: newContent } : n));
  }, []);

  const handleConnectionStart = useCallback((nodeId: string, e: React.PointerEvent) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    
    const startX = node.x + node.width;
    const startY = node.y + node.height / 2;
    connectingRef.current = { sourceNodeId: nodeId, startX, startY };
    setIsConnecting(true);
    
    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {}
  }, []);
const handleNodeResizeStart = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);

    const node = nodesRef.current.find(n => n.id === nodeId);
    const nodeEl = nodeRefs.current[nodeId];
    if (!node || !nodeEl) return;

    resizingNodeRef.current = {
      id: nodeId,
      startWidth: nodeEl.offsetWidth,
      startHeight: nodeEl.offsetHeight,
      startX: e.clientX,
      startY: e.clientY
    };

    try {
      containerRef.current?.setPointerCapture(e.pointerId);
    } catch {}
  }, []);
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
          content: 'Khái niệm mới...'
      };
      
      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setEditNodeId(newNode.id);
  };

  const renderConnections = () => {
    return connections.map(conn => {
      const source = nodes.find(n => n.id === conn.source);
      const target = nodes.find(n => n.id === conn.target);
      if (!source || !target) return null;

      // Draw from right edge of source to left edge of target
      const x1 = source.x + source.width;
      const y1 = source.y + source.height / 2;
      const x2 = target.x;
      const y2 = target.y + target.height / 2;

      const isSelected = conn.id === selectedConnectionId; // Kiểm tra xem dây có đang được chọn không

      return (
        <path
          key={conn.id}
          ref={el => { connRefs.current[conn.id] = el; }}
          d={getPath(x1, y1, x2, y2)}
          fill="none"
          // Đổi màu Đỏ sáng và làm dày nét nếu được chọn
          stroke={isSelected ? "#EF4444" : "rgba(255,255,255,0.2)"}
          strokeWidth={isSelected ? 4 : 3}
          className="cursor-pointer transition-all hover:stroke-red-400"
          style={{ pointerEvents: 'auto' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setSelectedConnectionId(conn.id); // Chọn dây này
            setSelectedNodeId(null);          // Hủy chọn Khối (Node)
          }}
        />
      );
    });
  };
  const editNode = nodes.find(n => n.id === editNodeId);

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#0F1115] text-[#E0E0E0] select-none"
      style={{
          backgroundImage: 'radial-gradient(#2A2A2A 1px, transparent 1px)',
          backgroundPosition: `${transform.x}px ${transform.y}px`,
          backgroundSize: `${32 * transform.scale}px ${32 * transform.scale}px`
      }}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      // onWheel={handleWheel}
      onDoubleClick={handleBackgroundDoubleClick}
    >
      <div 
        className="absolute inset-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      >
        {/* Connection Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-0">
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

        {/* Distributed Logic Nodes Layer */}
        {nodes.map(node => (
          <EditorNode
            key={node.id}
            ref={el => { nodeRefs.current[node.id] = el; }}
            node={node}
            level={nodeLevels[node.id]} 
            isEditing={editNodeId === node.id}
            isSelected={selectedNodeId === node.id}
            onPointerDown={handleNodePointerDown}
            onDoubleClick={handleNodeDoubleClick}
            onChange={handleNodeChange}
            onConnectionStart={handleConnectionStart}
            onResizeStart={handleNodeResizeStart} // <--- THÊM DÒNG NÀY
          />
        ))}
      </div>

      {editNode && (
        <FloatingToolbar 
          x={editNode.x * transform.scale + transform.x + (editNode.width * transform.scale / 2)}
          y={editNode.y * transform.scale + transform.y - 10}
        />
      )}
      
      {/* HUD Hint Panel */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-[11px] text-white/50 tracking-wide pointer-events-none whitespace-nowrap">
        Double-click background to <span className="text-white">Create Node</span> &bull; Double-click node to <span className="text-white">Edit</span> &bull; Click line to <span className="text-white">Delete</span> &bull; Drag background to <span className="text-white">Pan</span>
      </div>
    </div>
  );
}
