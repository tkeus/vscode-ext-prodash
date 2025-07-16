import { ProDashNode } from "./prodash-node.model";

/**
 * Defines the essential properties and methods for any item that can be displayed in the ProDash tree.
 */
export interface ProDashTreeItem {
  name: string;
  getContextValue(): string;
  setupTreeNode?(node: ProDashNode): void;
}
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
export abstract class ProDashTreeNodeProvider<T extends ProDashTreeItem | null> implements TreeNodeProvider<T>, ProDashTreeItem {
  
  /** Constructs a new ProDashTreeNodeProvider. */
  constructor() {}

  /** The display name of the node. Must be implemented by subclasses. */
  abstract name: string;

  /** Returns the direct children of this node. Must be implemented by subclasses. */
  abstract getChildNodes(): T[];

  /** Returns the context value for this node. Must be implemented by subclasses. */
  abstract getContextValue(): string;

  /** Optional method for subclasses to customize the ProDashNode. */
  setupTreeNode?(node: ProDashNode): void;

  /**
   * Returns the tree nodes (ProDashNode) for all children.
   * Calls getChildNodes() and wraps each child in a ProDashNode, using the child's context value.
   */
  getTreeNodes(): Promise<ProDashNode[]> {
    const childNodes = this.getChildNodes()
      .filter((child): child is Exclude<T, null> => child !== null)
      .map(child => {
        const node = new ProDashNode(child.name, child.getContextValue(), child);
        child.setupTreeNode?.(node);
        return node;
      });
    return Promise.resolve(childNodes);
  }
}
