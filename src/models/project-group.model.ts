import * as vscode from 'vscode';
import * as path from 'path';
import { ProDashNode } from '../models/prodash-node.model';
import { ProjectConfiguration, Project } from './project.model';
import { ProDashTreeNodeProvider } from './tree-node-provider';

/**
 * Represents a group of projects in ProDash.
 * Handles initialization, active project detection, and provides tree nodes for the UI.
 */
export interface ProjectGroupConfiguration {
  name: string;
  projects: ProjectConfiguration[];
}

/**
 * Implements a group of projects for the ProDash tree.
 */
export class ProjectGroup extends ProDashTreeNodeProvider<Project> implements ProjectGroupConfiguration {
  /** The display name of the group. */
  name!: string;

  /** The list of projects in this group. */
  projects!: Project[];

  /** Indicates if this group contains the active project. */
  hasActiveProject: boolean;

  /**
   * Constructs a new ProjectGroup.
   * @param data The configuration for the project group.
   */
  constructor(data: ProjectGroupConfiguration) {
    super();
    Object.assign(this, data);
    this.projects = data.projects.map(p => new Project(p));
    this.hasActiveProject = false;
    
    // forward parenthood + check activeProject contents
    for (const project of this.projects) {
      project.parent = this;  
      if (project.isActive) {
            this.hasActiveProject = true;
      }
    };
  }

  /** Returns the active project in this group, if any. */
  get activeProject(): Project | undefined {
    if (!this.hasActiveProject) {
      return undefined;
    }
    for (const project of this.projects) {
      project.parent = this;  
      if (project.isActive) {
            return project;
      }
    };
  }

  /**
   * Sets up the tree node's icon and collapsible state for this group.
   * @param groupNode The node to set up.
   */
  setupTreeNode(groupNode: ProDashNode) {
    groupNode.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, '..', 'media', 'folder-light.svg')),
      dark: vscode.Uri.file(path.join(__dirname, '..', 'media', 'folder-dark.svg'))
    };
    groupNode.collapsibleState = !!this.hasActiveProject ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
  }

  /** Returns the context value for this group (used for context menus). */
  getContextValue(): string {
    return 'ExtensionRoot';
  }

  /** Returns the direct child projects of this group. */
  getChildNodes(): Project[] {
    return this.projects;
  }

}
