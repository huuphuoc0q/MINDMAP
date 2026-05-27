import React, { useRef, useEffect, useState } from 'react';
import { LinearNode } from '../utils/outlinerUtils';
import { Trash2, ChevronDown, ChevronRight } from 'lucide-react';

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
          // Ensure all OL lists within the element are styled alphabetically
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

interface OutlinerRowProps {
  item: LinearNode;
  isActive: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onFocus: (id: string) => void;
  onChange: (id: string, newContent: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onDelete: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}

export const OutlinerRow: React.FC<OutlinerRowProps> = ({ item, isActive, hasChildren, isCollapsed, onFocus, onChange, onKeyDown, onDelete, onToggleCollapse }) => {
  const { node, level } = item;
  const contentRef = useRef<HTMLDivElement>(null);

  const DOT_COLORS = [
    'bg-blue-500',      // Cấp 0
    'bg-emerald-500',   // Cấp 1
    'bg-purple-500',    // Cấp 2
    'bg-orange-500',    // Cấp 3
    'bg-pink-500'       // Cấp 4
  ];
  const dotColor = DOT_COLORS[level % DOT_COLORS.length];

  // Helper functions for highlight toggle
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

  const getSelectionCharacterOffset = (element: HTMLElement) => {
    let start = 0, end = 0;
    const sel = window.getSelection();
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
    const sel = window.getSelection();
    if (!sel) return;
    let charIndex = 0;
    const range = document.createRange();
    range.setStart(element, 0);
    range.collapse(true);
    const nodeStack: Node[] = [element];
    let node: Node | undefined;
    let foundStart = false, foundEnd = false;
    
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
        while (i--) nodeStack.push(node.childNodes[i]);
      }
    }
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // Sync content from store ONLY when not active to preserve native undo/redo stack
  useEffect(() => {
    if (contentRef.current && !isActive) {
      if (contentRef.current.innerHTML !== node.content) {
        contentRef.current.innerHTML = node.content;
      }
    }
  }, [node.content, isActive]);

