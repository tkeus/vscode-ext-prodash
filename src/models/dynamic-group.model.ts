import * as vscode from 'vscode';
import * as path from 'path';
import { ProDashNode } from './prodash-node.model';
import { ProDashTreeItem, ProDashTreeNodeProvider } from './tree-node-provider';
import { Project } from './project.model';
import { ExtensionContextService } from '../services/extension-context.service';

/**
 * Represents a dynamically created group for projects or scripts.
 */
export class DynamicGroup<T extends ProDashTreeItem> extends ProDashTreeNodeProvider<T> {
  public name: string;
  public children: T[];
  public parent: Project | ExtensionContextService;

  constructor(name: string, parent: Project | ExtensionContextService) {
    super();
    this.name = name;
    this.children = [];
    this.parent = parent;
  }

  setupTreeNode(groupNode: ProDashNode): void {
    groupNode.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, '..', 'media', 'folder-light.svg')),
      dark: vscode.Uri.file(path.join(__dirname, '..', 'media', 'folder-dark.svg'))
    };

    const isParentProjectActive = this.parent instanceof Project && this.parent.isActive;
    // We can safely cast child to check for `isActive`.
    // If T is Project, it will be checked. If T is Script, it will be undefined and correctly evaluate to false.
    const hasActiveChildProject = this.children.some(
      (child) => (child as { isActive?: boolean }).isActive);

    groupNode.collapsibleState = (isParentProjectActive || hasActiveChildProject)
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
  }

  getContextValue(): string {
    return 'Group';
  }

  getChildNodes(): T[] {
    return this.children.filter(child => !(child as any).hidden);
  }
}