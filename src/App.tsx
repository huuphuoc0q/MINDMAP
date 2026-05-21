// /**
//  * @license
//  * SPDX-License-Identifier: Apache-2.0
//  */

// import { Canvas } from './components/Canvas';

// export default function App() {
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
//           <button className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors">Export Canvas</button>
//         </div>
//       </nav>

//       <div className="flex flex-1 min-h-0">
//         {/* <aside className="w-80 bg-[#141416]/80 backdrop-blur-md border-r border-white/10 flex flex-col shrink-0">
//           <div className="p-5 space-y-6">
//             <div>
//               <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4 italic">Architecture Strategy</h3>
//               <div className="space-y-4">
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/5">
//                   <div className="text-xs font-semibold text-blue-400 mb-1">Event Propagation Layer</div>
//                   <p className="text-[11px] text-white/60 leading-relaxed">
//                     Uses <strong>Propagation Stop-Loss</strong> pattern. While in <code>isEditing</code> state, <code>onMouseDown</code> is captured by the editor instance to allow text selection, bypassing the Canvas Drag Listener.
//                   </p>
//                 </div>
//                 <div className="p-3 bg-white/5 rounded-lg border border-white/5">
//                   <div className="text-xs font-semibold text-blue-400 mb-1">WYSIWYG Integration</div>
//                   <p className="text-[11px] text-white/60 leading-relaxed">
//                     Each node encapsulates a headless Tiptap or Lexical instance. Content is stored as Delta or HTML strings within the Node schema.
//                   </p>
//                 </div>
//               </div>
//             </div>
//             <div>
//               <h3 className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4 italic">JSON State Schema</h3>
//               <pre className="text-[10px] font-mono bg-black/40 p-3 rounded-lg border border-white/5 overflow-hidden text-blue-300">
// {`{
//   "nodes": [
//     {
//       "id": "node_01",
//       "type": "rich-text",
//       "pos": { "x": 420, "y": 180 },
//       "data": {
//         "html": "<p>Draft...</p>",
//         "version": 2
//       }
//     }
//   ]
// }`}
//               </pre>
//             </div>
//           </div>
//           <div className="mt-auto p-5 border-t border-white/5 bg-black/20">
//             <div className="flex justify-between text-[10px] text-white/40 font-mono">
//               <span>ZOOM: 100%</span>
//               <span>NODES: 12</span>
//               <span>LATENCY: 4ms</span>
//             </div>
//           </div>
//         </aside> */}
//         <main className="relative flex-1 cursor-grab active:cursor-grabbing bg-[#0F1115]">
//           <Canvas />
//         </main>
//       </div>
//     </div>
//   );
// }
import { useState } from 'react';
import { Canvas } from './components/Canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { MindNodeData, ConnectionData } from './types';

