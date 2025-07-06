import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createFolderIfNotExist, createTextFileIfNotExist, findUpDirectoryWithName, isParentPathOf, readFileContents } from '../utils/file-utils';
import { proDashFolderName, projectDescriptionFileName, scriptsJsonFileName } from '../constants';
import { ExtensionContextService } from '../services/extension-context.service';
import { ProjectGroup } from './project-group.model';
import { ScriptGroupConfiguration, ScriptGroup } from './script-group.model';
import { ProDashTreeNodeProvider } from './tree-node-provider';
import { ProDashNode } from './prodash-node.model';

/**
 * Represents a project in ProDash.
 * Handles initialization, script group loading, and provides tree nodes for the UI.
 */
export interface ProjectConfiguration {
  name: string;
  path: string;
  description: string;
  scriptGroups?: ScriptGroupConfiguration[];
}

export class Project extends ProDashTreeNodeProvider<ScriptGroup> implements ProjectConfiguration {
  /** The display name of the project. */
  name!: string;

  /** The absolute path to the project folder. */
  path!: string;

  /** The project description. */
  description!: string;

  /** The script groups associated with this project. */
  scriptGroups?: ScriptGroup[];

  /** The parent project group. */
  parent?: ProjectGroup;

  /** Indicates if this project is currently active. */
  isActive?: boolean;

  /** The resolved path to the .prodash folder for this project. */
  private _proDashPath?: string;

  /** The resolved path to the .git folder for this project. */
  private _gitPath?: string;

  /** The resolved path to the runtime description file for this project. */
  private _descriptionFile?: string;

  constructor(data: ProjectConfiguration) {
    super();
    Object.assign(this, data);

    this.isActive = false;
    const wsPath = ExtensionContextService.instance.workSpaceFolder;
    if (wsPath && isParentPathOf(wsPath, this.path)) {
      this.isActive = true;
    }
  
    this.initializeProDashPath();
    if (this.proDashPath) {
      this._descriptionFile = path.join(this.proDashPath, projectDescriptionFileName);
    }

    const scriptGroupConfigs = ExtensionContextService.instance.initializeScripts(this);
    if (scriptGroupConfigs) {
      this.scriptGroups = scriptGroupConfigs.map(g => new ScriptGroup(g));
    }
        
    // forward parenthood + check activeProject contents
    if (this.scriptGroups) {
      for (const scriptGroup of this.scriptGroups) {
        scriptGroup.parent = this;  
      };
    }
  }

  get additionalDescriptionFromFile(): string {
    return readFileContents(this._descriptionFile || '');
  }

  get descriptionFile(): string | undefined {
    return this._descriptionFile;
  }

  initializeProDashPath(): void {
    this._proDashPath = findUpDirectoryWithName(this.path, proDashFolderName);
    this._gitPath = findUpDirectoryWithName(this.path, '.git');
      
    if (this.isActive && this._gitPath) { // Optionally update .git/info/exclude
      const excludePath = path.join(this._gitPath, 'info', 'exclude');
      let excludeContent = '';
      if (fs.existsSync(excludePath)) {
        excludeContent = fs.readFileSync(excludePath, 'utf8');
      }
      if (!excludeContent.includes(proDashFolderName + '/*.*')) {
        excludeContent += (excludeContent.endsWith('\n') ? '' : '\n') + proDashFolderName + '/*.*\n';
        fs.writeFileSync(excludePath, excludeContent, 'utf8');
      }
    }
    
    if (!this._proDashPath) { // Optionally create .prodash and scripts.json in project root
      if (this.isActive) {
        this._proDashPath = this._gitPath ? path.join(this._gitPath, proDashFolderName) : path.join(this.path, proDashFolderName);
        createFolderIfNotExist(this._proDashPath);
        let scriptsJsonFile = path.join(this._proDashPath, scriptsJsonFileName);
        const template = [{ name: "Sample", scripts: [{ name: "Hello", description: "Hello World", script: ["echo 'Hello World!'"] }] }];
        createTextFileIfNotExist(scriptsJsonFile, JSON.stringify(template, null, 2));
      }
    }          
  }
  
  /** Returns the resolved path to the .prodash folder for this project, if any. */
  get proDashPath(): string | undefined {
    return this._proDashPath;
  }

  setupTreeNode(projectNode: ProDashNode) {
    if (this.isActive) {
      projectNode.label = `★★★ ${this.name} ★★★`;
    }
    console.log("label", projectNode.label);
    const moreDescription = this.additionalDescriptionFromFile;
    console.log("moreDescription", moreDescription);
    projectNode.description = moreDescription ? ' - ' + moreDescription : '';
    console.log("description", projectNode.description);
    projectNode.tooltip = moreDescription ? `${this.name}\n${moreDescription}` : this.name;
    // Expand if active, otherwise collapsed
    projectNode.collapsibleState = this.isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
  }

  getContextValue(): string {
    return 'Project';
  }

  getChildNodes(): ScriptGroup[] {
    return this.scriptGroups || [];
  }

}
