import React, { useMemo, useState, useEffect } from 'react';
import { useMindMapStore } from '../store/useMindMapStore';
import { buildLinearTree, indentNodeInGraph, outdentNodeInGraph, insertNodeGraph } from '../utils/outlinerUtils';
import { OutlinerRow } from './OutlinerRow';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';

export const OutlinerPanel: React.FC = () => {
  const nodes = useMindMapStore(state => state.nodes);
  const connections = useMindMapStore(state => state.connections);
  const outlinerSync = useMindMapStore(state => state.outlinerSync);
  const autoLayout = useMindMapStore(state => state.autoLayout);
  const toggleOutliner = useMindMapStore(state => state.toggleOutliner);

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set());
  const [showListMenu, setShowListMenu] = useState(false);

  // Derive the tree whenever nodes or connections change
  const linearTree = useMemo(() => {
    return buildLinearTree(nodes, connections);
  }, [nodes, connections]);

  const { visibleTree, hasChildrenMap } = useMemo(() => {
    const visible = [];
    const childrenMap = new Map();

    let skipUntilLevel = -1;

    for (let i = 0; i < linearTree.length; i++) {
      const item = linearTree[i];

      const hasChildren = i < linearTree.length - 1 && linearTree[i + 1].level > item.level;
      childrenMap.set(item.node.id, hasChildren);

      if (skipUntilLevel !== -1 && item.level > skipUntilLevel) {
        continue;
      }
      if (skipUntilLevel !== -1 && item.level <= skipUntilLevel) {
        skipUntilLevel = -1;
      }

      if (localCollapsed.has(item.node.id)) {
        skipUntilLevel = item.level;
      }

      visible.push(item);
    }

    return { visibleTree: visible, hasChildrenMap: childrenMap };
  }, [linearTree, localCollapsed]);

  // Set initial focus if not set
  useEffect(() => {
    if (!activeNodeId && visibleTree.length > 0) {
      setActiveNodeId(visibleTree[0].node.id);
    }
  }, [visibleTree, activeNodeId]);

  const handleFocus = (id: string) => {
    setActiveNodeId(id);
  };

  const handleChange = (id: string, newContent: string) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, content: newContent } : n);
    outlinerSync(newNodes, connections);
    // Don't autoLayout on text change, just save it.
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const newNodeId = `n_${Date.now()}`;
      // Calculate a rough position, autoLayout will fix it
      const currentNode = nodes.find(n => n.id === id);
      const newNode = {
        id: newNodeId,
        x: (currentNode?.x || 0) + 20,
        y: (currentNode?.y || 0) + 100,
        width: 250,
        height: 80,
        content: ''
      };

      const newNodes = [...nodes];
      const nodeIndex = newNodes.findIndex(n => n.id === id);
      if (nodeIndex >= 0) {
        newNodes.splice(nodeIndex + 1, 0, newNode);
      } else {
        newNodes.push(newNode);
      }

      const newConnections = insertNodeGraph(id, newNode, linearTree, connections);

      outlinerSync(newNodes, newConnections);
      setTimeout(() => autoLayout({}), 10);

      // Let React render the new node, then focus it
      setTimeout(() => setActiveNodeId(newNodeId), 50);

    } else if (e.key === 'Tab') {
      e.preventDefault();

      if (e.shiftKey) {
        // Outdent
        const newConnections = outdentNodeInGraph(id, linearTree, connections);
        if (newConnections !== connections) {
          outlinerSync(nodes, newConnections);
          setTimeout(() => autoLayout({}), 10);
        }
      } else {
        // Indent
        const newConnections = indentNodeInGraph(id, linearTree, connections);
        if (newConnections !== connections) {
          outlinerSync(nodes, newConnections);
          setTimeout(() => autoLayout({}), 10);
        }
      }
    } else if (e.key === 'ArrowUp') {
      const idx = linearTree.findIndex(n => n.node.id === id);
      if (idx > 0) {
        e.preventDefault();
        setActiveNodeId(linearTree[idx - 1].node.id);
      }
    } else if (e.key === 'ArrowDown') {
      const idx = linearTree.findIndex(n => n.node.id === id);
      if (idx >= 0 && idx < linearTree.length - 1) {
        e.preventDefault();
        setActiveNodeId(linearTree[idx + 1].node.id);
      }
    }
  };

  const handleDelete = (id: string) => {
    // Cannot delete the last node
    if (nodes.length <= 1) return;

    // Find index to focus on next
    const idx = linearTree.findIndex(n => n.node.id === id);
    if (idx >= 0) {
      const nextId = visibleTree[idx - 1]?.node.id || visibleTree[idx + 1]?.node.id || visibleTree[0]?.node.id;
      setActiveNodeId(nextId);
    }

    const newNodes = nodes.filter(n => n.id !== id);
    const newConnections = connections.filter(c => c.source !== id && c.target !== id);

    outlinerSync(newNodes, newConnections);
    setTimeout(() => autoLayout({}), 10);
  };

  const handleToggleCollapse = (id: string) => {
    setLocalCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyFormat = (command: string, value?: string) => {
    if (command === 'highlight') {
      window.dispatchEvent(new CustomEvent('outliner-toggle-highlight'));
      return;
    }

    if (command === 'insertAlphabeticalList') {
      document.execCommand('insertOrderedList', false, value);
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        let node = selection.getRangeAt(0).startContainer;
        while (node && node !== document.body) {
          if (node.nodeName === 'OL') {
            (node as HTMLOListElement).setAttribute('type', 'a');
            break;
          }
          node = node.parentNode!;
        }
      }
    } else {
      document.execCommand(command, false, value);
    }

    // Trigger onChange for formatting commands too
    if (activeNodeId) {
      setTimeout(() => {
        const rowDiv = document.querySelector(`[data-row-id="${activeNodeId}"]`) as HTMLElement;
        if (rowDiv) {
          handleChange(activeNodeId, rowDiv.innerHTML);
        }
      }, 0);
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-[#0A0A0A] flex flex-col z-[40] transition-all">
      {/* Elegant Header */}
      <div className="pt-8 px-10 pb-6 flex items-center justify-between shrink-0 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/5 flex items-center justify-center text-blue-400 shadow-inner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
          <h2 className="text-xl font-heading font-medium text-white/90 tracking-tight">Biên soạn Đề cương</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-white/50 bg-white/5 px-3 py-1.5 rounded-md border border-white/5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/80 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
            {linearTree.length} khối
          </div>

          <div className="w-px h-5 bg-white/10 mx-1"></div>

          <button
            onClick={toggleOutliner}
            className="group flex items-center gap-2 px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-sm font-medium rounded-md border border-white/10 transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 group-hover:text-blue-300 transition-colors">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Render MindMap
          </button>
        </div>
      </div>

      {/* 
        [&::-webkit-scrollbar]:hidden hides the scrollbar but keeps it scrollable 
      */}
      <div className="flex-1 overflow-y-auto px-8 pb-20 max-w-5xl mx-auto w-full [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
        <div className="space-y-4 mt-4">
          {visibleTree.map((item, index) => (
            <OutlinerRow
              key={item.node.id}
              item={item}
              isActive={activeNodeId === item.node.id}
              hasChildren={hasChildrenMap.get(item.node.id) || false}
              isCollapsed={localCollapsed.has(item.node.id)}
              onFocus={handleFocus}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onDelete={handleDelete}
              onToggleCollapse={handleToggleCollapse}
            />
          ))}
        </div>
      </div>

      {/* Sticky Bottom Formatting Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1A1C21]/95 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] z-50">
        <button onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="In đậm (Ctrl+B)">
          <Bold size={18} />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="In nghiêng (Ctrl+I)">
          <Italic size={18} />
        </button>
        <button onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="Gạch chân (Ctrl+U)">
          <Underline size={18} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-2" />
        
        <div className="relative">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setShowListMenu(!showListMenu);
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all cursor-pointer ${
              showListMenu 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title="Đánh danh sách nội dung"
          >
            <List size={18} />
          </button>

          {showListMenu && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-2 bg-[#12141A]/95 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-xl flex flex-col gap-1 w-48 z-50 animate-fade-in">
              {[
                { id: 'insertUnorderedList', label: 'Danh sách Chấm tròn (•)', icon: <List size={14} className="text-emerald-400" /> },
                { id: 'insertOrderedList', label: 'Danh sách Số (1.)', icon: <ListOrdered size={14} className="text-purple-400" /> },
                { id: 'insertAlphabeticalList', label: 'Danh sách Chữ cái (a.)', icon: <ListOrdered size={14} className="text-pink-400" /> },
              ].map((style) => (
                <button
                  key={style.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyFormat(style.id);
                    setShowListMenu(false);
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-left text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                >
                  {style.icon}
                  <span>{style.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
