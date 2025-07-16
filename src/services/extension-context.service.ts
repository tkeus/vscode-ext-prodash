import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectsTreeNodesProvider } from './project-tree-nodes-provider.Service';
import { proDashFolderName, projectsJsonFileName, projectsJsoncFileName, scriptsJsonFileName, scriptsJsoncFileName } from '../constants';
import { Project, ProjectConfiguration } from '../models/project.model';
import { ProDashTreeNodeProvider } from '../models/tree-node-provider';
import { DynamicGroup } from '../models/dynamic-group.model';
import { ConfigurationService } from './configuration.service';
import { ScriptConfiguration } from '../models/script.model';
import { FileWatcherService } from './file-watcher.service';
import { LoggingService } from './logging.service';

/*******************************************************************************

 * Singleton service that manages the extension context, project groups, and script groups.
 * Handles loading and initializing project groups from groups.json,
 * manages the workspace folder, and provides utility methods for scripts and groups.

*******************************************************************************/

export class ExtensionContextService extends ProDashTreeNodeProvider<DynamicGroup<Project> | Project> {
  /** The display name for the root node. Required by ProDashTreeItem, but not displayed. */
  name: string = 'ProDash Root';

  /** Provider for the project tree nodes in the VS Code UI. */
  public projectsTreeNodesProvider: ProjectsTreeNodesProvider | undefined;

  /** Singleton instance of the ExtensionContextService. */
  private static _instance: ExtensionContextService;

  /** Tracks projects for which ON_ACTIVATE scripts have already run this session. */
  private _onActivateScriptsRun = new Set<string>();

  /** List of all top-level nodes (groups or projects) loaded from groups.json. */
  private _topLevelNodes: (DynamicGroup<Project> | Project)[] = [];

  /** Full path to the projects configuration file. */
  private _projectsJsonPath: string = '';

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
  get topLevelNodes(): (DynamicGroup<Project> | Project)[] {
    return this._topLevelNodes;
  }

  /**
   * Loads and initializes project groups from the groups.json file.
   * If the current workspace is not registered, adds a "(not registered)" group.
   */
  initializeProjectGroups() {
    FileWatcherService.instance.clear();

    this._topLevelNodes = [];
    const groups = new Map<string, DynamicGroup<Project>>();
    
    const prodashHomeDir = path.join(os.homedir(), proDashFolderName);
    const projectsJsoncPath = path.join(prodashHomeDir, projectsJsoncFileName);
    const projectsJsonPath = path.join(prodashHomeDir, projectsJsonFileName);

    let configPathToLoad: string | undefined;
    let configFileNameToLoad: string | undefined;

    if (fs.existsSync(projectsJsoncPath)) {
      this._projectsJsonPath = projectsJsoncPath;
      configPathToLoad = projectsJsoncPath;
      configFileNameToLoad = projectsJsoncFileName;
    } else if (fs.existsSync(projectsJsonPath)) {
      this._projectsJsonPath = projectsJsonPath;
      configPathToLoad = projectsJsonPath;
      configFileNameToLoad = projectsJsonFileName;
    } else {
      this._projectsJsonPath = projectsJsoncPath;
    }

    // Watch projects.jsonc for changes and refresh the tree view.
    const refreshCallback = (uri: vscode.Uri) => this.projectsTreeNodesProvider?.refreshProjects(`'${path.basename(uri.fsPath)}' changed.`);
    FileWatcherService.instance.watch(this._projectsJsonPath, refreshCallback);

    const projectConfigs = configPathToLoad && configFileNameToLoad
      ? ConfigurationService.instance.loadConfiguration<(ProjectConfiguration & { group?: string })[]>(configPathToLoad, configFileNameToLoad)
      : undefined;

    if (projectConfigs) {
      for (const projectConfig of projectConfigs) {
        const project = new Project(projectConfig);
        if (projectConfig.group) {
          let group = groups.get(projectConfig.group);
          if (!group) {
            group = new DynamicGroup<Project>(projectConfig.group, this);
            groups.set(projectConfig.group, group);
            this._topLevelNodes.push(group);
          }
          group.children.push(project);
          project.parent = group;
        } else {
          project.parent = this;
          this._topLevelNodes.push(project);
        }
      }
    }

    let alreadyRegistered = false;
    for (const node of this._topLevelNodes) {
      if (node instanceof Project && node.isActive) {
        alreadyRegistered = true;
        break;
      }
      if (node instanceof DynamicGroup && node.children.some(p => p.isActive)) {
        alreadyRegistered = true;
        break;
      }
    }

    const wsPath = ExtensionContextService.instance.workSpaceFolder;
    if (wsPath && !alreadyRegistered) { // Current Workspace folder is not registered - Create a "(not registered)" group
      this.addUnregisteredWorkspaceProject();
    }
  }

