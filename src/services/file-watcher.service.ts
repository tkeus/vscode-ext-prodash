import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LoggingService } from './logging.service';
import { ProDashTreeProvider } from '../ui/pro-dash-tree-provider';
import { ProjectService } from './project.service';
import { proDashFolderName, projectDescriptionFileName, projectFullDescriptionFileName, projectLongDescriptionFileName, projectsJsoncFileName, scriptsJsoncFileName } from '../constants';

/**
 * A singleton service for watching file system events for specific files.
 * This service allows registering callbacks for file changes, creations, or deletions.
 */
export class FileWatcherService {
  private static _instance: FileWatcherService;
  private watchers: vscode.FileSystemWatcher[] = [];
  private treeProvider: ProDashTreeProvider | undefined;
  private lastFileContents: Map<string, string> = new Map();

  private constructor() { }

  /**
   * Gets the singleton instance of the FileWatcherService.
   */
  public static get instance(): FileWatcherService {
    if (!FileWatcherService._instance) {
      FileWatcherService._instance = new FileWatcherService();
    }
    return FileWatcherService._instance;
  }

  /**
   * Initializes watchers for treeProvider.
   *
   * @param filePath The absolute path of the file to watch.
   * @param callback The function to execute when the file changes, is created, or is deleted.
   */
  public init(treeProvider: ProDashTreeProvider): void {
    this.treeProvider = treeProvider;
    this.dispose();

    const contentAwareRefresh = (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      let newContent: string;

      try {
        // If file is deleted, its content is empty. Otherwise, read it.
        newContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
      } catch (error) {
        LoggingService.instance.logWarning(`Could not read file ${filePath} for content check. Refreshing anyway. Error: ${error instanceof Error ? error.message : String(error)}`);
        this.treeProvider?.refresh();
        this.initWatchers(contentAwareRefresh);
        return;
      }

      const oldContent = this.lastFileContents.get(filePath);

      // If content is unchanged, do nothing.
      if (oldContent === newContent) {
        LoggingService.instance.logInfo(`Ignoring change for ${filePath} as content is identical.`);
        return;
      }

      // Content has changed, so update cache and refresh.
      LoggingService.instance.logInfo(`Config file changed: ${uri.fsPath}. Refreshing tree.`);
      LoggingService.instance.logInfo(`   previous content: ${oldContent}`);
      LoggingService.instance.logInfo(`   new content: ${newContent}`);
      this.lastFileContents.set(filePath, newContent);

      this.treeProvider?.refresh();
      // After a refresh, projects might have changed, so re-init watchers
      this.initWatchers(contentAwareRefresh);
    };

    this.initWatchers(contentAwareRefresh);
    LoggingService.instance.logInfo('File watchers initialized.');
  }

  private initWatchers(callback: (uri: vscode.Uri) => void): void {
    this.dispose();
    //this.lastFileContents.clear();

    const globalProjectsPath = path.join(os.homedir(), proDashFolderName, projectsJsoncFileName);
    this.createWatcher(globalProjectsPath, callback);

    for (const project of ProjectService.instance.getProjects()) {
      if (project.proDashPath) {
        this.createWatcher(path.join(project.proDashPath, scriptsJsoncFileName), callback);

        this.createWatcher(path.join(project.proDashPath, projectDescriptionFileName), callback);
        this.createWatcher(path.join(project.proDashPath, projectLongDescriptionFileName), callback);
        this.createWatcher(path.join(project.proDashPath, projectFullDescriptionFileName), callback);
      }
    }
  }

  private primeContentCache(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        this.lastFileContents.set(filePath, content);
      }
    } catch (error) {
      LoggingService.instance.logWarning(`Could not prime file content cache for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private createWatcher(filePath: string, callback: (uri: vscode.Uri) => void) {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath)));
    watcher.onDidChange(callback);
    watcher.onDidCreate(callback);
    watcher.onDidDelete(callback);
    this.watchers.push(watcher);
    // Prime the cache with the initial content of the file
    this.primeContentCache(filePath);
  }

  /**
   * Disposes of the service and all its watchers.
   * This should be called when the extension is deactivated.
   */
  public dispose(): void {
    this.watchers.forEach(w => w.dispose());
    this.watchers = [];
  }
}