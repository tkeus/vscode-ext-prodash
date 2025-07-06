import * as vscode from 'vscode';

/**
 * Opens the given file in a VS Code text editor if it exists, otherwise shows a warning.
 * 
 * @param filePath The path to the file to open
 */
export function showTextFileEditor(filePath: string | undefined): void {
  if (filePath && require('fs').existsSync(filePath)) {
    vscode.window.showTextDocument(vscode.Uri.file(filePath));
  } else {
    vscode.window.showWarningMessage(`file <${filePath}> not found.`);
  }
}
