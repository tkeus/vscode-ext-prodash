import * as path from 'path';
import { Script, ScriptGroups } from '../types';
import { ConfigurationService } from './configuration.service';
import { proDashFolderName, scriptsJsoncFileName } from '../constants';

/**
 * A singleton service for loading and providing script configurations for a project.
 */
export class ScriptService {
  private static _instance: ScriptService;

  private constructor() { }

  public static get instance(): ScriptService {
    if (!ScriptService._instance) {
      ScriptService._instance = new ScriptService();
    }
    return ScriptService._instance;
  }

  /**
   * Loads all scripts for a given project, including those intended to be hidden from the UI.
   * The consumer (e.g., the TreeView) is responsible for filtering out scripts based on the
   * 'hidden' property or names prefixed with an underscore (_).
   * @param projectPath The absolute path to the project directory.
   * @returns An array of all scripts defined for the project.
   */
  public getScripts(projectPath: string): Script[] {
    const scriptsFile = path.join(projectPath, proDashFolderName, scriptsJsoncFileName);
    const scriptsData = ConfigurationService.instance.loadConfiguration<Script[] | ScriptGroups>(scriptsFile);

    if (!scriptsData) {
      return [];
    }

    let allScripts: Script[] = [];

    if (Array.isArray(scriptsData)) {
      allScripts.push(...scriptsData); // Old flat format
    } else { // New grouped format
      for (const groupName in scriptsData) {
        allScripts.push(...(scriptsData[groupName] || []).map(s => ({ ...s, group: groupName })));
      }
    }

    return allScripts.map(s => ({ ...s, group: s.group ?? 'Uncategorized' }));
  }
}
