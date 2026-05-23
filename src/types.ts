export interface MindNodeData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  isCollapsed?: boolean; // HTML string containing rich text
}

export interface ConnectionData {
  id: string;
  source: string;
  target: string;
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}
