// // /**
// //  * @license
// //  * SPDX-License-Identifier: Apache-2.0
// //  */

// // import { Canvas } from './components/Canvas';

// // export default function App() {
// //   return (
// //     <div className="flex flex-col h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans overflow-hidden">
// //       <nav className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0F1115] shrink-0">
// //         <div className="flex items-center gap-4">
// //           <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">M</div>
// //           <h1 className="text-lg font-semibold tracking-tight text-white">MindNode Canvas <span className="text-xs font-normal text-white/40 ml-2">v2.4.0</span></h1>
// //         </div>
// //         <div className="flex gap-2">
// //           <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs flex items-center gap-2 text-white">
// //             <div className="w-2 h-2 rounded-full bg-green-500"></div> Runtime: Active
// //           </div>
// //           <button className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors">Export Canvas</button>
// //         </div>
// //       </nav>

// //       <div className="flex flex-1 min-h-0">
// //         {/* <aside className="w-80 bg-[#141416]/80 backdrop-blur-md border-r border-white/10 flex flex-col shrink-0">
// //           <div className="p-5 space-y-6">
// //             <div>
// //               <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4 italic">Architecture Strategy</h3>
// //               <div className="space-y-4">
// //                 <div className="p-3 bg-white/5 rounded-lg border border-white/5">
// //                   <div className="text-xs font-semibold text-blue-400 mb-1">Event Propagation Layer</div>
// //                   <p className="text-[11px] text-white/60 leading-relaxed">
// //                     Uses <strong>Propagation Stop-Loss</strong> pattern. While in <code>isEditing</code> state, <code>onMouseDown</code> is captured by the editor instance to allow text selection, bypassing the Canvas Drag Listener.
// //                   </p>
// //                 </div>
// //                 <div className="p-3 bg-white/5 rounded-lg border border-white/5">
// //                   <div className="text-xs font-semibold text-blue-400 mb-1">WYSIWYG Integration</div>
// //                   <p className="text-[11px] text-white/60 leading-relaxed">
// //                     Each node encapsulates a headless Tiptap or Lexical instance. Content is stored as Delta or HTML strings within the Node schema.
// //                   </p>
// //                 </div>
// //               </div>
// //             </div>
// //             <div>
// //               <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4 italic">JSON State Schema</h3>
// //               <pre className="text-[10px] font-mono bg-black/40 p-3 rounded-lg border border-white/5 overflow-hidden text-blue-300">
// // {`{
// //   "nodes": [
// //     {
// //       "id": "node_01",
// //       "type": "rich-text",
// //       "pos": { "x": 420, "y": 180 },
// //       "data": {
// //         "html": "<p>Draft...</p>",
// //         "version": 2
// //       }
// //     }
// //   ]
// // }`}
// //               </pre>
// //             </div>
// //           </div>
// //           <div className="mt-auto p-5 border-t border-white/5 bg-black/20">
// //             <div className="flex justify-between text-[10px] text-white/40 font-mono">
// //               <span>ZOOM: 100%</span>
// //               <span>NODES: 12</span>
// //               <span>LATENCY: 4ms</span>
// //             </div>
// //           </div>
// //         </aside> */}
// //         <main className="relative flex-1 cursor-grab active:cursor-grabbing bg-[#0F1115]">
// //           <Canvas />
// //         </main>
// //       </div>
// //     </div>
// //   );
// // }
// import { useState } from 'react';
// import { Canvas } from './components/Canvas';
// import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
// import { saveAs } from 'file-saver';
// import { MindNodeData, ConnectionData } from './types';

// export default function App() {
//   const [isExporting, setIsExporting] = useState(false);

//   const handleExportWord = async () => {
//     setIsExporting(true);
    
//     try {
//       // 1. Lấy dữ liệu mới nhất từ localStorage
//       const savedNodes = localStorage.getItem('mindnode_nodes');
//       const savedConns = localStorage.getItem('mindnode_connections');

//       if (!savedNodes) {
//         alert("Không có dữ liệu sơ đồ để xuất!");
//         setIsExporting(false);
//         return;
//       }

//       const nodes: MindNodeData[] = JSON.parse(savedNodes);
//       const connections: ConnectionData[] = savedConns ? JSON.parse(savedConns) : [];

//       // 2. Thuật toán phân cấp và sắp xếp theo chiều sâu (DFS)
//       const targetIds = new Set(connections.map(c => c.target));
//       const roots = nodes.filter(n => !targetIds.has(n.id)); // Tìm các Node gốc

//       const adjList: Record<string, string[]> = {};
//       connections.forEach(c => {
//         if (!adjList[c.source]) adjList[c.source] = [];
//         adjList[c.source].push(c.target);
//       });

