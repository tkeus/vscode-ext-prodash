import * as vscode from 'vscode';

/**
 * A singleton service for logging messages to a dedicated "ProDash" output channel.
 */
export class LoggingService {
  private static _instance: LoggingService;
  private _outputChannel: vscode.OutputChannel | undefined;

  private constructor() {
    this._outputChannel = vscode.window.createOutputChannel('ProDash');
  }

  /**
   * Gets the singleton instance of the LoggingService.
   */
  public static get instance(): LoggingService {
    if (!LoggingService._instance) {
      LoggingService._instance = new LoggingService();
    }
    return LoggingService._instance;
  }

  public logInfo(message: string): void {
    const time = new Date().toLocaleTimeString();
    this._outputChannel?.appendLine(`[INFO  - ${time}] ${message}`);
  }

  public logWarning(message: string): void {
    const time = new Date().toLocaleTimeString();
    this._outputChannel?.appendLine(`[WARN  - ${time}] ${message}`);
  }

  public logError(message: string, error?: any): void {
    const time = new Date().toLocaleTimeString();
    this._outputChannel?.appendLine(`[ERROR - ${time}] ${message}`);
    if (error instanceof Error) {
      this._outputChannel?.appendLine(error.stack || error.message);
    } else if (error) {
      this._outputChannel?.appendLine(String(error));
    }
    this._outputChannel?.show(true);
  }

  /**
   * Disposes of the output channel.
   */
  public dispose(): void {
    this._outputChannel?.dispose();
  }
}