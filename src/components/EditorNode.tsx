import React, { useRef, useEffect, forwardRef, memo } from 'react';
import { MindNodeData } from '../types';

const handleSpaceAutoList = (element: HTMLElement): boolean => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  
  const range = selection.getRangeAt(0);
  const container = range.startContainer;
  
  const text = container.textContent || '';
  const caretOffset = range.startOffset;
  const textBeforeCaret = text.slice(0, caretOffset);
  
  const bulletMatch = textBeforeCaret.match(/^[\-\*•]$/);
  const numberMatch = textBeforeCaret.match(/^1\.$/);
  const alphaMatch = textBeforeCaret.match(/^[a-z]\.$/);
  
  if (bulletMatch || numberMatch || alphaMatch) {
    // Select the prefix text
    const newRange = document.createRange();
    newRange.setStart(container, 0);
    newRange.setEnd(container, caretOffset);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    // Delete it
    document.execCommand('delete', false);
    
    // Trigger formatting
    if (bulletMatch) {
      document.execCommand('insertUnorderedList', false);
    } else {
      document.execCommand('insertOrderedList', false);
      
      if (alphaMatch) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0) {
            let node = sel.getRangeAt(0).startContainer;
            while (node && node !== element) {
              if (node.nodeName === 'OL') {
                (node as HTMLOListElement).setAttribute('type', 'a');
                break;
              }
              node = node.parentNode!;
            }
          }
          // Ensure all OL lists within the canvas editor node are styled alphabetically
          element.querySelectorAll('ol').forEach(ol => {
            ol.setAttribute('type', 'a');
          });
        }, 10);
      }
    }
    return true;
  }
  return false;
};

interface EditorNodeProps {
  node: MindNodeData;
  level: number;
  hasChildren: boolean;     // <--- THÊM DÒNG NÀY: Biết để hiện nút +/-
  isCollapsed: boolean;     // <--- THÊM DÒNG NÀY: Đang đóng hay mở
  isEditing: boolean;
  isSelected: boolean;
  onPointerDown: (nodeId: string, e: React.PointerEvent) => void;
  onDoubleClick: (nodeId: string, e: React.MouseEvent) => void;
  onChange: (id: string, newContent: string) => void;
  onConnectionStart: (nodeId: string, e: React.PointerEvent) => void;
  onResizeStart?: (nodeId: string, e: React.PointerEvent) => void;
  onToggleCollapse: (nodeId: string, e: React.PointerEvent) => void; // <--- THÊM DÒNG NÀY
}

// Helper function to split a DOM element at a specific boundary container and offset
const splitElementAt = (element: HTMLElement, container: Node, offset: number): HTMLElement | null => {
  let splitNode = container;
  if (container.nodeType === Node.TEXT_NODE) {
    const textNode = container as Text;
    splitNode = textNode.splitText(offset);
  }

  const rightElement = element.cloneNode(false) as HTMLElement;
  element.parentNode?.insertBefore(rightElement, element.nextSibling);

  let curr: Node | null = splitNode;
  while (curr) {
    const next: Node | null = curr.nextSibling;
    rightElement.appendChild(curr);
    curr = next;
  }

  return rightElement;
};

// Helper functions to get and set character offset within a contenteditable element
const getSelectionCharacterOffset = (element: HTMLElement) => {
  let start = 0;
  let end = 0;
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    start = preCaretRange.toString().length;
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    end = preCaretRange.toString().length;
  }
  return { start, end };
};

const setSelectionCharacterOffset = (element: HTMLElement, start: number, end: number) => {
  const doc = element.ownerDocument || document;
  const win = doc.defaultView || window;
  const sel = win.getSelection();
  if (!sel) return;

  let charIndex = 0;
  const range = doc.createRange();
  range.setStart(element, 0);
  range.collapse(true);

  const nodeStack: Node[] = [element];
  let node: Node | undefined;
  let foundStart = false;
  let foundEnd = false;

  while ((node = nodeStack.pop()) && !(foundStart && foundEnd)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nextCharIndex = charIndex + node.textContent!.length;
      if (!foundStart && start >= charIndex && start <= nextCharIndex) {
        range.setStart(node, start - charIndex);
        foundStart = true;
      }
      if (!foundEnd && end >= charIndex && end <= nextCharIndex) {
        range.setEnd(node, end - charIndex);
        foundEnd = true;
      }
      charIndex = nextCharIndex;
    } else {
      let i = node.childNodes.length;
      while (i--) {
        nodeStack.push(node.childNodes[i]);
      }
    }
  }

  sel.removeAllRanges();
  sel.addRange(range);
};

