import * as vscode from 'vscode';
import { ExtensionContextService } from '../services/extension-context.service';
import { ScriptGroup } from './script-group.model';
import { ProDashNode } from './prodash-node.model';
import { ProDashTreeNodeProvider } from './tree-node-provider';

export type TerminalScript = 'batch' | 'powershell' | '';

/**
 * Represents a script that can be executed in a terminal.
 * Handles variable resolution and execution logic.
 */
export interface ScriptConfiguration {
  name: string;
  path: string;
  description: string;
  terminal?: TerminalScript;
  script: string[];
}

export class Script extends  ProDashTreeNodeProvider<null> implements ScriptConfiguration {
  /** The display name of the script. */
  name!: string;

  /** The path associated with the script (if any). */
  path!: string;

  /** The script description. */
  description!: string;

  /** The terminal type for execution ('batch', 'powershell', or ''). */
  terminal?: TerminalScript;

  /** The script lines to execute. */
  script!: string[];

  /** The parent script group for this script. */
  parent?: ScriptGroup; 

  constructor(data: ScriptConfiguration) {
    super();
    Object.assign(this, data);
  }

  resolveVariable(name: string, script: Script): string {
    const context = ExtensionContextService.instance;
    const project = script.parent?.parent;

    let result = `{{${name}}}`; // do nothing ?
    switch (name) {
        case 'PROJECT_PATH':
          if (project) {
            result = project.path || result;
          }
          break;
        case 'PRODASH_PATH':
          if (context && project) {
            result = project.proDashPath || result;
          }
          break;
        case 'DESCRIPTION_FILE':
          if (context && project) {
            result = project.descriptionFile || result;
          }
          break;
        case 'GROUPS_PATH':
          if (context) {
            result = context.groupsJsonPath || result;
          }
          break;
        default:
            console.warn(`No Value for {{${name}}}`);
    }
    return result;
  }

  replaceVariablesInScript(scriptLine: string, resolver: (name: string, script: Script) => string, script: Script): string {
    return scriptLine.replace(/\{\{(\w+)\}\}/g, (_, name) => resolver(name, script));
  }

  /**
  * Ensures a terminal with the appropriate shell exists and is visible. If not, it creates a new one.
  * Then, executes the given script in the terminal (Sends each script line to the terminal for execution).
  */
  execute(): void {
    const terminalName = (this.terminal === 'powershell') ? 'Scripts Runner - PowerShell' : 'Scripts Runner';
    let vscodeTerminal: vscode.Terminal | undefined = undefined;

    // Search for an existing terminal with the same name
    vscodeTerminal = vscode.window.terminals.find(t => t.name === terminalName);
    // If no existing terminal found, create a new one
    if (!vscodeTerminal) {
      const shellPath = this.terminal === 'powershell' ? 'PowerShell.exe' : 'cmd.exe';
      vscodeTerminal = vscode.window.createTerminal({ name: terminalName, shellPath });
    }
    vscodeTerminal.show(false);

    this.script.forEach((scriptLine) => {
      const lineToExecute = this.replaceVariablesInScript(scriptLine, this.resolveVariable, this);
      vscodeTerminal.sendText(lineToExecute, true);
    });
  }

  setupTreeNode(scriptNode: ProDashNode) {
    scriptNode.tooltip = this.description ? this.description : this.name;
 }

  getContextValue(): string {
    return 'Script';
  }

  getChildNodes()  {
    return [];
  }

}
