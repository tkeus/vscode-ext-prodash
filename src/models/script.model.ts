import * as vscode from 'vscode';
import { ExtensionContextService } from '../services/extension-context.service';
import { LoggingService } from '../services/logging.service';
import { TerminalService } from '../services/terminal.service';
import { ProDashNode } from './prodash-node.model';
import { ProDashTreeNodeProvider } from './tree-node-provider';
import { DynamicGroup } from './dynamic-group.model';
import { Project } from './project.model';

export type TerminalScript = 'batch' | 'powershell' | '';

/**
 * Represents a script that can be executed in a terminal.
 * Handles variable resolution and execution logic.
 */
export interface ScriptConfiguration {
  name: string;
  description?: string;
  terminal?: TerminalScript;
  script: string[];
  group?: string;
  hidden?: boolean;
  event?: 'ON_ACTIVATE';
}

export class Script extends  ProDashTreeNodeProvider<null> implements ScriptConfiguration {
  /** The display name of the script. */
  name!: string;

  /** The script description. */
  description?: string;

  /** The terminal type for execution ('batch', 'powershell', or ''). */
  terminal?: TerminalScript;

  /** The script lines to execute. */
  script!: string[];

  /** If true, the script will not be shown in the tree. */
  hidden?: boolean;

  /** The event that triggers the script's execution. */
  event?: 'ON_ACTIVATE';

  /** The parent node for this script (either a DynamicGroup or a Project). */
  parent?: DynamicGroup<Script> | Project;

  constructor(data: ScriptConfiguration) {
    super();
    Object.assign(this, data);
  }

  private resolveVariable(name: string): string {
    const context = ExtensionContextService.instance;
    const project = this.getProject();
    const fallback = `{{${name}}}`;

    switch (name) {
        case 'PROJECT_PATH':
          return project?.path ?? fallback;
        case 'PRODASH_PATH':
          return project?.proDashPath ?? fallback;
        case 'DESCRIPTION_FILE':
          return project?.descriptionFile ?? fallback;
        case 'LONGDESCRIPTION_FILE':
          return project?.longDescriptionFile ?? fallback;
        case 'GROUPS_PATH':
          // groupsJsonPath can be an empty string, which is a valid state.
          return context.projectsJsonPath || fallback;
        default:
            LoggingService.instance.logWarning(`Could not resolve variable '{{${name}}}'`);
            return fallback;
    }
  }

  getProject(): Project | undefined {
    let current: DynamicGroup<Script> | Project | undefined = this.parent;
    while (current) {
      if (current instanceof Project) {
        return current;
      }
      // The parent of a script can be a DynamicGroup, so we traverse up
      // the tree until we find the containing Project.
      // If not a project, it must be a DynamicGroup<Script>. Its parent must be a Project.
      if (current.parent instanceof Project) {
        current = current.parent;
      } else {
        // This indicates a configuration error, so we stop.
        return undefined;
      }
    }
    return undefined;
  }

  private replaceVariablesInScript(scriptLine: string): string {
    return scriptLine.replace(/\{\{(\w+)\}\}/g, (_, name) => this.resolveVariable(name));
  }

  private expandScriptCalls(scriptLines: string[], expandedLines: string[] = [], callStack: string[] = []): string[] {
    for (const line of scriptLines) {
      const scriptCallMatch = line.match(/\{\{RUN_SCRIPT:([^}]+)\}\}/);
      if (scriptCallMatch) {
        const calledScriptName = scriptCallMatch[1].trim();

        // Check for circular dependencies
        if (callStack.includes(calledScriptName)) {
          LoggingService.instance.logError(`Circular script call detected: ${callStack.join(' -> ')} -> ${calledScriptName}`);
          continue; // Skip this call to prevent infinite recursion
        }

        const project = this.getProject();
        const calledScript = project?.getAllScripts().find(s => s.name === calledScriptName);

        if (calledScript) {
          const callerTerminal = this.terminal || '';
          const calledTerminal = calledScript.terminal || '';

          if (callerTerminal !== calledTerminal) {
            const message = `Script '${this.name}' (terminal: ${callerTerminal || 'default'}) cannot call script '${calledScriptName}' (terminal: ${calledTerminal || 'default'}). Terminal types must match.`;
            LoggingService.instance.logError(message);
            throw new Error('Terminal type mismatch');
          }

          this.expandScriptCalls(calledScript.script, expandedLines, [...callStack, calledScriptName]);
        } else {
          LoggingService.instance.logError(`Script '${calledScriptName}' not found.`);
        }
      } else {
        expandedLines.push(line);
      }
    }
    return expandedLines;
  }

  /**
  * Resolves variables in the script lines and passes them to the TerminalService for execution.
  */
  execute(): void {
    try {
      const expandedScript = this.expandScriptCalls(this.script).map(line => this.replaceVariablesInScript(line));
      TerminalService.instance.runInTerminal(expandedScript, this.terminal);
    } catch (e) {
      if (e instanceof Error && e.message === 'Terminal type mismatch') {
        LoggingService.instance.logError(`Execution of script '${this.name}' aborted.`);
      } else {
        LoggingService.instance.logError(`An unexpected error occurred during script '${this.name}' execution: ${e}`);
      }
    }
  }

  setupTreeNode(scriptNode: ProDashNode) {
    scriptNode.tooltip = this.description || this.name;
 }

  getContextValue(): string {
    return 'Script';
  }

  getChildNodes()  {
    return [];
  }

}