//       const orderedNodes: { node: MindNodeData, level: number }[] = [];
//       const visited = new Set<string>();

//       // Hàm đệ quy duyệt nhánh DFS
//       const dfs = (nodeId: string, currentLevel: number) => {
//         if (visited.has(nodeId)) return;
//         visited.add(nodeId);

//         const node = nodes.find(n => n.id === nodeId);
//         if (node) {
//           orderedNodes.push({ node, level: currentLevel });
//         }

//         if (adjList[nodeId]) {
//           adjList[nodeId].forEach(childId => {
//             dfs(childId, currentLevel + 1);
//           });
//         }
//       };

//       // Chạy DFS từ các Node gốc
//       roots.forEach(r => dfs(r.id, 0));

//       // Xử lý nốt các Node bị mồ côi (không nối với ai)
//       nodes.forEach(n => {
//         if (!visited.has(n.id)) dfs(n.id, 0);
//       });

//       // 3. Xây dựng cấu trúc file Word
//       // 3. Xây dựng cấu trúc file Word có ĐỊNH DẠNG RÕ RÀNG
//       const docParagraphs: Paragraph[] = [];

//       orderedNodes.forEach(({ node, level }) => {
//         // Dọn dẹp thẻ HTML
//         const cleanText = node.content
//           .replace(/<br\s*\/?>/gi, '\n')
//           .replace(/<\/div>|<\/p>/gi, '\n')
//           .replace(/<[^>]*>/g, '')
//           .replace(/&nbsp;/g, ' ')
//           .trim();

//         if (!cleanText) return;

//         // Tùy chỉnh Font, Size, Trọng lượng chữ theo từng Level
//         const isBold = level < 3;
//         const isItalic = level === 2;
//         let fontSize = 24; // Mặc định 12pt (docx tính bằng half-point: 12 * 2 = 24)
//         let color = "000000"; // Đen mặc định

//         if (level === 0) {
//           fontSize = 32; // 16pt cho Node gốc
//           color = "1E3A8A"; // Màu xanh dương đậm
//         } else if (level === 1) {
//           fontSize = 28; // 14pt cho nhánh cấp 1
//           color = "374151"; // Màu xám đậm
//         } else if (level === 2) {
//           fontSize = 24; // 12pt cho nhánh cấp 2
//           color = "4B5563"; // Màu xám
//         }

//         // Tạo chuỗi văn bản với định dạng đã thiết lập
//         const textRuns = cleanText.split('\n').map((line, index) => 
//           new TextRun({ 
//             text: line, 
//             break: index > 0 ? 1 : 0,
//             bold: isBold,
//             italics: isItalic,
//             size: fontSize,
//             color: color,
//             font: "Arial" // Ép dùng font Arial cho hiện đại, dễ đọc
//           })
//         );

//         // Cấu hình đoạn văn (Paragraph) kèm theo khoảng cách (Spacing) cho dễ nhìn
//         let paragraphConfig: any = {
//           children: textRuns,
//           // Khoảng cách trên/dưới để các đoạn không bị dính chùm vào nhau
//           spacing: { before: level === 0 ? 400 : 200, after: 120 } 
//         };

//         if (level === 0) {
//           paragraphConfig.heading = HeadingLevel.HEADING_1;
//         } else if (level === 1) {
//           paragraphConfig.heading = HeadingLevel.HEADING_2;
//         } else if (level === 2) {
//           paragraphConfig.heading = HeadingLevel.HEADING_3;
//         } else {
//           // Xử lý riêng cho Bullet points (từ cấp 3 trở đi)
//           paragraphConfig.bullet = { level: Math.min(level - 3, 8) };
//           paragraphConfig.spacing = { before: 100, after: 100 }; 
//         }

//         docParagraphs.push(new Paragraph(paragraphConfig));
//       });

//       // 4. Đóng gói và tải file Word (.docx)
//       const doc = new Document({
//         sections: [{ children: docParagraphs }]
//       });

//       const blob = await Packer.toBlob(doc);
//       saveAs(blob, `DeCuong_MindMap_${Date.now()}.docx`);

//     } catch (error) {
//       console.error('Lỗi khi xuất Word:', error);
//       alert('Đã có lỗi xảy ra trong quá trình tạo file Word!');
//     } finally {
//       setIsExporting(false);
//     }
//   };

//   return (
//     <div className="flex flex-col h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans overflow-hidden">
//       <nav className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0F1115] shrink-0">
//         <div className="flex items-center gap-4">
//           <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">M</div>
//           <h1 className="text-lg font-semibold tracking-tight text-white">MindNode Canvas <span className="text-xs font-normal text-white/40 ml-2">v2.4.0</span></h1>
//         </div>
//         <div className="flex gap-2">
//           <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs flex items-center gap-2 text-white">
//             <div className="w-2 h-2 rounded-full bg-green-500"></div> Runtime: Active
//           </div>
          
