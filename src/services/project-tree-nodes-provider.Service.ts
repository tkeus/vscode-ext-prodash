import * as vscode from 'vscode';
import { ExtensionContextService } from './extension-context.service';
import { ProDashNode } from '../models/prodash-node.model';

/**
 * Provides the tree data for the ProDash projects/scripts view.
 * Supplies nodes for project groups, projects, script groups, and scripts.
 */
export class ProjectsTreeNodesProvider implements vscode.TreeDataProvider<(ProDashNode)> {

  /**
   * Returns the TreeItem representation for a node.
   * @param element The node to represent.
   */
  getTreeItem(element: ProDashNode): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children nodes for a given node, or root nodes if none is provided.
   * @param element The parent node, or undefined for root.
   */
  getChildren(element?: ProDashNode): Promise<ProDashNode[]> {
    if (!element) {
      return ExtensionContextService.instance.getTreeNodes();
    } 
    else {
      return element.object.getTreeNodes();
    }
  }

  /** Event emitter for tree data changes. */
  private _onDidChangeTreeData: vscode.EventEmitter<ProDashNode | undefined | null | void> = new vscode.EventEmitter<ProDashNode | undefined | null | void>();
  /** Event for tree data changes. */
  readonly onDidChangeTreeData: vscode.Event<ProDashNode | undefined | null | void> = this._onDidChangeTreeData.event;

  /**
   * Refreshes the projects tree by re-initializing groups and firing the change event.
   */
  refreshProjects(): void {
    ExtensionContextService.instance.initializeProjectGroups();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Opens the folder for the given project node.
   * @param project The project node to open.
   */
  openFolder(node: ProDashNode): void {
    this._onDidChangeTreeData.fire(node);
    node.openProjectFolder();
  }

  /**
   * Executes the script for the given script node.
   * @param script The script node to execute.
   */
  runScript(node: ProDashNode): void {
    this._onDidChangeTreeData.fire(node);
    node.execute();
  }
}
