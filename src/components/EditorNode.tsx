import React, { useRef, useEffect, forwardRef, memo } from 'react';
import { MindNodeData } from '../types';

interface EditorNodeProps {
  node: MindNodeData;
  level: number;
  isEditing: boolean;
  isSelected: boolean;
  onPointerDown: (nodeId: string, e: React.PointerEvent) => void;
  onDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  onChange: (id: string, newContent: string) => void;
  onConnectionStart: (nodeId: string, e: React.PointerEvent) => void;
  // THÊM DÒNG NÀY:
  onResizeStart: (nodeId: string, e: React.PointerEvent) => void; 
}

export const EditorNode = memo(forwardRef<HTMLDivElement, EditorNodeProps>(({
  node,
  level, 
  isEditing,
  isSelected,
  onPointerDown,
  onDoubleClick,
  onChange,
  onConnectionStart,
  onResizeStart, // <--- THÊM VÀO ĐÂY
}, ref) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(isEditing);
  const BORDER_COLORS = [
      'border-blue-500/60',   // Root: Xanh dương
      'border-emerald-500/50',// Tầng 1: Xanh ngọc
      'border-purple-500/50', // Tầng 2: Tím
      'border-orange-500/50', // Tầng 3: Cam
      'border-pink-500/50',   // Tầng 4: Hồng
    ];
  
  // Lấy màu tương ứng (nếu sâu hơn 4 tầng thì lặp lại màu)
  const nodeThemeClass = BORDER_COLORS[level % BORDER_COLORS.length];
  // Sync Content when changing between editing and read-only modes
  useEffect(() => {
    // Transitioning into edit mode -> Focus and place cursor at the end
    if (!isEditingRef.current && isEditing) {
      if (contentRef.current) {
        contentRef.current.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        if (contentRef.current.childNodes.length > 0) {
            range.selectNodeContents(contentRef.current);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
      }
    }
    
    // Transitioning out of edit mode -> Save the new HTML back to Canvas state
    if (isEditingRef.current && !isEditing) {
      if (contentRef.current && contentRef.current.innerHTML !== node.content) {
        onChange(node.id, contentRef.current.innerHTML);
      }
    }
    
    isEditingRef.current = isEditing;
  }, [isEditing, node.content, onChange, node.id]);

  // Handle external synchronization: Only push prop content to DOM when NOT in edit mode
  // This solves the React ContentEditable IME issue where state updates destroy text composition
  useEffect(() => {
    if (contentRef.current && !isEditing) {
      if (contentRef.current.innerHTML !== node.content) {
        contentRef.current.innerHTML = node.content;
      }
    }
  }, [node.content, isEditing]);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Chặn sự kiện truyền tải ra Canvas (để chặn hành vi Pan không mong muốn khi click Node)
    e.stopPropagation();
    
    // Nếu ĐANG ở trạng thái chỉnh sửa, KHÔNG gọi onPointerDown của node
    // để Trình duyệt có không gian ưu tiên xử lý việc Bôi đen văn bản (Text Selection)
    if (!isEditing) {
      onPointerDown(node.id, e);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDoubleClick(node.id, e);
  };

  const handleConnectionStart = (e: React.PointerEvent) => {
      e.stopPropagation();
      onConnectionStart(node.id, e);
  };

  return (
    <div
      ref={ref}
      data-node-id={node.id}
      // SỬA Ở DÒNG NÀY: Xóa transition-all, đổi thành transition-shadow
      className={`absolute bg-[#1A1C21] rounded-xl transition-shadow duration-200 group
        ${isEditing ? 'node-editing ring-1 ring-blue-500/50 z-20 cursor-text' : `node-shadow border-2 ${nodeThemeClass} z-10 cursor-grab hover:shadow-2xl`}
        ${isSelected && !isEditing ? 'ring-2 ring-white/50' : ''}
      `}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
        // Block touch panning while allowing interacting with standard UI
        touchAction: isEditing ? 'auto' : 'none'
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Node Header */}
      {!isEditing && (
        <div className="absolute top-2 left-4 text-[10px] font-mono text-white/30 tracking-tight select-none pointer-events-none">
          ID: {node.id.toUpperCase()}
        </div>
      )}
      {isEditing && (
        <div className="absolute top-2 left-4 right-4 text-[10px] font-mono text-blue-400 flex justify-between select-none pointer-events-none">
          <span>EDITING MODE</span>
        </div>
      )}

      {/* Output Node Connection Handle */}
      {!isEditing && (
        <div 
          className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-3 bg-[#1A1C21] border-2 border-green-500 rounded-full cursor-crosshair hover:scale-150 hover:bg-green-500 transition-all z-30 touch-none"
          onPointerDown={handleConnectionStart}
          title="Drag to connect"
        />
      )}

      <div
        ref={contentRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        className="outline-none pt-8 pb-4 px-4 w-full h-full text-[#E0E0E0] break-words rounded-xl"
        style={{
          userSelect: isEditing ? 'text' : 'none',
          WebkitUserSelect: isEditing ? 'text' : 'none',
          cursor: isEditing ? 'text' : 'auto'
        }}
        onPaste={(e) => {
          e.preventDefault(); // Chặn hành vi dán nguyên bản (kèm HTML/CSS) của trình duyệt
          
          // Trích xuất văn bản thuần (plain text) từ bộ nhớ tạm
          const text = e.clipboardData.getData('text/plain');
          
          // Chèn văn bản thuần vào vị trí con trỏ hiện tại
          document.execCommand('insertText', false, text);
        }}
      />
      
      {!isEditing && (
        <div
          className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize flex items-end justify-end p-1 rounded-br-xl z-30 opacity-0 group-hover:opacity-100 transition-opacity"
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(node.id, e);
          }}
        >
          {/* Vẽ 2 đường gạch chéo nhỏ ở góc */}
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
            <path d="M 8 2 L 8 8 L 2 8 M 5 5 L 5 8 L 2 8" />
          </svg>
        </div>
      )}
    </div>
  );
}));

EditorNode.displayName = 'EditorNode';
