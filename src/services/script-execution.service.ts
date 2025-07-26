import * as vscode from 'vscode';
import { LoggingService } from './logging.service';
import { ScriptService } from './script.service';
import { TerminalService } from './terminal.service';
import { Project, Script } from '../types';
import { ProjectService } from './project.service';

/**
 * A singleton service responsible for executing scripts. It can handle
 * placeholders and nested script calls.
 */
export class ScriptExecutionService {
  private static _instance: ScriptExecutionService;

  private constructor() { }

  public static get instance(): ScriptExecutionService {
    if (!ScriptExecutionService._instance) {
      ScriptExecutionService._instance = new ScriptExecutionService();
    }
    return ScriptExecutionService._instance;
  }

  /**
   * Executes a given script for a project. It resolves placeholders and handles
   * `{{RUN_SCRIPT:ScriptName}}` directives.
   * @param scriptToRun The script to execute.
   * @param project The project context for the script.
   */
  public async execute(scriptToRun: Script, project: Project): Promise<void> {
    LoggingService.instance.logInfo(`Executing script "${scriptToRun.name}" for project "${project.name}"...`);

    try {
      const allCommands = await this.resolveScript(scriptToRun, project, []);
      await TerminalService.instance.runInTerminal(allCommands, scriptToRun.terminal);
    } catch (error: any) {
      LoggingService.instance.logError(`Failed to execute script "${scriptToRun.name}": ${error.message}`);
      vscode.window.showErrorMessage(`ProDash: Failed to execute script "${scriptToRun.name}". See output for details.`);
      // Re-throw to ensure the promise chain in the caller is rejected
      throw error;
    }
  }

  /**
   * Safely resolves a path variable for script execution.
   * Returns an empty string for undefined paths and normalizes separators to forward slashes.
   * @param path The path to resolve.
   */
  private getSafePath(path: string | undefined): string {
    if (!path) {
      return '';
    }
    // Normalize to forward slashes for better cross-shell compatibility (especially with PowerShell and Git Bash)
    return path.replace(/\\/g, '/');
  }

  /**
   * Replaces known placeholders in a command string with their actual values from the project.
   * @param command The command string containing potential placeholders.
   * @param project The project context.
   * @returns The command with all placeholders resolved.
   */
  private resolveVariables(command: string, project: Project): string {
    // Using a regex to find all placeholders like {{VAR_NAME}}
    return command.replace(/\{\{([A-Z_]+)\}\}/g, (match, variableName) => {
      switch (variableName) {
        case 'PROJECT_PATH':
          return this.getSafePath(project.path);
        case 'PRODASH_PATH':
          return this.getSafePath(project.proDashPath);
        case 'GLOBALCONFIG_PATH':
          return this.getSafePath(ProjectService.instance.globalConfigurationPath);
        case 'DESCRIPTION_FILE':
          return this.getSafePath(project.descriptionFile);
        case 'LONGDESCRIPTION_FILE':
          return this.getSafePath(project.longDescriptionFile);
        case 'FULLDESCRIPTION_FILE':
          return this.getSafePath(project.fullDescriptionFile);
        default:
          LoggingService.instance.logWarning(`Could not resolve variable '${match}'`);
          return match; // Return the original placeholder if not found
      }
    });
  }

  /**
   * Recursively resolves a script's commands, including expanding `RUN_SCRIPT` directives.
   * @param script The script to resolve.
   * @param project The project context.
   * @param seenScripts A set to track scripts already being resolved to prevent infinite recursion.
   * @returns A promise that resolves to a flat array of command strings.
   */
  private async resolveScript(script: Script, project: Project, seenScripts: string[]): Promise<string[]> {
    if (seenScripts.includes(script.name)) {
      throw new Error(`Recursive script execution detected: "${script.name}" was called again.`);
    }
    seenScripts.push(script.name);

    const commands = Array.isArray(script.script) ? script.script : [script.script];
    const resolvedCommands: string[] = [];

    for (const command of commands) {
      const runScriptMatch = command.match(/\{\{RUN_SCRIPT:([^}]+)\}\}/);
      if (runScriptMatch) {
        const scriptNameToRun = runScriptMatch[1];
        const allProjectScripts = ScriptService.instance.getScripts(project.path);
        const nextScript = allProjectScripts.find(s => s.name === scriptNameToRun);

        if (!nextScript) {
          throw new Error(`Script "${scriptNameToRun}" not found in project "${project.name}".`);
        }

        // Prevent calling scripts with different terminal types.
        const parentTerminal = script.terminal || 'default';
        const childTerminal = nextScript.terminal || 'default';

        if (parentTerminal !== childTerminal) {
          throw new Error(`Script "${script.name}" (terminal: ${parentTerminal}) cannot call script "${nextScript.name}" (terminal: ${childTerminal}). Terminal types must match.`);
        }

        const nestedCommands = await this.resolveScript(nextScript, project, [...seenScripts]);
        resolvedCommands.push(...nestedCommands);
      } else {
        // Resolve all other variables in the command line
        resolvedCommands.push(this.resolveVariables(command, project));
      }
    }
    return resolvedCommands;
  }
}