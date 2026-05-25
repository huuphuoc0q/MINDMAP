import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { MindNodeData, ConnectionData } from '../types';

// Helper to parse CSS color to Hex code for docx (needs to be 6 characters hex)
const parseColorToHex = (color: string): string | undefined => {
  if (!color) return undefined;
  
  // Hex color formats
  if (color.startsWith('#')) {
    return color.replace('#', '').trim();
  }
  
  // RGB format: rgb(255, 0, 0)
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]).toString(16).padStart(2, '0');
      const g = parseInt(matches[1]).toString(16).padStart(2, '0');
      const b = parseInt(matches[2]).toString(16).padStart(2, '0');
      return `${r}${g}${b}`;
    }
  }

  // Basic HTML named colors
  const colors: Record<string, string> = {
    red: 'FF0000',
    green: '008000',
    blue: '0000FF',
    yellow: 'FFFF00',
    black: '000000',
    white: 'FFFFFF',
    gray: '808080',
    purple: '800080',
    orange: 'FFA500',
    pink: 'FFC0CB',
    brown: 'A52A2A',
  };
  
  return colors[color.toLowerCase()] || undefined;
};

interface FormatState {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  color?: string;
}

// Converts HTML text of a node to rich docx Paragraphs preserving bold, italic, lists, etc.
export function convertNodeHtmlToParagraphs(htmlContent: string, level: number): Paragraph[] {
  const parser = new DOMParser();
  // Wrap to ensure we have a common root
  const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
  const paragraphs: Paragraph[] = [];

  // 1. Check if it contains lists
  const hasLists = doc.querySelector('li') !== null;

  // 2. Helper to traverse element and create formatted TextRuns
  const getFormattedRuns = (element: Element): TextRun[] => {
    const runs: TextRun[] = [];

    const traverse = (node: Node, state: FormatState) => {
      const currentState = { ...state };

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();

        if (tagName === 'b' || tagName === 'strong') {
          currentState.bold = true;
        } else if (tagName === 'i' || tagName === 'em') {
          currentState.italics = true;
        } else if (tagName === 'u') {
          currentState.underline = true;
        } else if (tagName === 'font') {
          const colorAttr = el.getAttribute('color');
          if (colorAttr) {
            currentState.color = parseColorToHex(colorAttr);
          }
        } else if (tagName === 'span') {
          const colorStyle = el.style.color;
          if (colorStyle) {
            currentState.color = parseColorToHex(colorStyle);
          }
        } else if (tagName === 'br') {
          runs.push(new TextRun({ text: '', break: 1 }));
          return;
        }

        // Traverse children
        for (let i = 0; i < el.childNodes.length; i++) {
          traverse(el.childNodes[i], currentState);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text) {
          runs.push(
            new TextRun({
              text: text.replace(/&nbsp;/g, ' '),
              bold: currentState.bold,
              italics: currentState.italics,
              underline: currentState.underline ? {} : undefined,
              color: currentState.color,
              font: "Arial"
            })
          );
        }
      }
    };

    for (let i = 0; i < element.childNodes.length; i++) {
      traverse(element.childNodes[i], {});
    }

    return runs;
  };

  // 3. Helper to build docx paragraph configs depending on mindmap level
  const getParagraphConfig = (runs: TextRun[], isLi: boolean = false) => {
    const config: any = {
      children: runs,
      spacing: { before: level === 0 ? 400 : 200, after: 120 }
    };

    if (level === 0) {
      config.heading = HeadingLevel.HEADING_1;
    } else if (level === 1) {
      config.heading = HeadingLevel.HEADING_2;
    } else if (level === 2) {
      config.heading = HeadingLevel.HEADING_3;
    } else {
      // Mindmap branch bullets (Level >= 3)
      config.bullet = { level: Math.min(level - 3, 8) };
      config.spacing = { before: 100, after: 100 };
    }

    // If this represents a list item *within* the node text itself, indent it deeper
    if (isLi) {
      const nestedLevel = level >= 3 ? level - 2 : 0;
      config.bullet = { level: Math.min(nestedLevel, 8) };
      config.spacing = { before: 80, after: 80 };
    }

    return config;
  };

  if (hasLists) {
    // Treat each <li> as a separate bullet paragraph
    const liElements = doc.querySelectorAll('li');
    liElements.forEach(li => {
      const runs = getFormattedRuns(li);
      if (runs.length > 0) {
        paragraphs.push(new Paragraph(getParagraphConfig(runs, true)));
      }
    });
  } else {
    // Split by block tags like <p>, <div> to create multiple paragraphs if present
    const blocks = doc.querySelectorAll('p, div > div');
    if (blocks.length > 1) {
      blocks.forEach(block => {
        const runs = getFormattedRuns(block);
        if (runs.length > 0) {
          paragraphs.push(new Paragraph(getParagraphConfig(runs)));
        }
      });
    } else {
      // Single block node content
      const runs = getFormattedRuns(doc.body);
      if (runs.length > 0) {
        paragraphs.push(new Paragraph(getParagraphConfig(runs)));
      }
    }
  }

  return paragraphs;
}

// Order nodes in a clean tree hierarchy using DFS
export const getOrderedNodesDFS = (nodes: MindNodeData[], connections: ConnectionData[]) => {
  const targetIds = new Set(connections.map(c => c.target));
  const roots = nodes.filter(n => !targetIds.has(n.id));

  const adjList: Record<string, string[]> = {};
  connections.forEach(c => {
    if (!adjList[c.source]) adjList[c.source] = [];
    adjList[c.source].push(c.target);
  });

  const orderedNodes: { node: MindNodeData; level: number }[] = [];
  const visited = new Set<string>();

  const dfs = (nodeId: string, currentLevel: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      orderedNodes.push({ node, level: currentLevel });
    }

    const children = adjList[nodeId] || [];
    children.forEach(childId => {
      dfs(childId, currentLevel + 1);
    });
  };

  // Run DFS for each root node
  roots.forEach(r => dfs(r.id, 0));

  // Catch orphan nodes (if any)
  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      dfs(n.id, 0);
    }
  });

  return orderedNodes;
};

// Main entry point for advanced Word Exporting
export const exportWordDocument = async (
  mapName: string,
  nodes: MindNodeData[],
  connections: ConnectionData[]
) => {
  if (!nodes || nodes.length === 0) {
    alert("Sơ đồ này trống, không có gì để xuất!");
    return;
  }

  // 1. Get DFS ordered nodes
  const orderedNodes = getOrderedNodesDFS(nodes, connections);

  // 2. Parse nodes to docx paragraphs preserving HTML formatting
  const docParagraphs: Paragraph[] = [];

  orderedNodes.forEach(({ node, level }) => {
    const parsedParagraphs = convertNodeHtmlToParagraphs(node.content, level);
    parsedParagraphs.forEach(p => docParagraphs.push(p));
  });

  if (docParagraphs.length === 0) {
    alert("Không tìm thấy nội dung hợp lệ để xuất!");
    return;
  }

  // 3. Package and download
  const doc = new Document({
    sections: [{ children: docParagraphs }]
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${mapName}_${Date.now()}.docx`);
};
