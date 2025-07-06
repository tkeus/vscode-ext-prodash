import { ProDashNode } from "./prodash-node.model";

/**
 * Interface for tree node providers in ProDash.
 * Provides methods to retrieve child nodes, tree nodes, and a context value for menu contributions.
 */
export interface TreeNodeProvider<T> {
  /** Returns the direct children of this node. */
  getChildNodes(): T[];
  /** Returns the tree nodes (ProDashNode) for all children. */
  getTreeNodes(): Promise<ProDashNode[]>;
  /** Returns the context value for this node (used for context menus). */
  getContextValue(): string;
}

/**
 * Abstract base class for ProDash tree node providers.
 * Implements getTreeNodes() using getChildNodes() and getContextValue().
 * Child classes must implement getChildNodes() and getContextValue().
 */
export abstract class ProDashTreeNodeProvider<T> implements TreeNodeProvider<T> {
  
  /** Constructs a new ProDashTreeNodeProvider. */
  constructor() {}

  /** Returns the direct children of this node. Must be implemented by subclasses. */
  abstract getChildNodes(): T[];

  /** Returns the context value for this node. Must be implemented by subclasses. */
  abstract getContextValue(): string;

  /**
   * Returns the tree nodes (ProDashNode) for all children.
   * Calls getChildNodes() and wraps each child in a ProDashNode, using the child's context value.
   */
  getTreeNodes(): Promise<ProDashNode[]> {
    const results: ProDashNode[] = [];
    return new Promise(resolve => {
      this.getChildNodes().forEach(child => {
        const node = new ProDashNode(
          (child as any).name,
          (child as TreeNodeProvider<any>).getContextValue(),
          child
        );
        if (typeof (child as any).setupTreeNode === 'function') {
          (child as any).setupTreeNode(node);
        }
        results.push(node);
      });
      resolve(results);
    });
  }
}
