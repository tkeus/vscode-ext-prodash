import * as vscode from 'vscode';
import { ExtensionContextService } from './services/extension-context.service';
import { showTextFileEditor } from './show-text-file-editor';
import { ProjectsTreeNodesProvider } from './services/project-tree-nodes-provider.Service';
import { LoggingService } from './services/logging.service';
import { FileWatcherService } from './services/file-watcher.service';

/**
 * Called when the extension is activated.
 * Registers tree data providers, commands, and initializes services.
 * @param context The VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
  new ExtensionContextService(context);
  ExtensionContextService.instance.projectsTreeNodesProvider = new ProjectsTreeNodesProvider();

  context.subscriptions.push(vscode.window.createTreeView('prodash.projectsView',
    { treeDataProvider: ExtensionContextService.instance.projectsTreeNodesProvider }));

  context.subscriptions.push(vscode.commands.registerCommand('prodash.refreshProjects',
    () => { ExtensionContextService.instance.projectsTreeNodesProvider?.refreshProjects(); }));
  context.subscriptions.push(vscode.commands.registerCommand('prodash.runScript',
    (resource) => { ExtensionContextService.instance.projectsTreeNodesProvider?.runScript(resource); }));
  context.subscriptions.push(vscode.commands.registerCommand('prodash.editScriptsJson',
    () => { showTextFileEditor(ExtensionContextService.instance.scriptsJsonPath); }));
  context.subscriptions.push(vscode.commands.registerCommand('prodash.openFolder',
    (resource) => { ExtensionContextService.instance.projectsTreeNodesProvider?.openFolder(resource); }));
  context.subscriptions.push(vscode.commands.registerCommand('prodash.editProjectsJson',
    () => { showTextFileEditor(ExtensionContextService.instance.projectsJsonPath); }));
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate() {
  FileWatcherService.instance.dispose();
  LoggingService.instance.dispose();
}
