import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createFolderIfNotExist, createTextFileIfNotExist, findUpDirectoryWithName, isParentPathOf, readFileContents } from '../utils/file-utils';
import { proDashFolderName, projectDescriptionFileName, projectLongDescriptionFileName, scriptsJsonFileName } from '../constants';
import { ExtensionContextService } from '../services/extension-context.service';
import { Script } from './script.model';
import { DynamicGroup } from './dynamic-group.model';
import { ProDashTreeItem, ProDashTreeNodeProvider } from './tree-node-provider';
import { ProDashNode } from './prodash-node.model';
import { FileWatcherService } from '../services/file-watcher.service';

/**
 * Represents a project in ProDash.
 * Handles initialization, script group loading, and provides tree nodes for the UI.
 */
export interface ProjectConfiguration {
  name: string;
  path: string;
  description: string;
  group?: string;
}

export class Project extends ProDashTreeNodeProvider<DynamicGroup<Script> | Script> implements ProjectConfiguration {
  /** The display name of the project. */
  name!: string;

  /** The absolute path to the project folder. */
  path!: string;

  /** The project description. */
  description!: string;

  /** The script nodes (groups or ungrouped scripts) for this project. */
  scriptNodes: (DynamicGroup<Script> | Script)[] = [];

  /** The parent project group. */
  parent?: ProDashTreeItem;

  /** Indicates if this project is currently active. */
  isActive?: boolean;

  /** The resolved path to the .prodash folder for this project. */
  private _proDashPath?: string;

  /** The resolved path to the .git folder for this project. */
  private _gitPath?: string;

  /** The resolved path to the runtime description file for this project. */
  private _descriptionFile?: string;

  /** The resolved path to the runtime long description file for this project. */
  private _longDescriptionFile?: string;

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
      this._longDescriptionFile = path.join(this.proDashPath, projectLongDescriptionFileName);

      // Watch description files for changes and refresh the tree view.
      const refreshCallback = (uri: vscode.Uri) => ExtensionContextService.instance.projectsTreeNodesProvider?.refreshProjects(`'${path.basename(uri.fsPath)}' in project '${this.name}' changed.`);
      FileWatcherService.instance.watch(this._descriptionFile, refreshCallback);
      FileWatcherService.instance.watch(this._longDescriptionFile, refreshCallback);
    }

    const scriptConfigs = ExtensionContextService.instance.initializeScripts(this);
    if (scriptConfigs) {
      const groups = new Map<string, DynamicGroup<Script>>();

      for (const scriptConfig of scriptConfigs) {
        const script = new Script(scriptConfig);

        if (scriptConfig.group) {
          const groupName = scriptConfig.group;
          let group = groups.get(groupName);
          if (!group) {
            group = new DynamicGroup<Script>(groupName, this);
            groups.set(groupName, group);
            this.scriptNodes.push(group);
          }
          group.children.push(script);
          script.parent = group;
        } else {
          script.parent = this;
          this.scriptNodes.push(script);
        }
      }
    }

    if (this.isActive) {
      ExtensionContextService.instance.runActivateScriptsForProject(this);
    }
  }

  get additionalDescriptionFromFile(): string {
    return readFileContents(this._descriptionFile || '');
  }

  get longDescriptionFromFile(): string {
    return readFileContents(this._longDescriptionFile || '');
  }

  get descriptionFile(): string | undefined {
    return this._descriptionFile;
  }

  get longDescriptionFile(): string | undefined {
    return this._longDescriptionFile;
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
        const scriptsJsonFile = path.join(this._proDashPath, scriptsJsonFileName);
        const template = [{
          name: "Hello",
          description: "Hello World",
          script: ["echo 'Hello World!'"],
          group: "Sample"
        }];
        createTextFileIfNotExist(scriptsJsonFile, JSON.stringify(template, null, 2));
      }
    }          
  }
  
  /** Returns the resolved path to the .prodash folder for this project, if any. */
  get proDashPath(): string | undefined {
    return this._proDashPath;
  }

  /** Returns a flattened list of all scripts in the project, including those in groups. */
  getAllScripts(): Script[] {
    const allScripts: Script[] = [];
    for (const node of this.scriptNodes) {
      if (node instanceof Script) {
        allScripts.push(node);
      } else if (node instanceof DynamicGroup) {
        allScripts.push(...node.children);
      }
    }
    return allScripts;
  }

  setupTreeNode(projectNode: ProDashNode) {
    if (this.isActive) {
      projectNode.label = `★★★ ${this.name} ★★★`;
    }
    const moreDescription = this.additionalDescriptionFromFile;
    projectNode.description = moreDescription ? ' - ' + moreDescription : '';
    const longDescription = this.longDescriptionFromFile;
    const tooltipDescription = longDescription || moreDescription;
    if (tooltipDescription) {
      projectNode.tooltip = new vscode.MarkdownString(tooltipDescription);
    } else {
      projectNode.tooltip = this.name;
    }
    // Expand if active, otherwise collapsed
    projectNode.collapsibleState = this.isActive ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
  }

  getContextValue(): string {
    return 'Project';
  }

  getChildNodes(): (DynamicGroup<Script> | Script)[] {
    return this.scriptNodes.filter(node => {
      if (node instanceof Script) {
        return !node.hidden;
      }
      if (node instanceof DynamicGroup) {
        // A group is visible if it has at least one visible child.
        return node.getChildNodes().length > 0;
      }
      return true;
    });
  }

}