//           {/* NÚT XUẤT WORD ĐÃ ĐƯỢC CẬP NHẬT */}
//           <button 
//             onClick={handleExportWord}
//             disabled={isExporting}
//             className={`px-4 py-1 text-white text-xs font-medium rounded transition-colors ${
//               isExporting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
//             }`}
//           >
//             {isExporting ? 'Đang xuất Word...' : 'Export to Word'}
//           </button>
          
//         </div>
//       </nav>

//       <div className="flex flex-1 min-h-0">
//         <main className="relative flex-1 cursor-grab active:cursor-grabbing bg-[#0F1115]">
//           <Canvas />
//         </main>
//       </div>
//     </div>
//   );
// }
import React, { useState, useEffect } from 'react';
import { Canvas } from './components/Canvas';
import { useMindMapStore } from './store/useMindMapStore';
import { exportWordDocument } from './utils/exportWord';

// Cấu trúc dữ liệu cho một MindMap
interface MapMeta {
  id: string;
  name: string;
}

// Hàm xác thực cấu trúc dữ liệu JSON nhập vào sơ đồ
const validateMindMapJSON = (data: any): { isValid: boolean; error?: string } => {
  if (typeof data !== 'object' || data === null) {
    return { isValid: false, error: 'Dữ liệu phải là một đối tượng JSON hợp lệ.' };
  }
  if (!Array.isArray(data.nodes)) {
    return { isValid: false, error: 'Thiếu trường "nodes" hoặc trường "nodes" không phải là một danh sách (array).' };
  }
  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i];
    if (!node || typeof node !== 'object') {
      return { isValid: false, error: `Node tại vị trí ${i} không phải là một đối tượng.` };
    }
    if (!node.id || typeof node.id !== 'string') {
      return { isValid: false, error: `Node tại vị trí ${i} thiếu "id" hoặc "id" không hợp lệ.` };
    }
    if (typeof node.x !== 'number' || typeof node.y !== 'number') {
      return { isValid: false, error: `Node "${node.id}" thiếu tọa độ "x", "y" hoặc giá trị không phải kiểu số.` };
    }
    if (typeof node.width !== 'number' || typeof node.height !== 'number') {
      return { isValid: false, error: `Node "${node.id}" thiếu kích thước "width", "height" hoặc giá trị không phải kiểu số.` };
    }
    if (typeof node.content !== 'string') {
      return { isValid: false, error: `Node "${node.id}" thiếu trường "content" hoặc "content" không phải kiểu chuỗi.` };
    }
  }

  if (data.connections) {
    if (!Array.isArray(data.connections)) {
      return { isValid: false, error: 'Trường "connections" không phải là một danh sách (array).' };
    }
    for (let i = 0; i < data.connections.length; i++) {
      const conn = data.connections[i];
      if (!conn || typeof conn !== 'object') {
        return { isValid: false, error: `Kết nối tại vị trí ${i} không phải là một đối tượng.` };
      }
      if (!conn.id || typeof conn.id !== 'string') {
        return { isValid: false, error: `Kết nối tại vị trí ${i} thiếu "id" hoặc "id" không hợp lệ.` };
      }
      if (!conn.source || typeof conn.source !== 'string') {
        return { isValid: false, error: `Kết nối "${conn.id}" thiếu "source" hoặc "source" không hợp lệ.` };
      }
      if (!conn.target || typeof conn.target !== 'string') {
        return { isValid: false, error: `Kết nối "${conn.id}" thiếu "target" hoặc "target" không hợp lệ.` };
      }
    }
  }
  return { isValid: true };
};