  /**
   * Adds the current workspace as a temporary, ungrouped project if it's not registered.
   */
  addUnregisteredWorkspaceProject() {
    const wsPath = ExtensionContextService.instance.workSpaceFolder;
    const wsProject = new Project({
      name: path.basename(wsPath), path: wsPath,
      description: `Current workspace folder (not registered in ${projectsJsoncFileName})`});
    wsProject.isActive = true;
    wsProject.parent = this;
    this._topLevelNodes.unshift(wsProject); // Add to the top of the list
  }

  /** Gets the path to the projects configuration file. */
  get projectsJsonPath(): string {
    return this._projectsJsonPath;
  }

  /**
   * Executes the ON_ACTIVATE event scripts for a given project, ensuring they only run once per session.
   * @param project The project to run activation scripts for.
   */
  public runActivateScriptsForProject(project: Project): void {
    if (this._onActivateScriptsRun.has(project.path)) {
      return; // Already run for this project path in this session
    }

    const activateScripts = project.getAllScripts().filter(s => s.event === 'ON_ACTIVATE');
    if (activateScripts.length > 0) {
      LoggingService.instance.logInfo(`Running ON_ACTIVATE scripts for project '${project.name}'...`);
      for (const script of activateScripts) {
        script.execute();
      }
      this._onActivateScriptsRun.add(project.path);
    }
  }
  
  private getActiveProject(): Project | undefined {
    for (const node of this._topLevelNodes) {
      if (node instanceof Project && node.isActive) {
        return node;
      }
      if (node instanceof DynamicGroup) {
        const activeProject = node.children.find(p => p.isActive);
        if (activeProject) {
          return activeProject;
        }
      }
    }
    return undefined;
  }

  private _getScriptsPath(proDashPath: string): string | undefined {
    const scriptsJsoncPath = path.join(proDashPath, scriptsJsoncFileName);
    if (fs.existsSync(scriptsJsoncPath)) {
      return scriptsJsoncPath;
    }

    const scriptsJsonPath = path.join(proDashPath, scriptsJsonFileName);
    if (fs.existsSync(scriptsJsonPath)) {
      return scriptsJsonPath;
    }

    return undefined;
  }

  /** Gets the path to the scripts configuration file for the active project, if any. */
  get scriptsJsonPath(): string {
    const activeProject = this.getActiveProject();
    if (activeProject?.proDashPath) {
      return this._getScriptsPath(activeProject.proDashPath) || '';
    }
    return '';
  }

  /**
   * Loads and returns the script group configurations for a given project.
   * @param project The project to load script groups for.
   */
  initializeScripts(project: Project): ScriptConfiguration[] {
    if (project.proDashPath) {
      const scriptsPath = this._getScriptsPath(project.proDashPath);
      if (scriptsPath) {
        // Watch scripts.jsonc for changes and refresh the tree view.
        const refreshCallback = (uri: vscode.Uri) => this.projectsTreeNodesProvider?.refreshProjects(`'${path.basename(uri.fsPath)}' in project '${project.name}' changed.`);
        FileWatcherService.instance.watch(scriptsPath, refreshCallback);

        const scriptConfigs = ConfigurationService.instance.loadConfiguration<ScriptConfiguration[]>(scriptsPath, path.basename(scriptsPath));
        return scriptConfigs || [];
      }
    }
    return [];
}

  /** Returns the context value for the root node (used for context menus). */
  getContextValue(): string {
    return 'ProjectGroups';
  }

  /** Returns the direct child project groups of the extension context. */
  getChildNodes(): (DynamicGroup<Project> | Project)[] {
    return this.topLevelNodes;
  }
  
}
