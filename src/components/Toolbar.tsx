import { Bold, Italic, Underline, List, Type, Heading } from 'lucide-react'; // THÊM Heading ở đây
import { useRef, useState } from 'react';
interface FloatingToolbarProps {
  x: number;
  y: number;
}

const COLORS = ['#000000', '#EF4444', '#3B82F6', '#F4F4F4', '#F59E0B', '#8B5CF6'];
const TEXT_SIZES = [
  { label: 'Nhỏ', value: '2' },
  { label: 'Thường', value: '3' },
  { label: 'Tiêu đề nhánh', value: '5' },
  { label: 'Tiêu đề lớn', value: '6' },
];
export function FloatingToolbar({ x, y }: FloatingToolbarProps) {
  const [showColors, setShowColors] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const applyCommand = (command: string, value: string | undefined = undefined) => {
    // Ép trình duyệt dùng style CSS hiện đại cho cả màu và cỡ chữ
    if (command === 'foreColor' || command === 'fontSize') {
      document.execCommand('styleWithCSS', false, 'true');
    }

    document.execCommand(command, false, value);
    
    if (command === 'foreColor') setShowColors(false);
    if (command === 'fontSize') setShowSizes(false); // Đóng menu size sau khi chọn
  };

  // Prevent toolbar clicks from blurring the editor and losing selection
  // const handleMouseDown = (e: React.MouseEvent) => {
  //   e.preventDefault();
  // };
// Đổi tên và thêm stopPropagation
  const handleToolbarInteraction = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault(); // Giữ nguyên vùng bôi đen chữ
    e.stopPropagation(); // CỰC KỲ QUAN TRỌNG: Chặn sự kiện lan ra ngoài Canvas
  };
  return (
    <div
      className="absolute z-50 flex items-center px-1 gap-1 h-10 bg-[#25282E] rounded-lg border border-white/10 shadow-2xl will-change-transform"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -100%) translateY(-12px)',
      }}
      onMouseDown={handleToolbarInteraction}
      onPointerDown={handleToolbarInteraction}
    >
      <button
        type="button"
        onClick={() => applyCommand('bold')}
        className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        onClick={() => applyCommand('italic')}
        className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        onClick={() => applyCommand('underline')}
        className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Underline"
      >
        <Underline size={16} />
      </button>
      
      <div className="w-px h-4 mx-1 bg-white/10" />
      
      <div className="relative flex items-center">
        <button
          type="button"
          // Đổi từ onClick sang onMouseDown
          onMouseDown={(e) => {
            e.preventDefault(); 
            e.stopPropagation();
            setShowColors(!showColors);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Text Color"
        >
          <Type size={16} />
        </button>

        {showColors && (
          <div
            ref={colorPickerRef}
            // Đã thêm: w-max, left-1/2, -translate-x-1/2, z-50
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-[#25282E] border border-white/10 shadow-2xl rounded-md grid grid-cols-3 gap-2 w-max z-50"
          >
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation(); // Thêm dòng này
                  applyCommand('foreColor', color);
                }}
                onPointerDown={(e) => e.stopPropagation()} // Thêm dòng này
                title={color}
              />
            ))}
          </div>
        )}
      </div>
<div className="relative flex items-center">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); 
            e.stopPropagation();
            setShowSizes(!showSizes);
            setShowColors(false); // Tự đóng bảng màu nếu đang mở
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
          title="Text Size"
        >
          <Heading size={16} />
        </button>

        {showSizes && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 py-1 bg-[#25282E] border border-white/10 shadow-2xl rounded-md flex flex-col w-32 z-50 overflow-hidden"
          >
            {TEXT_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                className="w-full px-3 py-1.5 text-xs text-left text-white/80 hover:bg-white/10 hover:text-white transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  applyCommand('fontSize', size.value);
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {size.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="w-px h-4 mx-1 bg-white/10" />

      <button
        type="button"
        onClick={() => applyCommand('insertUnorderedList')}
        className="w-8 h-8 rounded text-white flex items-center justify-center hover:bg-white/10 transition-colors"
        title="Bullet List"
      >
        <List size={16} />
      </button>
    </div>
  );
}
