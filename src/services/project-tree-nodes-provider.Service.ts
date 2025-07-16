import * as vscode from 'vscode';
import { ExtensionContextService } from './extension-context.service';
import { ProDashNode } from '../models/prodash-node.model';
import { LoggingService } from './logging.service';

/**
 * Provides the tree data for the ProDash projects/scripts view.
 * Supplies nodes for project groups, projects, script groups, and scripts.
 */
export class ProjectsTreeNodesProvider implements vscode.TreeDataProvider<ProDashNode> {

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
  refreshProjects(reason?: string): void {
    if (reason) {
      LoggingService.instance.logInfo(`Refreshing projects: ${reason}`);
    } else {
      LoggingService.instance.logInfo('Refreshing projects (manual trigger)...');
    }
    ExtensionContextService.instance.initializeProjectGroups();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Opens the folder for the given project node.
   * @param node The project node to open.
   */
  openFolder(node: ProDashNode): void {
    node.openProjectFolder();
  }

  /**
   * Executes the script for the given script node.
   * @param node The script node to execute.
   */
  runScript(node: ProDashNode): void {
    node.execute();
  }
}
