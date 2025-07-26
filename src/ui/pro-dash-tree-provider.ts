import * as vscode from 'vscode';
import { ProjectService } from '../services/project.service';
import { ScriptService } from '../services/script.service';
import { LoggingService } from '../services/logging.service';
import { Project, Script } from '../types';
import { readFileContents } from '../utils/file-utils';

type TreeElement = GroupTreeItem | ProjectTreeItem | ScriptTreeItem;

/**
 * Provides the tree data for the ProDash projects/scripts view.
 * Supplies nodes for project groups, projects, script groups, and scripts.
 */
export class ProDashTreeProvider implements vscode.TreeDataProvider<TreeElement> {

  private _onDidChangeTreeData: vscode.EventEmitter<TreeElement | undefined | null | void> = new vscode.EventEmitter<TreeElement | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeElement | undefined | null | void> = this._onDidChangeTreeData.event;

  /**
   * Refreshes the projects tree by re-initializing groups and firing the change event.
   */
  refresh(): void {
    ProjectService.instance.refresh();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Returns the TreeItem representation for a node.
   * @param element The node to represent.
   */
  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the children nodes for a given node, or root nodes if none is provided.
   * @param element The parent node, or undefined for root.
   */
  getChildren(element?: TreeElement): vscode.ProviderResult<TreeElement[]> {
    LoggingService.instance.logInfo(`ProDashTreeProvider.getChildren(${element?.label})`);
    if (!element) {
      // Root level: Get project groups
      const projects = ProjectService.instance.getProjects();
      const groups = new Map<string, Project[]>();

      // Group projects by their group name
      for (const project of projects) {
        const groupName = project.group || 'Uncategorized';
        if (!groups.has(groupName)) {
          groups.set(groupName, []);
        }
        groups.get(groupName)!.push(project);
      }

      const groupItems: GroupTreeItem[] = [];
      for (const [groupName, projectsInGroup] of groups.entries()) {
        // A group is expanded if it contains any active project.
        const hasActiveProject = projectsInGroup.some(p => p.isActive);
        groupItems.push(new GroupTreeItem(groupName, 'projectGroup', undefined, hasActiveProject));
      }
      return groupItems;
    }

    if (element.contextValue === 'projectGroup') {
      // Project Group level: Get projects in this group
      const projects = ProjectService.instance.getProjects();
      return projects
        .filter(p => (p.group || 'Uncategorized') === element.label)
        .map(p => new ProjectTreeItem(p) as TreeElement);
    }

    if (element.contextValue === 'project') {
      // Project level: Get script groups
      const project = (element as ProjectTreeItem).project;
      const allScripts = ScriptService.instance.getScripts(project.path);

      // UI is responsible for filtering hidden scripts
      const visibleScripts = allScripts.filter(s => !s.hidden && !s.name.startsWith('_'));
      const scriptGroups = [...new Set(visibleScripts.map(s => s.group || 'Uncategorized'))]
        .filter(g => !g.startsWith('_'));

      return scriptGroups.map(g => new GroupTreeItem(g, 'scriptGroup', project, project.isActive) as TreeElement);
    }

    if (element.contextValue === 'scriptGroup') {
      // Script Group level: Get scripts in this group
      const groupItem = element as GroupTreeItem;
      const project = groupItem.project!;
      const allScripts = ScriptService.instance.getScripts(project.path);

      return allScripts
        .filter(s => !s.hidden && !s.name.startsWith('_') && (s.group || 'Uncategorized') === groupItem.label)
        .map(s => new ScriptTreeItem(s, project) as TreeElement);
    }

    return [];
  }
}

class GroupTreeItem extends vscode.TreeItem {

  constructor(public readonly label: string,
    public readonly contextValue: 'projectGroup' | 'scriptGroup',
    public readonly project?: Project, /* Only for script groups */
    isExpanded: boolean = false
  ) {
    super(label, isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('folder');
  }

}

export class ProjectTreeItem extends vscode.TreeItem {

  constructor(public readonly project: Project) {
    const collapsibleState = project.isActive
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.Collapsed;
    const label = project.isActive ? `★★★ ${project.name} ★★★` : project.name;

    super(label, collapsibleState);
    this.contextValue = 'project';
    this.resourceUri = vscode.Uri.file(project.path);
    this.iconPath = new vscode.ThemeIcon('repo');

    const staticDescription = project.description || '';
    const dynamicDescription = readFileContents(project.descriptionFile || '');
    const longDescriptionContent = readFileContents(project.longDescriptionFile || '');
    this.description = dynamicDescription ? dynamicDescription : staticDescription;

    if (longDescriptionContent) {
      this.tooltip = new vscode.MarkdownString(longDescriptionContent);
    } else if (this.description) {
      this.tooltip = new vscode.MarkdownString(`**${project.name}**\n\n---\n\n${this.description}`);
    } else {
      this.tooltip = project.name;
    }
  }

}

export class ScriptTreeItem extends vscode.TreeItem {

  constructor(
    public readonly script: Script,
    public readonly project: Project
  ) {
    super(script.name, vscode.TreeItemCollapsibleState.None);
    // this.description = script.description;
    this.contextValue = 'script';
    this.iconPath = new vscode.ThemeIcon('play-circle');
    this.tooltip = script.description || script.name;
  }

}