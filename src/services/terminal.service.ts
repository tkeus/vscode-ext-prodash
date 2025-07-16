import * as vscode from 'vscode';
import { TerminalScript } from '../models/script.model';

/**
 * A service for managing and interacting with VS Code terminals for script execution.
 * This service is implemented as a singleton.
 */
export class TerminalService {
    private static _instance: TerminalService;

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
    public runInTerminal(scriptLines: string[], terminalType?: TerminalScript): void {
        const isPowershell = terminalType === 'powershell';
        const terminalName = isPowershell ? 'ProDash Runner (PowerShell)' : 'ProDash Runner';

        let terminal = vscode.window.terminals.find(t => t.name === terminalName);
        if (!terminal) {
            const options: vscode.TerminalOptions = { name: terminalName };
            if (isPowershell) {
                options.shellPath = 'powershell';
            }
            terminal = vscode.window.createTerminal(options);
        }

        terminal.show(false);

        scriptLines.forEach(line => {
            terminal.sendText(line, true);
        });
    }
}