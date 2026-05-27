import { MindNodeData, ConnectionData } from '../types';

export interface LinearNode {
  node: MindNodeData;
  level: number;
  parentId: string | null;
}

export function buildLinearTree(nodes: MindNodeData[], connections: ConnectionData[]): LinearNode[] {
  const targetIds = new Set(connections.map(c => c.target));
  const roots = nodes.filter(n => !targetIds.has(n.id));
  
  const adjList: Record<string, string[]> = {};
  connections.forEach(c => {
    if (!adjList[c.source]) adjList[c.source] = [];
    adjList[c.source].push(c.target);
  });
  
  const linearTree: LinearNode[] = [];
  const visited = new Set<string>();
  
  const dfs = (nodeId: string, level: number, parentId: string | null) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      linearTree.push({ node, level, parentId });
    }
    
    const children = adjList[nodeId] || [];
    children.forEach(childId => dfs(childId, level + 1, nodeId));
  };
  
  roots.forEach(r => dfs(r.id, 0, null));
  
  nodes.forEach(n => {
    if (!visited.has(n.id)) dfs(n.id, 0, null);
  });
  
  return linearTree;
}

export function indentNodeInGraph(
  id: string,
  linearTree: LinearNode[],
  connections: ConnectionData[]
): ConnectionData[] {
  const currentIndex = linearTree.findIndex(n => n.node.id === id);
  if (currentIndex <= 0) return connections; // Cannot indent first node
  
  const currentNode = linearTree[currentIndex];
  
  // Find the closest previous node that has the SAME level.
  // This node will become the new parent of currentNode.
  let targetSiblingIndex = currentIndex - 1;
  while (targetSiblingIndex >= 0 && linearTree[targetSiblingIndex].level > currentNode.level) {
    targetSiblingIndex--;
  }
  
  // If no previous sibling found (either it's the first node in the whole tree, 
  // or it is the first child of its current parent), we cannot indent it.
  if (targetSiblingIndex < 0 || linearTree[targetSiblingIndex].level < currentNode.level) {
    return connections;
  }
  
  const newParentId = linearTree[targetSiblingIndex].node.id;
  
  const newConnections = connections.filter(c => c.target !== id); // Remove old parent
  newConnections.push({
    id: `c_${Date.now()}_${Math.random()}`,
    source: newParentId,
    target: id
  });
  
  return newConnections;
}

export function outdentNodeInGraph(
  id: string,
  linearTree: LinearNode[],
  connections: ConnectionData[]
): ConnectionData[] {
  const currentIndex = linearTree.findIndex(n => n.node.id === id);
  if (currentIndex < 0) return connections;
  
  const currentNode = linearTree[currentIndex];
  if (currentNode.level === 0) return connections; // Already at root
  
  // Find the grandparent (parent of parent)
  const currentParentId = currentNode.parentId;
  if (!currentParentId) return connections;
  
  const parentNode = linearTree.find(n => n.node.id === currentParentId);
  if (!parentNode) return connections;
  
  const grandParentId = parentNode.parentId;
  
  const newConnections = connections.filter(c => c.target !== id); // Remove old parent
  
  if (grandParentId) {
    newConnections.push({
      id: `c_${Date.now()}_${Math.random()}`,
      source: grandParentId,
      target: id
    });
  } // Else, it becomes a root (level 0), so no connection needed.
  
  return newConnections;
}

export function insertNodeGraph(
  afterId: string | null,
  newNode: MindNodeData,
  linearTree: LinearNode[],
  connections: ConnectionData[]
): ConnectionData[] {
  if (!afterId) return connections; // Inserting at very top as root
  
  const afterIndex = linearTree.findIndex(n => n.node.id === afterId);
  if (afterIndex < 0) return connections;
  
  const afterNode = linearTree[afterIndex];
  
  const newConnections = [...connections];
  
  if (afterNode.parentId) {
    const newConn = {
      id: `c_${Date.now()}_${Math.random()}`,
      source: afterNode.parentId,
      target: newNode.id
    };
    
    // Find the connection that points to afterNode and insert the new one right after it
    const connIndex = newConnections.findIndex(c => c.source === afterNode.parentId && c.target === afterId);
    if (connIndex >= 0) {
      newConnections.splice(connIndex + 1, 0, newConn);
    } else {
      newConnections.push(newConn);
    }
  }
  
  return newConnections;
}

export function moveSubtree(
  sourceId: string,
  targetParentId: string | null,
  connections: ConnectionData[]
): ConnectionData[] {
  const newConnections = connections.filter(c => c.target !== sourceId);
  if (targetParentId) {
    newConnections.push({
      id: `c_${Date.now()}_${Math.random()}`,
      source: targetParentId,
      target: sourceId
    });
  }
  return newConnections;
}