export const EditorNode = memo(forwardRef<HTMLDivElement, EditorNodeProps>(({
  node,
  level,
  hasChildren,      // <--- Kéo biến vào
  isCollapsed,
  isEditing,
  isSelected,
  onPointerDown,
  onDoubleClick,
  onChange,
  onConnectionStart,
  onResizeStart,
  onToggleCollapse,// <--- THÊM VÀO ĐÂY
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

  const toggleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    // Tìm kiếm phần tử cha gần nhất có class 'editor-highlight' trong vùng chỉnh sửa này
    const getHighlightAncestor = (node: Node | null): HTMLElement | null => {
      let curr = node;
      while (curr && curr !== contentRef.current) {
        if (curr instanceof HTMLElement && curr.classList.contains('editor-highlight')) {
          return curr;
        }
        curr = curr.parentNode;
      }
      return null;
    };

    // Kiểm tra xem điểm bắt đầu hoặc điểm kết thúc của vùng chọn có nằm trong vùng highlight không
    const highlightSpan = getHighlightAncestor(range.startContainer) || getHighlightAncestor(range.endContainer);

    if (highlightSpan) {
      // TẮT HIGHLIGHT:
      const parent = highlightSpan.parentNode;
      if (parent) {
        if (range.collapsed) {
          // Trường hợp A: Con trỏ nhấp nháy. Chia đôi thẻ span và chèn ZWSP ở giữa
          const rightSpan = splitElementAt(highlightSpan, range.startContainer, range.startOffset);

          const normalText = document.createTextNode('\u200B');
          parent.insertBefore(normalText, rightSpan);

          // Xóa các thẻ rỗng nếu có
          if (highlightSpan.textContent === '' || highlightSpan.textContent === '\u200B') {
            parent.removeChild(highlightSpan);
          }
          if (rightSpan && (rightSpan.textContent === '' || rightSpan.textContent === '\u200B')) {
            parent.removeChild(rightSpan);
          }

          // Đặt con trỏ chuột trực tiếp vào kí tự ZWSP mới tạo ngoài thẻ span
          const sel = window.getSelection();
          if (sel) {
            const newRange = document.createRange();
            newRange.setStart(normalText, 1);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        } else {
          // Trường hợp B: Bôi đen một đoạn chữ. Chia làm 3 phần và unwrap phần giữa
          // 1. Lưu lại vùng chọn hiện tại dưới dạng offset ký tự
          const savedOffset = contentRef.current ? getSelectionCharacterOffset(contentRef.current) : null;

          // Bước 1: Tách phần sau vùng chọn ra trước (chia tại endContainer, endOffset)
          const rightSpan = splitElementAt(highlightSpan, range.endContainer, range.endOffset);

          // Bước 2: Tách phần vùng chọn ra khỏi phần trước (chia tại startContainer, startOffset)
          const midSpan = splitElementAt(highlightSpan, range.startContainer, range.startOffset);

          if (midSpan) {
            // Unwrap midSpan (phần được bôi đen cần bỏ highlight)
            const frag = document.createDocumentFragment();
            while (midSpan.firstChild) {
              frag.appendChild(midSpan.firstChild);
            }
            parent.replaceChild(frag, midSpan);
          }

          // Xóa các thẻ rỗng nếu có
          if (highlightSpan.textContent === '' || highlightSpan.textContent === '\u200B') {
            parent.removeChild(highlightSpan);
          }
          if (rightSpan && (rightSpan.textContent === '' || rightSpan.textContent === '\u200B')) {
            parent.removeChild(rightSpan);
          }

          // Gộp các text node kề nhau để giữ DOM sạch sẽ
          if (parent instanceof HTMLElement) {
            parent.normalize();
          }

          // Khôi phục lại chính xác vị trí con trỏ cho trường hợp bôi đen
          if (contentRef.current && savedOffset) {
            setSelectionCharacterOffset(contentRef.current, savedOffset.start, savedOffset.end);
          }
        }

        // Cập nhật lại state của Node
        if (contentRef.current) {
          onChange(node.id, contentRef.current.innerHTML);
        }
      }
    } else {
      // BẬT HIGHLIGHT: In đậm màu vàng cam hổ phách
      if (range.collapsed) {
        // Nếu chỉ đặt con trỏ (không chọn text), tạo một thẻ span rỗng chứa ký tự zero-width space để giữ con trỏ
        const span = document.createElement('span');
        span.className = 'editor-highlight';
        span.style.color = '#F59E0B';
        span.innerHTML = '&#8203;'; // zero-width space

        range.insertNode(span);

        // Di chuyển con trỏ vào bên trong thẻ span mới tạo
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        // Nếu có chọn text: bọc vùng chọn bằng thẻ span highlight mới
        const span = document.createElement('span');
        span.className = 'editor-highlight';
        span.style.color = '#F59E0B';

        try {
          range.surroundContents(span);
        } catch (e) {
          // Trường hợp vùng chọn đi qua nhiều thẻ HTML khác nhau, dùng extractContents để trích xuất rồi bọc
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }

        // Loại bỏ mọi thẻ highlight con nằm bên trong thẻ vừa tạo để tránh lồng nhau (flatten)
        span.querySelectorAll('.editor-highlight').forEach(el => {
          const p = el.parentNode;
          if (p) {
            const frag = document.createDocumentFragment();
            while (el.firstChild) {
              frag.appendChild(el.firstChild);
            }
            p.replaceChild(frag, el);
          }
        });

        // Bôi đen lại toàn bộ thẻ span vừa tạo
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);

        // Cập nhật lại state của Node
        if (contentRef.current) {
          onChange(node.id, contentRef.current.innerHTML);
        }
      }
    }
  };

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
      className={`absolute bg-[#12141A]/95 backdrop-blur-md rounded-2xl transition-[box-shadow,transform,background-color,border-color,outline] duration-300 group
        ${isEditing ? 'node-editing z-20 cursor-text' : `node-shadow border-[1.5px] ${nodeThemeClass} z-10 cursor-grab hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.6)]`}
        ${isSelected && !isEditing ? 'node-selected z-20' : ''}
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
        <div className="absolute top-2 left-4 flex items-center gap-1.5 select-none pointer-events-none">
          {/* Chấm tròn nhỏ đổi màu theo tầng để tăng độ nhận diện */}
          <div className={`w-1.5 h-1.5 rounded-full ${nodeThemeClass.replace('border-', 'bg-').replace('/60', '').replace('/50', '')}`} />

          {/* Nhãn phân cấp */}
          <span className="text-[9px] font-bold text-white/50 tracking-widest uppercase">
            {level === 0 ? "Chủ đề chính" : `Nhánh cấp ${level}`}
          </span>
        </div>
      )}

      {/* (Giữ nguyên phần EDITING MODE bên dưới) */}
      {isEditing && (
        <div className="absolute top-2 left-4 right-4 text-[10px] font-mono text-blue-400 flex justify-between select-none pointer-events-none">
          <span>EDITING MODE</span>
        </div>
      )}
      {/* --- THÊM KHỐI NÚT TOGGLE COLLAPSE --- */}
      {hasChildren && !isEditing && (
        <div
          // ĐÃ SỬA: Đổi vị trí từ right-[-24px] top-1/2 thành -top-3 -right-3 (Góc trên cùng bên phải)
          className={`absolute -top-3 -right-3 w-5 h-5 flex items-center justify-center rounded-full border-2 cursor-pointer transition-all z-40 hover:scale-125
            ${isCollapsed ? 'bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 'bg-[#25282E] border-white/20 text-white/60 hover:text-white'}
          `}
          onPointerDown={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id, e);
          }}
          title={isCollapsed ? "Mở rộng nhánh" : "Thu gọn nhánh"}
        >
          {/* Dùng SVG vẽ dấu + và - cho sắc nét */}
          {isCollapsed ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 12h14" /></svg>
          )}
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
        className="editor-content outline-none pt-8 pb-4 px-4 w-full h-full text-[#E0E0E0] break-words rounded-xl"
        style={{
          userSelect: isEditing ? 'text' : 'none',
          WebkitUserSelect: isEditing ? 'text' : 'none',
          cursor: isEditing ? 'text' : 'auto'
        }}
        onKeyDown={(e) => {
          if (e.key === ' ') {
            const handled = handleSpaceAutoList(e.currentTarget);
            if (handled) {
              e.preventDefault();
              setTimeout(() => {
                if (contentRef.current) {
                  onChange(node.id, contentRef.current.innerHTML);
                }
              }, 20);
            }
          }
          // Bắt phím tắt Ctrl+B để in đậm thông thường
          else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold', false);
          }
          // Bắt phím tắt Ctrl+H để kích hoạt Highlight in đậm màu vàng
          else if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
            e.preventDefault();
            toggleHighlight();
          }
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
