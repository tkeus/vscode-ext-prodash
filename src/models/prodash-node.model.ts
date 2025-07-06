import * as vscode from 'vscode';

/**
 * Represents a node in the ProDash project/script tree for the VS Code TreeView.
 * Wraps any object (project group, project, script group, or script) for display.
 */
export class ProDashNode extends vscode.TreeItem {
  /** The underlying object this node represents (project group, project, script group, or script). */
  public object: any;

  /**
   * Constructs a new ProDashNode.
   * @param name The display name of the node.
   * @param type The context value/type of the node.
   */
  constructor(name: string, contextValue: string, object?: any) {
    super(name);
    this.contextValue = contextValue;
    this.object = object;
  }

  /**
   * Opens the folder for the current project in VS Code.
   */
  openProjectFolder() {
    if (this.contextValue === 'Project' && this.object && this.object?.path) {
      vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(this.object.path), false);;
    }
  }
  
  /**
   * Executes the script associated with this node.
   */
  execute() {
    if (this.contextValue === 'Script' && this.object) {
      this.object.execute();
    }
  }
    
}