export default function App() {
  const [isExporting, setIsExporting] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false); // Thêm state thu gọn Navbar

  // Pull history and actions from Zustand store to drive navbar buttons
  const nodes = useMindMapStore((state) => state.nodes);
  const connections = useMindMapStore((state) => state.connections);
  const importMapData = useMindMapStore((state) => state.importMapData);
  const history = useMindMapStore((state) => state.history);
  const future = useMindMapStore((state) => state.future);
  const undo = useMindMapStore((state) => state.undo);
  const redo = useMindMapStore((state) => state.redo);
  const isPresenting = useMindMapStore((state) => state.isPresenting);
  const startPresentation = useMindMapStore((state) => state.startPresentation);
  const stopPresentation = useMindMapStore((state) => state.stopPresentation);
  const presentationIndex = useMindMapStore((state) => state.presentationIndex);
  const presentationNodes = useMindMapStore((state) => state.presentationNodes);
  const nextSlide = useMindMapStore((state) => state.nextSlide);
  const prevSlide = useMindMapStore((state) => state.prevSlide);

  const [isExportJsonOpen, setIsExportJsonOpen] = useState(false);
  const [isImportJsonOpen, setIsImportJsonOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // 1. QUẢN LÝ DANH SÁCH CÁC MINDMAP (Khởi tạo từ LocalStorage)
  const [maps, setMaps] = useState<MapMeta[]>(() => {
    const saved = localStorage.getItem('mindnode_map_index');
    return saved ? JSON.parse(saved) : [{ id: 'map_default', name: 'Môn Mặc định' }];
  });
  const [currentMapId, setCurrentMapId] = useState(maps[0].id);

  // Lưu danh sách môn học mỗi khi có thêm/sửa tên
  useEffect(() => {
    localStorage.setItem('mindnode_map_index', JSON.stringify(maps));
  }, [maps]);

  const handleDownloadJson = () => {
    const dataStr = JSON.stringify({ nodes, connections }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `So_Do_${maps.find(m => m.id === currentMapId)?.name || 'default'}_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleCopyJson = async () => {
    const dataStr = JSON.stringify({ nodes, connections }, null, 2);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(dataStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error("No clipboard API");
      }
    } catch (err) {
      console.warn("Clipboard API failed, using fallback", err);
      const textArea = document.createElement("textarea");
      textArea.value = dataStr;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          alert("Không thể tự động sao chép. Vui lòng chọn văn bản và nhấn Ctrl+C / Cmd+C.");
        }
      } catch (e) {
        alert("Không thể tự động sao chép. Vui lòng chọn văn bản và nhấn Ctrl+C / Cmd+C.");
      } finally {
        textArea.remove();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        if (event.target && typeof event.target.result === 'string') {
          const content = event.target.result;
          setImportText(content);
          
          try {
            const parsed = JSON.parse(content);
            const validation = validateMindMapJSON(parsed);
            if (validation.isValid) {
              setValidationError(null);
            } else {
              setValidationError(validation.error || 'Dữ liệu JSON sai định dạng.');
            }
          } catch (err: any) {
            setValidationError(`Lỗi cú pháp JSON: ${err.message}`);
          }
        }
      };
    }
  };

  const handleTextareaChange = (val: string) => {
    setImportText(val);
    if (!val.trim()) {
      setValidationError(null);
      return;
    }
    try {
      const parsed = JSON.parse(val);
      const validation = validateMindMapJSON(parsed);
      if (validation.isValid) {
        setValidationError(null);
      } else {
        setValidationError(validation.error || 'Dữ liệu JSON không hợp lệ.');
      }
    } catch (err: any) {
      setValidationError(`Lỗi cú pháp JSON: ${err.message}`);
    }
  };

  const handleApplyImport = () => {
    try {
      const parsed = JSON.parse(importText);
      const validation = validateMindMapJSON(parsed);
      if (!validation.isValid) {
        setValidationError(validation.error || 'Dữ liệu JSON không hợp lệ.');
        return;
      }
      
      importMapData(parsed.nodes, parsed.connections || []);
      setIsImportJsonOpen(false);
      setImportText('');
      setValidationError(null);
    } catch (err: any) {
      setValidationError(`Lỗi cú pháp JSON: ${err.message}`);
    }
  };

  const handleOpenImport = () => {
    setImportText('');
    setValidationError(null);
    setIsImportJsonOpen(true);
  };

  const handleOpenExport = () => {
    setIsExportJsonOpen(true);
  };

  const handleCopyPrompt = async () => {
    const promptText = `Hãy đóng vai trò là một chuyên gia thiết kế Sơ đồ tư duy (MindMap) và tạo ra dữ liệu cấu trúc dưới dạng JSON chuẩn xác nhất cho ứng dụng **MindNode Canvas**.

Nhiệm vụ của bạn là chuyển đổi chủ đề/kiến thức được yêu cầu thành một sơ đồ tư duy có cấu trúc phân cấp thông minh, rõ ràng và cân đối.

Dữ liệu JSON đầu ra bắt buộc phải tuân thủ nghiêm ngặt định dạng cấu trúc sau:

\`\`\`json
{
  "nodes": [
    {
      "id": "n1", 
      "x": 100, 
      "y": 300, 
      "width": 250, 
      "height": 100, 
      "content": "<b>Chủ đề chính</b><br/>Mô tả ngắn gọn"
    },
    ...
  ],
  "connections": [
    {
      "id": "c1",
      "source": "n1",
      "target": "n2"
    },
    ...
  ]
}
\`\`\`

### 📌 NGUYÊN TẮC PHÂN CẤP LINH HOẠT & MODULAR (TRÁNH RỐI MẮT):
1. **Độ sâu linh hoạt (Few/Many Levels)**: Không cố định số cấp cho mọi nhánh. Hãy tùy biến độ sâu của từng nhánh dựa trên độ phức tạp của nội dung:
   - Các nhánh đơn giản (ví dụ: Ví dụ thực tế, ghi chú phụ, định nghĩa ngắn) chỉ nên có 1 - 2 cấp.
   - Các nhánh lý thuyết cốt lõi hoặc quy trình phức tạp có thể chia sâu từ 3 - 5 cấp.
2. **Chia nhỏ khối nội dung (Multiple Sub-blocks)**: TUYỆT ĐỐI KHÔNG dồn ép quá nhiều ý, danh sách dài hay các khối chữ lớn vào trong một Node duy nhất làm rối mắt và tràn viền.
   - Thay vì tạo 1 Node chứa danh sách 5-10 dòng chữ, hãy chia nhỏ nội dung đó thành 1 Node cha (chứa tiêu đề/tóm tắt khái quát) và tách 5-10 ý chi tiết kia thành 5-10 Node con tương ứng kết nối với Node cha.
   - Giới hạn từ ngữ: Mỗi Node chỉ nên chứa tối đa 20 - 30 từ, sử dụng thẻ \`<br/>\` để ngắt dòng hợp lý giúp chiều rộng thẻ luôn thon gọn (~250px đến ~300px).

### 📌 QUY TẮC PHÂN BỔ TỌA ĐỘ (X, Y) ĐỂ TRANH CHỒNG ĐÈ:
Bạn phải tự động tính toán tọa độ (x, y) cho từng Node theo nguyên tắc phân nhánh từ trái qua phải một cách có tính toán chiều cao của các nhánh con (Sub-tree Height):
1. **Phân bố trục X (Phân cấp)**:
   - Gốc (Root): \`x: 100\`.
   - Nhánh cấp 1 (Level 1): \`x: 480\` (khoảng cách \`+380px\` để chừa không gian kết nối thoải mái).
   - Nhánh cấp 2 (Level 2): \`x: 860\` (khoảng cách \`+380px\`).
   - Nhánh cấp 3 (Level 3): \`x: 1240\` (khoảng cách \`+380px\`).
   - Nhánh cấp 4 (Level 4): \`x: 1620\`.
2. **Phân bố trục Y (Tránh đè nhau & Cân đối)**:
   - Mốc ban đầu của Root nằm ở \`y: 300\`.
   - Các nhánh con của cùng một Node cha phải được phân bổ đối xứng theo chiều dọc xung quanh tọa độ \`y\` của Node cha.
   - **Quan trọng**: Nếu một Node con có nhiều con và cháu của riêng nó (một sub-tree lớn), bạn phải chừa ra một khoảng trống dọc rất lớn (Ví dụ: khoảng cách dọc \`y\` với các nhánh anh em kề bên phải tăng từ \`150px\` thông thường lên \`300px\` - \`500px\`) để toàn bộ cụm con cháu của nó không đè lên cụm con cháu của nhánh anh em.
   - Hãy hình dung tổng thể chiều cao của mỗi nhánh và cộng dồn tọa độ \`y\` lũy tiến một cách hợp lý để tạo ra một bố cục thông thoáng, tuyệt mỹ.

### 📌 ĐỊNH DẠNG NỘI DUNG (content) - RẤT QUAN TRỌNG:
Trường \`content\` hỗ trợ chuỗi HTML để hiển thị văn bản phong phú và định dạng premium:
1. **Tiêu đề in đậm**: Dùng thẻ \`<b>\` hoặc \`<strong>\` cho các khái niệm hoặc tiêu đề chính (Ví dụ: \`<b>Ý TƯỞNG CỐT LÕI:</b>\`).
2. **Xuống dòng**: Dùng thẻ \`<br/>\` để phân tách tiêu đề và mô tả chi tiết giúp thẻ Node không bị quá rộng theo chiều ngang.
3. **Hiệu ứng Highlight in đậm màu vàng hổ phách**: Để làm nổi bật các từ khóa cực kỳ quan trọng, hãy dùng chính xác thẻ:
   \`<span class="editor-highlight" style="color: rgb(245, 158, 11); font-weight: bold;">từ_khóa_nổi_bật</span>\`

### 📌 YÊU CẦU ĐỐI VỚI LIÊN KẾT (connections):
- Mỗi connection phải có một \`id\` duy nhất dạng chuỗi (ví dụ: \`"c1"\`, \`"c2"\`...).
- \`source\` phải là \`id\` của Node cha.
- \`target\` phải là \`id\` của Node con.
- Đảm bảo mỗi Node con chỉ được kết nối đến duy nhất 1 Node cha (cấu trúc hình cây chuẩn).

Hãy tạo một sơ đồ tư duy có cấu trúc chiều sâu cực kỳ chi tiết, phong phú về kiến thức cho chủ đề sau: `;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(promptText);
        setPromptCopied(true);
        setTimeout(() => setPromptCopied(false), 2000);
      } else {
        throw new Error("No clipboard API");
      }
    } catch (err) {
      console.warn("Clipboard API failed, using fallback", err);
      const textArea = document.createElement("textarea");
      textArea.value = promptText;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setPromptCopied(true);
          setTimeout(() => setPromptCopied(false), 2000);
        } else {
          alert("Không thể tự động sao chép prompt. Vui lòng thử lại hoặc sao chép thủ công.");
        }
      } catch (e) {
        alert("Không thể tự động sao chép prompt. Vui lòng thử lại hoặc sao chép thủ công.");
      } finally {
        textArea.remove();
      }
    }
  };

  // 2. TÍNH NĂNG TẠO MỚI VÀ ĐỔI TÊN MÔN HỌC
  const handleCreateMap = () => {
    const name = prompt('Nhập tên môn học / MindMap mới (Ví dụ: Triết học, OOP...):');
    if (name && name.trim() !== '') {
      const newId = `map_${Date.now()}`;
      setMaps([...maps, { id: newId, name }]);
      setCurrentMapId(newId); // Tự động chuyển sang map mới
    }
  };

  const handleRenameMap = () => {
    const map = maps.find(m => m.id === currentMapId);
    const newName = prompt('Đổi tên MindMap này:', map?.name);
    if (newName && newName.trim() !== '') {
      setMaps(maps.map(m => m.id === currentMapId ? { ...m, name: newName } : m));
    }
  };

  // 3. TÍNH NĂNG XUẤT WORD
  const handleExportWord = async () => {
    setIsExporting(true);
    try {
      const activeNodes = useMindMapStore.getState().nodes;
      const activeConns = useMindMapStore.getState().connections;
      const mapName = maps.find(m => m.id === currentMapId)?.name || 'DeCuong';
      await exportWordDocument(mapName, activeNodes, activeConns);
    } catch (error) {
      console.error('Lỗi khi xuất Word:', error);
      alert('Đã có lỗi xảy ra trong quá trình tạo file Word!');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#09090b] text-[#E0E0E0] font-sans overflow-hidden">
      
      <nav 
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shadow-2xl flex items-center justify-between
          ${isPresenting ? 'opacity-0 pointer-events-none -translate-y-10' : ''}
          ${isNavCollapsed && !isPresenting ? 'w-14 h-14 px-0 cursor-pointer hover:bg-white/10' : 'w-[98%] max-w-6xl h-16 px-5'}`}
        onClick={() => isNavCollapsed && !isPresenting && setIsNavCollapsed(false)}
      >
        
        {/* Nội dung Navbar khi mở rộng */}
        <div className={`flex items-center justify-between w-full h-full transition-opacity duration-300 ${isNavCollapsed ? 'opacity-0 absolute pointer-events-none' : 'opacity-100 relative delay-150'}`}>
          {/* Brand Section */}
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <span className="font-heading text-lg">M</span>
            </div>
            <div className="flex flex-col">
              <h1 className="font-heading text-lg font-semibold tracking-tight text-white leading-tight">
                MindNode Canvas
              </h1>
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-widest">
                v2.4.0 &bull; Beta
              </span>
            </div>
          </div>
          
          {/* Actions Section */}
          <div className="flex items-center flex-1 justify-end min-w-0">
            <div 
              className="flex gap-2 md:gap-3 items-center overflow-x-auto overflow-y-hidden pr-2 py-1 shrink-1 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {/* Map Management */}
            <div className="flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg px-2 py-1.5 shadow-inner">
              <div className="relative group">
                <select
                  value={currentMapId}
                  onChange={(e) => setCurrentMapId(e.target.value)}
                  className="appearance-none bg-transparent text-white/90 text-sm font-medium px-3 py-1 pr-8 outline-none cursor-pointer w-[160px] truncate hover:text-white transition-colors"
                >
                  {maps.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#1A1C21] text-white">
                      {m.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/50 group-hover:text-white transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
              
              <div className="w-px h-5 mx-1 bg-white/10" />
              
              <button 
                onClick={handleCreateMap} 
                className="w-7 h-7 flex items-center justify-center text-blue-400 hover:bg-white/10 hover:text-blue-300 rounded-md transition-all cursor-pointer" 
                title="Tạo MindMap mới"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              </button>
              <button 
                onClick={handleRenameMap} 
                className="w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-all cursor-pointer" 
                title="Đổi tên MindMap"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
            </div>

            {/* Undo/Redo Button Group */}
            <div className="flex items-center gap-1 bg-black/20 border border-white/5 rounded-lg p-1 shadow-inner">
              <button
                onClick={(e) => { e.stopPropagation(); undo(); }}
                disabled={history.length === 0}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                  history.length === 0 
                    ? 'text-white/20 cursor-not-allowed' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white cursor-pointer active:scale-95'
                }`}
                title="Hoàn tác (Ctrl+Z)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6"/>
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); redo(); }}
                disabled={future.length === 0}
                className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                  future.length === 0 
                    ? 'text-white/20 cursor-not-allowed' 
                    : 'text-white/70 hover:bg-white/10 hover:text-white cursor-pointer active:scale-95'
                }`}
                title="Làm lại (Ctrl+Y)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6"/>
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>
                </svg>
              </button>
            </div>

            {/* Status Indicator */}
            <div className="hidden md:flex px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-xs items-center gap-2 text-white/70 font-medium shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Active
            </div>
            
            {/* Presentation Button */}
            <button
              onClick={startPresentation}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/30 hover:text-green-300 text-sm font-semibold rounded-lg transition-all shadow-lg cursor-pointer"
              title="Bắt đầu Trình chiếu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Trình chiếu
            </button>

            {/* Import JSON Button */}
            <button
              onClick={handleOpenImport}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 hover:text-amber-300 text-sm font-semibold rounded-lg transition-all shadow-lg cursor-pointer"
              title="Nhập dữ liệu sơ đồ từ chuỗi JSON"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v14M19 9l-7 7-7-7M5 20h14"/>
              </svg>
              Nhập JSON
            </button>

            {/* Export JSON Button */}
            <button
              onClick={handleOpenExport}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 border border-purple-500/30 hover:bg-purple-600/30 hover:text-purple-300 text-sm font-semibold rounded-lg transition-all shadow-lg cursor-pointer"
              title="Trích xuất cấu trúc sơ đồ thành chuỗi JSON"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
                <line x1="12" y1="21" x2="12" y2="9"/>
              </svg>
              Xuất JSON
            </button>

            {/* Export Button */}
            <button 
              onClick={handleExportWord}
              disabled={isExporting}
              className={`flex items-center gap-2 px-5 py-2 text-white text-sm font-semibold rounded-lg transition-all shadow-lg cursor-pointer ${
                isExporting 
                  ? 'bg-blue-900/50 cursor-not-allowed text-white/50' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:shadow-blue-500/25 hover:-translate-y-0.5'
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xuất...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  Export Word
                </>
              )}
            </button>
            </div>

            {/* Collapse Button */}
            <div className="shrink-0 pl-2 border-l border-white/10 flex items-center">
              <button
                onClick={(e) => { e.stopPropagation(); setIsNavCollapsed(true); }}
                className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Thu gọn Menu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </button>
            </div>
            
          </div>
        </div>

        {/* Nội dung Navbar khi thu gọn */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${isNavCollapsed ? 'opacity-100 delay-150' : 'opacity-0 pointer-events-none'}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_15px_rgba(59,130,246,0.4)] group">
            <span className="font-heading text-base group-hover:hidden">M</span>
            <svg className="hidden group-hover:block" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </nav>

      {/* Canvas Area */}
      <main className="absolute inset-0 cursor-grab active:cursor-grabbing">
        {/* BÍ QUYẾT: Thuộc tính key giúp React tự đập đi xây lại Canvas khi đổi map */}
        <Canvas key={currentMapId} mapId={currentMapId} />
      </main>

      {/* Presentation Overlay */}
      {isPresenting && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] z-50 transition-all animate-in slide-in-from-bottom-10 fade-in">
          
          <button
            onClick={stopPresentation}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 rounded-lg text-sm font-medium transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Thoát (ESC)
          </button>

          <div className="w-px h-8 bg-white/10 mx-2"></div>

          <button
            onClick={prevSlide}
            disabled={presentationIndex === 0}
            className={`p-2 rounded-lg transition-colors ${
              presentationIndex === 0 ? 'text-white/20 cursor-not-allowed' : 'text-white/80 hover:bg-white/10 hover:text-white cursor-pointer'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <div className="min-w-[120px] text-center font-mono text-sm tracking-widest text-white/90 bg-white/5 px-4 py-1.5 rounded-lg border border-white/5">
            {presentationIndex + 1} / {presentationNodes.length}
          </div>

          <button
            onClick={nextSlide}
            disabled={presentationIndex === presentationNodes.length - 1}
            className={`p-2 rounded-lg transition-colors ${
              presentationIndex === presentationNodes.length - 1 ? 'text-white/20 cursor-not-allowed' : 'text-white/80 hover:bg-white/10 hover:text-white cursor-pointer'
            }`}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      )}

      {/* Modal Xuất JSON */}
      {isExportJsonOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300">
          <div className="w-[90%] max-w-2xl bg-[#0f1115]/95 border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-1"/></svg>
                Trích xuất JSON của Sơ đồ
              </h2>
              <button 
                onClick={() => setIsExportJsonOpen(false)}
                className="text-white/50 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <p className="text-xs text-white/60">
              Dưới đây là cấu trúc dữ liệu JSON của sơ đồ hiện tại. Bạn có thể sao chép hoặc tải về tệp tin để chia sẻ hoặc lưu trữ.
            </p>

            <div className="relative flex-1 min-h-[250px]">
              <textarea
                readOnly
                value={JSON.stringify({ nodes, connections }, null, 2)}
                className="w-full h-full min-h-[250px] bg-black/40 border border-white/5 p-4 rounded-xl font-mono text-xs text-blue-300 select-all outline-none resize-none overflow-y-auto"
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <button
                onClick={handleDownloadJson}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl border border-white/10 transition-all cursor-pointer active:scale-95"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Tải file .json
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer active:scale-95 ${
                    copied 
                      ? 'bg-green-600 text-white' 
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Đã sao chép!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      Sao chép JSON
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsExportJsonOpen(false)}
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl border border-white/5 transition-all cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nhập JSON */}
      {isImportJsonOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-[100] animate-in fade-in duration-300">
          <div className="w-[90%] max-w-2xl bg-[#0f1115]/95 border border-white/10 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Nhập Sơ đồ từ JSON
              </h2>
              <button 
                onClick={() => setIsImportJsonOpen(false)}
                className="text-white/50 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            
            <p className="text-xs text-white/60">
              Dán đoạn mã JSON của sơ đồ vào khung bên dưới, hoặc bấm chọn tệp tin JSON từ máy tính của bạn.
            </p>

            {/* Banner Sao chép Prompt AI */}
            <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/20 px-4 py-3 rounded-xl gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-blue-400">Bạn muốn AI khác tạo sơ đồ hộ bạn?</span>
                <span className="text-[11px] text-white/60 leading-normal">Sao chép prompt này để hướng dẫn các AI (ChatGPT/Claude/Gemini) tạo cấu trúc JSON chuẩn có highlight và căn chỉnh phân tầng tuyệt đẹp.</span>
              </div>
              <button
                onClick={handleCopyPrompt}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer active:scale-95 border ${
                  promptCopied
                    ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                    : 'bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 hover:text-blue-300 hover:border-blue-400'
                }`}
              >
                {promptCopied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Đã sao chép!
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Sao chép Prompt AI
                  </>
                )}
              </button>
            </div>

            {/* File upload area */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-3 rounded-xl">
              <label className="text-xs text-white/50 font-medium">Chọn tệp tin .json:</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="block w-full text-xs text-white/70 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600/20 file:text-blue-400 hover:file:bg-blue-600/30 file:cursor-pointer cursor-pointer"
              />
            </div>

            <div className="relative flex-1 min-h-[200px]">
              <textarea
                placeholder='Dán chuỗi JSON sơ đồ vào đây... Ví dụ: {"nodes": [...], "connections": [...] }'
                value={importText}
                onChange={(e) => handleTextareaChange(e.target.value)}
                className="w-full h-full min-h-[200px] bg-black/40 border border-white/5 p-4 rounded-xl font-mono text-xs text-white placeholder-white/20 outline-none resize-none overflow-y-auto focus:border-blue-500/50 transition-colors"
              />
            </div>

            {/* Validation Message */}
            {validationError ? (
              <div className="flex gap-2 items-start bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs text-red-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <span className="font-bold">Lỗi định dạng: </span>
                  {validationError}
                </div>
              </div>
            ) : importText.trim() ? (
              <div className="flex gap-2 items-center bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl text-xs text-green-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Dữ liệu JSON hợp lệ và sẵn sàng render.</span>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setIsImportJsonOpen(false)}
                className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl border border-white/5 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleApplyImport}
                disabled={!importText.trim() || !!validationError}
                className={`flex items-center gap-2 px-6 py-2 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer active:scale-95 ${
                  !importText.trim() || !!validationError
                    ? 'bg-blue-900/40 text-white/40 cursor-not-allowed border border-white/5'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                Áp dụng sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}