import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { Project, ProjectGroups } from '../types';
import { ConfigurationService } from './configuration.service';
import { proDashFolderName, projectDescriptionFileName, projectFullDescriptionFileName, projectLongDescriptionFileName, projectsJsoncFileName, scriptsJsoncFileName, templatesSubFolderName } from '../constants';
import { LoggingService } from './logging.service';
import { isParentPathOf, findUpDirectoryWithName, createFolderIfNotExist, createTextFileIfNotExist } from '../utils/file-utils';
import { ScriptService } from './script.service';
import { ScriptExecutionService } from './script-execution.service';

/**
 * A singleton service for loading, resolving, and managing project configurations.
 */
export class ProjectService {
  private static _instance: ProjectService;
  private _projects: Project[] = [];
  private _globalConfigurationFile: string;
  private _currentProject: Project | undefined;

  private constructor() {
    this._globalConfigurationFile = path.join(os.homedir(), proDashFolderName, projectsJsoncFileName);
    this.loadAndResolveProjects();
  }

  public static get instance(): ProjectService {
    if (!ProjectService._instance) {
      ProjectService._instance = new ProjectService();
    }
    return ProjectService._instance;
  }

  /**
   * Gets the project that is currently active in the workspace.
   */
  public get currentProject(): Project | undefined {
    return this._currentProject;
  }

  public get globalConfigurationPath(): string {
    return path.dirname(this._globalConfigurationFile);
  }

  public get globalConfigurationFileNameAndPath(): string {
    return this._globalConfigurationFile;
  }

  /**
   * Returns a cached list of all fully resolved projects.
   */
  public getProjects(): Project[] {
    return this._projects;
  }

  /**
   * Reloads all project configurations from disk and resolves their properties.
   */
  public refresh(): void {
    this.loadAndResolveProjects();
  }

  /**
   * The main orchestration method to load, parse, and enrich project data.
   */
  private loadAndResolveProjects(): void {
    const configuredProjects = this.loadProjectsFromConfig();
    const workspaceFolderPaths = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
    const resolvedProjects: Project[] = [];
    const coveredWorkspaceFolders = new Set<string>();
    let activeProjectCount = 0;

    this._currentProject = undefined;

    // 1. Process projects from projects.jsonc
    for (const p of configuredProjects) {
      const activeWorkspacePaths = workspaceFolderPaths.filter(wsPath => isParentPathOf(p.path, wsPath));
      const isActive = activeWorkspacePaths.length > 0;

      if (isActive) {
        activeWorkspacePaths.forEach(wsPath => coveredWorkspaceFolders.add(wsPath));
      }

      const proDashPath = findUpDirectoryWithName(p.path, proDashFolderName);
      const gitPath = findUpDirectoryWithName(p.path, '.git');
      const scriptJsonFile = proDashPath ? path.join(proDashPath, scriptsJsoncFileName) : undefined;
      const descriptionFile = proDashPath ? path.join(proDashPath, projectDescriptionFileName) : undefined;
      const longDescriptionFile = proDashPath ? path.join(proDashPath, projectLongDescriptionFileName) : undefined;
      const fullDescriptionFile = proDashPath ? path.join(proDashPath, projectFullDescriptionFileName) : undefined;

      const resolvedProject: Project = {
        ...p,
        isActive,
        proDashPath,
        gitPath,
        scriptJsonFile,
        descriptionFile,
        longDescriptionFile,
        fullDescriptionFile,
      };

      if (isActive) {
        activeProjectCount++;
        if (!this._currentProject) {
          this._currentProject = resolvedProject;
        }
        this.initializeProjectFiles(resolvedProject);
      }
      resolvedProjects.push(resolvedProject);
    }

    // 2. Process any open workspace folders that weren't part of a configured project
    for (const wsPath of workspaceFolderPaths) {
      if (coveredWorkspaceFolders.has(wsPath)) {
        continue;
      }

      // This is an unregistered workspace, create a temporary project for it
      const proDashPath = findUpDirectoryWithName(wsPath, proDashFolderName);
      const gitPath = findUpDirectoryWithName(wsPath, '.git');
      const scriptJsonFile = proDashPath ? path.join(proDashPath, scriptsJsoncFileName) : undefined;
      const descriptionFile = proDashPath ? path.join(proDashPath, projectDescriptionFileName) : undefined;
      const longDescriptionFile = proDashPath ? path.join(proDashPath, projectLongDescriptionFileName) : undefined;
      const fullDescriptionFile = proDashPath ? path.join(proDashPath, projectFullDescriptionFileName) : undefined;

      const unregisteredProject: Project = {
        name: path.basename(wsPath), path: wsPath, group: 'Uncategorized',
        description: `(Unregistered workspace)`, isActive: true, proDashPath, gitPath,
        scriptJsonFile, descriptionFile, longDescriptionFile, fullDescriptionFile,
      };

      activeProjectCount++;
      if (!this._currentProject) {
        this._currentProject = unregisteredProject;
      }
      this.initializeProjectFiles(unregisteredProject);
      resolvedProjects.push(unregisteredProject);
    }

    this._projects = resolvedProjects;

    if (activeProjectCount > 1) {
      vscode.window.showWarningMessage(
        `Multiple active ProDash projects found. Commands will default to the first project: '${this._currentProject?.name}'.`
      );
    }
  }