  useEffect(() => {
    if (isActive && contentRef.current) {
      contentRef.current.focus();
      
      // Move cursor to the end
      if (typeof window !== 'undefined') {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(contentRef.current);
        range.collapse(false); // false means collapse to end
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isActive]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(node.id, e.currentTarget.innerHTML);
  };

  const toggleHighlight = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    const getHighlightAncestor = (node: Node | null): HTMLElement | null => {
      let curr = node;
      while (curr && curr !== contentRef.current) {
        if (curr instanceof HTMLElement && curr.classList.contains('editor-highlight')) return curr;
        curr = curr.parentNode;
      }
      return null;
    };

    const highlightSpan = getHighlightAncestor(range.startContainer) || getHighlightAncestor(range.endContainer);

    if (highlightSpan) {
      // TẮT HIGHLIGHT
      const parent = highlightSpan.parentNode;
      if (parent) {
        if (range.collapsed) {
          const rightSpan = splitElementAt(highlightSpan, range.startContainer, range.startOffset);
          const normalText = document.createTextNode('\u200B');
          parent.insertBefore(normalText, rightSpan);
          if (highlightSpan.textContent === '' || highlightSpan.textContent === '\u200B') parent.removeChild(highlightSpan);
          if (rightSpan && (rightSpan.textContent === '' || rightSpan.textContent === '\u200B')) parent.removeChild(rightSpan);
          
          const sel = window.getSelection();
          if (sel) {
            const newRange = document.createRange();
            newRange.setStart(normalText, 1);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        } else {
          const savedOffset = contentRef.current ? getSelectionCharacterOffset(contentRef.current) : null;
          const rightSpan = splitElementAt(highlightSpan, range.endContainer, range.endOffset);
          const midSpan = splitElementAt(highlightSpan, range.startContainer, range.startOffset);
          
          if (midSpan) {
            const frag = document.createDocumentFragment();
            while (midSpan.firstChild) frag.appendChild(midSpan.firstChild);
            parent.replaceChild(frag, midSpan);
          }
          
          if (highlightSpan.textContent === '' || highlightSpan.textContent === '\u200B') parent.removeChild(highlightSpan);
          if (rightSpan && (rightSpan.textContent === '' || rightSpan.textContent === '\u200B')) parent.removeChild(rightSpan);
          if (parent instanceof HTMLElement) parent.normalize();
          
          if (contentRef.current && savedOffset) {
            setSelectionCharacterOffset(contentRef.current, savedOffset.start, savedOffset.end);
          }
        }
      }
    } else {
      // BẬT HIGHLIGHT
      if (range.collapsed) {
        const span = document.createElement('span');
        span.className = 'editor-highlight';
        span.style.color = '#F59E0B';
        span.style.fontWeight = 'bold';
        span.innerHTML = '&#8203;';
        range.insertNode(span);
        const newRange = document.createRange();
        newRange.setStart(span.firstChild!, 1);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        const span = document.createElement('span');
        span.className = 'editor-highlight';
        span.style.color = '#F59E0B';
        span.style.fontWeight = 'bold';
        try {
          range.surroundContents(span);
        } catch (e) {
          const content = range.extractContents();
          span.appendChild(content);
          range.insertNode(span);
        }
        
        span.querySelectorAll('.editor-highlight').forEach(el => {
          const p = el.parentNode;
          if (p) {
            const frag = document.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            p.replaceChild(frag, el);
          }
        });
        
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }
    
    if (contentRef.current) {
      onChange(node.id, contentRef.current.innerHTML);
    }
  };

  useEffect(() => {
    const handleGlobalHighlight = () => {
      if (isActive) toggleHighlight();
    };
    window.addEventListener('outliner-toggle-highlight', handleGlobalHighlight);
    return () => window.removeEventListener('outliner-toggle-highlight', handleGlobalHighlight);
  }, [isActive]);

  return (
    <div className="relative group flex items-start py-1 px-2" style={{ paddingLeft: `${level * 24 + 16}px` }}>
      {/* Indent Guides */}
      {Array.from({ length: level }).map((_, i) => (
        <div 
          key={i} 
          className="absolute top-0 bottom-0 border-l border-white/10" 
          style={{ left: `${i * 24 + 26}px` }} 
        />
      ))}

      <div className="flex items-center gap-1 w-full relative z-10 group/row">
        {/* Collapse Toggle */}
        <div className="w-4 h-4 shrink-0 flex items-center justify-center">
          {hasChildren && (
            <div 
              onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
              className="cursor-pointer text-white/30 hover:text-white transition-colors"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
        </div>
        
        <div className={`w-2 h-2 rounded-full shrink-0 mr-1 ${dotColor} shadow-[0_0_8px_currentColor] opacity-80 ${isCollapsed ? 'ring-2 ring-white/20' : ''}`} />
        <div className={`flex-1 relative rounded-lg transition-shadow border border-transparent ${isActive ? 'shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-blue-500/10 border-blue-500/30' : 'hover:bg-white/5 border-white/5 bg-black/20'}`}>
          <div
            ref={contentRef}
            contentEditable
            data-row-id={node.id}
            onInput={handleInput}
            onFocus={() => onFocus(node.id)}
            onKeyDown={(e) => {
              if (e.key === ' ') {
                const handled = handleSpaceAutoList(e.currentTarget);
                if (handled) {
                  e.preventDefault();
                  setTimeout(() => {
                    onChange(node.id, e.currentTarget.innerHTML);
                  }, 20);
                }
              } else if (e.key === 'Enter' && !e.shiftKey) {
                // Check if selection is currently inside a list item (LI) element
                const selection = window.getSelection();
                let isInLI = false;
                if (selection && selection.rangeCount > 0) {
                  let selNode: Node | null = selection.getRangeAt(0).startContainer;
                  while (selNode && selNode !== e.currentTarget) {
                    if (selNode.nodeName === 'LI') {
                      isInLI = true;
                      break;
                    }
                    selNode = selNode.parentNode;
                  }
                }

                if (isInLI) {
                  // Let browser handle LI enter key natively (creates new LI in the same list).
                  // Sync changes to store after DOM updates.
                  setTimeout(() => {
                    onChange(node.id, e.currentTarget.innerHTML);
                  }, 20);
                } else {
                  // Standard behavior: create a new sibling Outliner row node
                  e.preventDefault();
                  onKeyDown(e, node.id);
                }
              } else if (e.key === 'Tab' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                onKeyDown(e, node.id);
              } else if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                document.execCommand('bold', false);
              } else if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'e')) {
                e.preventDefault();
                toggleHighlight();
              }
            }}
            className={`editor-content w-full min-h-[40px] px-4 py-3 text-sm outline-none break-words [&>b]:text-white ${
              level === 0 ? 'text-lg text-white/90' : 
              level === 1 ? 'text-base text-white/80' : 'text-sm text-white/70'
            }`}
          />
        </div>
        
        {/* Trash icon */}
        <div 
          onClick={() => onDelete(node.id)}
          className={`opacity-0 group-hover/row:opacity-100 flex items-center justify-center w-8 h-8 text-white/30 hover:text-red-400 hover:bg-red-500/10 cursor-pointer rounded-lg transition-all absolute right-2 ${isActive ? 'opacity-100' : ''}`}
        >
          <Trash2 size={16} />
        </div>
      </div>
    </div>
  );
};
