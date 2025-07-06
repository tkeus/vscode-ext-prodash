import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectsTreeNodesProvider } from './project-tree-nodes-provider.Service';
import { proDashFolderName, groupsJsonFileName, scriptsJsonFileName } from '../constants';
import { ProjectGroup, ProjectGroupConfiguration } from '../models/project-group.model';
import { Project } from '../models/project.model';
import { ScriptGroup, ScriptGroupConfiguration } from '../models/script-group.model';
import { ProDashTreeNodeProvider } from '../models/tree-node-provider';

/*******************************************************************************

 * Singleton service that manages the extension context, project groups, and script groups.
 * Handles loading and initializing project groups from groups.json,
 * manages the workspace folder, and provides utility methods for scripts and groups.

*******************************************************************************/

export class ExtensionContextService extends ProDashTreeNodeProvider<ProjectGroup> {
  /** Provider for the project tree nodes in the VS Code UI. */
  public projectsTreeNodesProvider: ProjectsTreeNodesProvider | undefined;

  /** Singleton instance of the ExtensionContextService. */
  private static _instance: ExtensionContextService;

  /** List of all project groups loaded from groups.json. */
  private _projectGroups: ProjectGroup[] = [];

  /** Full path to the groups.json configuration file. */
  private _groupsJsonPath: string = '';

  /** Path to the current workspace folder. */
  private _workSpaceFolder: string = '';

  /**
   * Constructs the ExtensionContextService and initializes project groups.
   * @param context The VS Code extension context.
   */
  constructor(context: vscode.ExtensionContext) {
    super();
    ExtensionContextService.instance = this;
    this.initializeProjectGroups();
  }

  /** Gets the singleton instance of the service. */
  static get instance() {
    return this._instance;
  }

  /** Sets the singleton instance of the service. */
  private static set instance(extensionService: ExtensionContextService) {
    ExtensionContextService._instance = extensionService;
  }

  /** Gets the path to the current workspace folder. */
  get workSpaceFolder() {
    if (!this._workSpaceFolder) {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        this._workSpaceFolder = workspaceFolders[0].uri.fsPath;
      }
    }
    return this._workSpaceFolder;
  }

  /** Gets the list of all project groups. */
  get projectGroups(): ProjectGroup[] {
    return this._projectGroups;
  }

  /**
   * Loads and initializes project groups from the groups.json file.
   * If the current workspace is not registered, adds a "(not registered)" group.
   */
  initializeProjectGroups() {
    try {
      this._groupsJsonPath = path.join(os.homedir(), proDashFolderName, groupsJsonFileName);
      const fileContent = fs.readFileSync(this._groupsJsonPath, 'utf8');
      const projectGroupsData: ProjectGroupConfiguration[] = JSON.parse(fileContent);
      this._projectGroups = projectGroupsData.map(g => new ProjectGroup(g));
    } catch (err) {
      this._projectGroups = [];
    }

    let alreadyRegistered = false;
    if (this.projectGroups) {
      for (const group of this.projectGroups) {
        if (group.hasActiveProject) {
          alreadyRegistered = true;
          break;
        }
      };
    }
    const wsPath = ExtensionContextService.instance.workSpaceFolder;
    if (wsPath && !alreadyRegistered) { // Current Workspace folder is not registered - Create a "(not registered)" group
      this.createNotRegisteredGroup();
    }
  }

  /**
   * Creates a "(not registered)" group for the current workspace if it is not already registered.
   */
  createNotRegisteredGroup() {
    const wsPath = ExtensionContextService.instance.workSpaceFolder;
    let notRegisteredGroup = this._projectGroups.find(g => g.name === '(not registered)');
    if (!notRegisteredGroup) {
      notRegisteredGroup = new ProjectGroup({ name: '(not registered)', projects: [] });
      this._projectGroups.push(notRegisteredGroup);
    }
    // Add the workspace as a project
    const wsProject = new Project({
      name: path.basename(wsPath), path: wsPath,
      description: `Current workspace folder (not registered in ${groupsJsonFileName})`});
    wsProject.isActive = true;
    wsProject.parent = notRegisteredGroup;
    wsProject.parent.hasActiveProject = true;
    const scriptGroupConfigs = ExtensionContextService.instance.initializeScripts(wsProject);
    if (scriptGroupConfigs) {
      wsProject.scriptGroups = scriptGroupConfigs.map(g => new ScriptGroup(g));
    }

    notRegisteredGroup.projects.push(wsProject);
  }

  /** Gets the path to the groups.json configuration file. */
  get groupsJsonPath(): string {
    return this._groupsJsonPath;
  }

  /** Gets the path to the scripts.json file for the active project, if any. */
  get scriptsJsonPath(): string {
    if (this.projectGroups) {
      for(const projects of this.projectGroups) {
        const project = projects.activeProject;
        if (project &&  project.proDashPath) {
          return path.join(project.proDashPath, scriptsJsonFileName);
        }
      }
    }
    return '';
  }

  /**
   * Loads and returns the script group configurations for a given project.
   * @param project The project to load script groups for.
   */
  initializeScripts(project: Project): ScriptGroupConfiguration[] {
    let scriptGroups: ScriptGroupConfiguration[] = [];
    try {
      if (project.proDashPath) {
        let scriptsJsonPath = path.join(project.proDashPath, scriptsJsonFileName);
        if (fs.existsSync(scriptsJsonPath)) {
          const fileContent = fs.readFileSync(scriptsJsonPath, 'utf8');
          scriptGroups = JSON.parse(fileContent);
        }
      }
    } catch (err) {
      console.error(`Failed to read ${scriptsJsonFileName}:`, err);
    }
    return scriptGroups;
  }

  /** Returns the context value for the root node (used for context menus). */
  getContextValue(): string {
    return 'ProjectGroups';
  }

  /** Returns the direct child project groups of the extension context. */
  getChildNodes(): ProjectGroup[] {
    return this.projectGroups;
  }
  
}
