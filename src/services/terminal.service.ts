import * as vscode from 'vscode';
import { LoggingService } from './logging.service';

/**
 * A service for managing and interacting with VS Code terminals for script execution.
 * This service is implemented as a singleton.
 */
export class TerminalService {
  private static _instance: TerminalService;
  private warnedAboutFallback = false;

  private constructor() { }

  /**
   * Gets the singleton instance of the TerminalService.
   */
  public static get instance(): TerminalService {
    if (!TerminalService._instance) {
      TerminalService._instance = new TerminalService();
    }
    return TerminalService._instance;
  }

  /**
   * Executes a series of script lines in a dedicated terminal.
   * It finds an existing terminal or creates a new one based on the specified shell type.
   * @param scriptLines The array of command lines to execute.
   * @param terminalType The type of terminal to use ('batch', 'powershell', or default).
   */
  public async runInTerminal(scriptLines: string[], terminalType?: string): Promise<void> {
    const terminal = await this.getTerminal(terminalType);
    const hasShellIntegration = await this.waitForShellIntegration(terminal);

    for (const line of scriptLines) {
      if (hasShellIntegration && terminal.shellIntegration) {
        const execution = terminal.shellIntegration.executeCommand(line);
        await new Promise<void>((resolve, reject) => {
          const disposable = vscode.window.onDidEndTerminalShellExecution(e => {
            if (e.execution === execution) {
              disposable.dispose();
              // A non-zero exit code indicates an error. Undefined can happen on cancellation (e.g., Ctrl+C).
              // We will treat undefined as an error to halt the script sequence.
              if (e.exitCode === 0) {
                resolve();
              } else {
                reject(new Error(`Command "${line}" exited with code ${e.exitCode ?? 'undefined'}.`));
              }
            }
          });
        });
      } else {
        if (!this.warnedAboutFallback) {
          const msg = `Shell integration not available for terminal "${terminal.name}". Sequential execution of scripts is not guaranteed.`;
          LoggingService.instance.logWarning(msg);
          vscode.window.showWarningMessage(msg);
          this.warnedAboutFallback = true;
        }
        terminal.sendText(line, true);
      }
    }
  }

  private async getTerminal(terminalType?: string): Promise<vscode.Terminal> {
    const isPowershell = terminalType === 'powershell';
    const terminalName = isPowershell ? 'ProDash Runner (PowerShell)' : 'ProDash Runner';

    let terminal = vscode.window.terminals.find(t => t.name === terminalName && !t.exitStatus);
    if (!terminal) {
      const options: vscode.TerminalOptions = { name: terminalName };
      if (isPowershell) {
        options.shellPath = 'powershell';
      }
      terminal = vscode.window.createTerminal(options);
    }
    terminal.show(false);
    return terminal;
  }

  private async waitForShellIntegration(terminal: vscode.Terminal): Promise<boolean> {
    if (terminal.shellIntegration) {
      return true;
    }

    // Wait for shell integration to be ready, with a timeout as a fallback
    return new Promise<boolean>(resolve => {
      const disposable = vscode.window.onDidChangeTerminalShellIntegration(e => {
        if (e.terminal === terminal) {
          disposable.dispose();
          resolve(true);
        }
      });
      setTimeout(() => {
        disposable.dispose();
        resolve(!!terminal.shellIntegration);
      }, 3000);
    });
  }
}