export default function App() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportWord = async () => {
    setIsExporting(true);
    
    try {
      // 1. Lấy dữ liệu mới nhất từ localStorage
      const savedNodes = localStorage.getItem('mindnode_nodes');
      const savedConns = localStorage.getItem('mindnode_connections');

      if (!savedNodes) {
        alert("Không có dữ liệu sơ đồ để xuất!");
        setIsExporting(false);
        return;
      }

      const nodes: MindNodeData[] = JSON.parse(savedNodes);
      const connections: ConnectionData[] = savedConns ? JSON.parse(savedConns) : [];

      // 2. Thuật toán phân cấp và sắp xếp theo chiều sâu (DFS)
      const targetIds = new Set(connections.map(c => c.target));
      const roots = nodes.filter(n => !targetIds.has(n.id)); // Tìm các Node gốc

      const adjList: Record<string, string[]> = {};
      connections.forEach(c => {
        if (!adjList[c.source]) adjList[c.source] = [];
        adjList[c.source].push(c.target);
      });

      const orderedNodes: { node: MindNodeData, level: number }[] = [];
      const visited = new Set<string>();

      // Hàm đệ quy duyệt nhánh DFS
      const dfs = (nodeId: string, currentLevel: number) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (node) {
          orderedNodes.push({ node, level: currentLevel });
        }

        if (adjList[nodeId]) {
          adjList[nodeId].forEach(childId => {
            dfs(childId, currentLevel + 1);
          });
        }
      };

      // Chạy DFS từ các Node gốc
      roots.forEach(r => dfs(r.id, 0));

      // Xử lý nốt các Node bị mồ côi (không nối với ai)
      nodes.forEach(n => {
        if (!visited.has(n.id)) dfs(n.id, 0);
      });

      // 3. Xây dựng cấu trúc file Word
      // 3. Xây dựng cấu trúc file Word có ĐỊNH DẠNG RÕ RÀNG
      const docParagraphs: Paragraph[] = [];

      orderedNodes.forEach(({ node, level }) => {
        // Dọn dẹp thẻ HTML
        const cleanText = node.content
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/div>|<\/p>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .trim();

        if (!cleanText) return;

        // Tùy chỉnh Font, Size, Trọng lượng chữ theo từng Level
        const isBold = level < 3;
        const isItalic = level === 2;
        let fontSize = 24; // Mặc định 12pt (docx tính bằng half-point: 12 * 2 = 24)
        let color = "000000"; // Đen mặc định

        if (level === 0) {
          fontSize = 32; // 16pt cho Node gốc
          color = "1E3A8A"; // Màu xanh dương đậm
        } else if (level === 1) {
          fontSize = 28; // 14pt cho nhánh cấp 1
          color = "374151"; // Màu xám đậm
        } else if (level === 2) {
          fontSize = 24; // 12pt cho nhánh cấp 2
          color = "4B5563"; // Màu xám
        }

        // Tạo chuỗi văn bản với định dạng đã thiết lập
        const textRuns = cleanText.split('\n').map((line, index) => 
          new TextRun({ 
            text: line, 
            break: index > 0 ? 1 : 0,
            bold: isBold,
            italics: isItalic,
            size: fontSize,
            color: color,
            font: "Arial" // Ép dùng font Arial cho hiện đại, dễ đọc
          })
        );

        // Cấu hình đoạn văn (Paragraph) kèm theo khoảng cách (Spacing) cho dễ nhìn
        let paragraphConfig: any = {
          children: textRuns,
          // Khoảng cách trên/dưới để các đoạn không bị dính chùm vào nhau
          spacing: { before: level === 0 ? 400 : 200, after: 120 } 
        };

        if (level === 0) {
          paragraphConfig.heading = HeadingLevel.HEADING_1;
        } else if (level === 1) {
          paragraphConfig.heading = HeadingLevel.HEADING_2;
        } else if (level === 2) {
          paragraphConfig.heading = HeadingLevel.HEADING_3;
        } else {
          // Xử lý riêng cho Bullet points (từ cấp 3 trở đi)
          paragraphConfig.bullet = { level: Math.min(level - 3, 8) };
          paragraphConfig.spacing = { before: 100, after: 100 }; 
        }

        docParagraphs.push(new Paragraph(paragraphConfig));
      });

      // 4. Đóng gói và tải file Word (.docx)
      const doc = new Document({
        sections: [{ children: docParagraphs }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `DeCuong_MindMap_${Date.now()}.docx`);

    } catch (error) {
      console.error('Lỗi khi xuất Word:', error);
      alert('Đã có lỗi xảy ra trong quá trình tạo file Word!');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0A0A] text-[#E0E0E0] font-sans overflow-hidden">
      <nav className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#0F1115] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">M</div>
          <h1 className="text-lg font-semibold tracking-tight text-white">MindNode Canvas <span className="text-xs font-normal text-white/40 ml-2">v2.4.0</span></h1>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-white/5 rounded border border-white/10 text-xs flex items-center gap-2 text-white">
            <div className="w-2 h-2 rounded-full bg-green-500"></div> Runtime: Active
          </div>
          
          {/* NÚT XUẤT WORD ĐÃ ĐƯỢC CẬP NHẬT */}
          <button 
            onClick={handleExportWord}
            disabled={isExporting}
            className={`px-4 py-1 text-white text-xs font-medium rounded transition-colors ${
              isExporting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'
            }`}
          >
            {isExporting ? 'Đang xuất Word...' : 'Export to Word'}
          </button>
          
        </div>
      </nav>

      <div className="flex flex-1 min-h-0">
        <main className="relative flex-1 cursor-grab active:cursor-grabbing bg-[#0F1115]">
          <Canvas />
        </main>
      </div>
    </div>
  );
}