  /**
   * Loads the raw project configurations from the global `projects.jsonc` file.
   */
  private loadProjectsFromConfig(): Project[] {
    const projectsData = ConfigurationService.instance.loadConfiguration<Project[] | ProjectGroups>(this._globalConfigurationFile);

    if (!projectsData) {
      return [];
    }

    const allProjects: Project[] = [];

    if (Array.isArray(projectsData)) {
      allProjects.push(...projectsData); // Old flat format
    } else { // New grouped format
      for (const groupName in projectsData) {
        if (Object.prototype.hasOwnProperty.call(projectsData, groupName) && !groupName.startsWith('_')) {
          const projectsInGroup = projectsData[groupName] || [];
          allProjects.push(...projectsInGroup.map(p => ({ ...p, group: groupName })));
        }
      }
    }
    return allProjects.filter(p => !p.name.startsWith('_')).map(p => ({ ...p, group: p.group ?? 'Uncategorized' }));
  }

  /**
   * Performs one-time setup for an active project, like creating the .prodash
   * folder or updating .gitignore. This is a mutable operation on the project object.
   */
  private initializeProjectFiles(project: Project): void {
    // If .prodash doesn't exist, create it and a sample scripts file.
    if (!project.proDashPath) {
      const newProDashPath = path.join(project.path, proDashFolderName);
      createFolderIfNotExist(newProDashPath);
      project.proDashPath = newProDashPath; // Mutate object for use in subsequent logic

      const newScriptsFile = path.join(newProDashPath, scriptsJsoncFileName);
      project.scriptJsonFile = newScriptsFile;

      const globalTemplateFile = path.join(os.homedir(), proDashFolderName, templatesSubFolderName, scriptsJsoncFileName);

      try {
        if (fs.existsSync(globalTemplateFile)) {
          fs.copyFileSync(globalTemplateFile, newScriptsFile);
          LoggingService.instance.logInfo(`Initialized '${scriptsJsoncFileName}' for project '${project.name}' from global template.`);
        } else {
          // Fallback to a default template if the global one doesn't exist
          const fallbackTemplate = JSON.stringify({ "Sample Group": [{ name: "Sample Script", script: "echo 'Hello from ProDash!'", description: "A sample script to get you started." }] }, null, 2);
          createTextFileIfNotExist(newScriptsFile, fallbackTemplate);
          LoggingService.instance.logWarning(`Global scripts template not found. Created a default '${scriptsJsoncFileName}' for project '${project.name}'.`);
        }
      } catch (error) {
        LoggingService.instance.logError(`Failed to create '${scriptsJsoncFileName}' for project '${project.name}'.`, error);
      }
    }

    // If a git repo exists, ensure .prodash output is ignored.
    if (project.gitPath) {
      const excludePath = path.join(project.gitPath, 'info', 'exclude');
      const ignorePattern = `${proDashFolderName}/*.*`;
      try {
        let excludeContent = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
        if (!excludeContent.includes(ignorePattern)) {
          excludeContent += (excludeContent.endsWith('\n') || excludeContent === '' ? '' : '\n') + ignorePattern + '\n';
          fs.writeFileSync(excludePath, excludeContent, 'utf8');
        }
      } catch (error) {
        LoggingService.instance.logWarning(`Could not update .git/info/exclude for project '${project.name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Run ON_ACTIVATE scripts if present
    const scripts = ScriptService.instance.getScripts(project.path);
    const activateScripts = scripts.filter(s => s.event === 'ON_ACTIVATE');
    if (activateScripts.length > 0) {
      LoggingService.instance.logInfo(`Running ON_ACTIVATE scripts for project '${project.name}'...`);
      // Execute scripts sequentially to avoid race conditions if one script depends on another.
      activateScripts.reduce(
        (promise, script) => promise.then(() => ScriptExecutionService.instance.execute(script, project)),
        Promise.resolve()
      ).catch(error => {
        LoggingService.instance.logError(
          `An error occurred during ON_ACTIVATE script execution for project '${project.name}'. Further activation scripts for this project were halted.`,
          error
        );
      });
    }
  }
}
