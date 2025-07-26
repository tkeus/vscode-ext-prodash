import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LoggingService } from './services/logging.service';
import { FileWatcherService } from './services/file-watcher.service';
import { ProDashTreeProvider, ProjectTreeItem, ScriptTreeItem } from './ui/pro-dash-tree-provider';
import { ScriptExecutionService } from './services/script-execution.service';
import { showTextFileEditor } from './utils/file-utils';
import { ProjectService } from './services/project.service';
import { proDashFolderName, projectsJsoncFileName, scriptsJsoncFileName, templatesSubFolderName } from './constants';

/**
 * Called when the extension is activated.
 * Registers tree data providers, commands, and initializes services.
 * @param context The VS Code extension context
 */
export async function activate(context: vscode.ExtensionContext) {

  copyTemplates(context, false);

  // Create the Tree Provider
  const proDashTreeProvider = new ProDashTreeProvider();

  // Register the Tree View
  const treeView = vscode.window.createTreeView('prodash.projectsView', {
    treeDataProvider: proDashTreeProvider
  });

  FileWatcherService.instance.init(proDashTreeProvider);
  context.subscriptions.push(treeView);

  // Register commands
  const refreshCommand = vscode.commands.registerCommand('prodash.refresh', () => {
    proDashTreeProvider.refresh();
  });
  context.subscriptions.push(refreshCommand);

  const runScriptCommand = vscode.commands.registerCommand('prodash.runScript', (item: ScriptTreeItem) => {
    if (item && item.script && item.project) {
      ScriptExecutionService.instance.execute(item.script, item.project);
    }
  });
  context.subscriptions.push(runScriptCommand);

  const openProjectCommand = vscode.commands.registerCommand('prodash.openFolder', (item: ProjectTreeItem) => {
    vscode.commands.executeCommand('vscode.openFolder', item.resourceUri, false);
  });
  context.subscriptions.push(openProjectCommand);

  const editScriptsCommand = vscode.commands.registerCommand('prodash.editScriptsJson',
    () => {
      LoggingService.instance.logInfo(`globalConfigurationPath: ${ProjectService.instance.globalConfigurationPath}`);
      showTextFileEditor(ProjectService.instance.currentProject?.scriptJsonFile);
    });
  context.subscriptions.push(editScriptsCommand);

  const editProjectsCommand = vscode.commands.registerCommand('prodash.editProjectsJson',
    () => {
      LoggingService.instance.logInfo(`globalConfigurationPath: ${ProjectService.instance.globalConfigurationPath}`);
      showTextFileEditor(ProjectService.instance.globalConfigurationFileNameAndPath);
    });
  context.subscriptions.push(editProjectsCommand);

  const resetTemplatesCommand = vscode.commands.registerCommand('prodash.resetTemplates', () => {
    vscode.window.showWarningMessage(
      'Are you sure you want to reset your global templates to the default? This will overwrite your changes in ~/.prodash/template.',
      { modal: true },
      'Reset Templates'
    ).then(selection => {
      if (selection === 'Reset Templates') {
        copyTemplates(context, true);
        vscode.window.showInformationMessage('ProDash global templates have been reset.');
      }
    });
  });
  context.subscriptions.push(resetTemplatesCommand);

  const openGlobalTemplatesFolderCommand = vscode.commands.registerCommand('prodash.openGlobalTemplatesFolder', () => {
    const globalTemplatesPath = path.join(os.homedir(), proDashFolderName, templatesSubFolderName);
    LoggingService.instance.logInfo(`Opening global templates folder: ${globalTemplatesPath}`);
    if (fs.existsSync(globalTemplatesPath)) {
      vscode.env.openExternal(vscode.Uri.file(globalTemplatesPath));
    } else {
      vscode.window.showErrorMessage('ProDash global template folder not found. It should be created on startup.');
      LoggingService.instance.logWarning('Attempted to open global templates folder, but it does not exist.');
    }
  });
  context.subscriptions.push(openGlobalTemplatesFolderCommand);
}

function copyTemplates(context: vscode.ExtensionContext, force: boolean) {
  const globalProdashPath = path.join(os.homedir(), proDashFolderName);
  const globalTemplatesPath = path.join(globalProdashPath, templatesSubFolderName);

  // Ensure global .prodash and .prodash/template directories exist
  if (!fs.existsSync(globalProdashPath)) {
    fs.mkdirSync(globalProdashPath, { recursive: true }); // This is fine for one-time setup
  }
  if (!fs.existsSync(globalTemplatesPath)) {
    fs.mkdirSync(globalTemplatesPath, { recursive: true }); // This is fine for one-time setup
  }

  const sourceTemplatesPath = path.join(context.extensionPath, templatesSubFolderName);
  const templateFiles = [projectsJsoncFileName, scriptsJsoncFileName];

  for (const file of templateFiles) {
    const sourceFile = path.join(sourceTemplatesPath, file);
    const destFile = path.join(globalTemplatesPath, file);

    // If force is false, only copy if destination doesn't exist.
    if (fs.existsSync(sourceFile) && (force || !fs.existsSync(destFile))) {
      try {
        fs.copyFileSync(sourceFile, destFile);
        const action = force ? 'Reset' : 'Copied';
        LoggingService.instance.logInfo(`${action} template file '${file}' in global configuration.`);
      } catch (error) {
        const action = force ? 'reset' : 'copy';
        LoggingService.instance.logError(`Failed to ${action} template file '${file}'.`, error);
      }
    }
  }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate() {
  FileWatcherService.instance.dispose();
  LoggingService.instance.dispose();
}