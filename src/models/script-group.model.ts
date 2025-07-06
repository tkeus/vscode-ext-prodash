import * as vscode from 'vscode';
import * as path from 'path';
import { ProDashNode } from '../models/prodash-node.model';
import { Script, ScriptConfiguration } from './script.model';
import { Project } from './project.model';
import { ProDashTreeNodeProvider } from './tree-node-provider';

/**
 * Represents a group of scripts for a project in ProDash.
 * Handles initialization and provides tree nodes for the UI.
 */
export interface ScriptGroupConfiguration {
  name: string;
  scripts: ScriptConfiguration[];
}

export class ScriptGroup extends ProDashTreeNodeProvider<Script> implements ScriptGroupConfiguration {
  /** The display name of the script group. */
  name!: string;

  /** The list of scripts in this group. */
  scripts!: Script[];

  /** The parent project for this script group. */
  parent?: Project;

  constructor(data: ScriptGroupConfiguration) {
    super();
    Object.assign(this, data);
    this.scripts = data.scripts.map(s => new Script(s));

    // forward parenthood + check activeProject contents
    for (const script of this.scripts) {
      script.parent = this;  
    };
  }

  setupTreeNode(groupNode: ProDashNode) {
    groupNode.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, '..', 'media', 'arrow-right-light.svg')),
      dark: vscode.Uri.file(path.join(__dirname, '..', 'media', 'arrow-right-dark.svg'))
    };
    groupNode.collapsibleState = this.parent?.isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
 }

  getContextValue(): string {
    return 'ScriptGroup';
  }

  getChildNodes(): Script[] {
    return this.scripts;
  }

}
