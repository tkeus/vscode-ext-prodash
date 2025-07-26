export interface Project {
  name: string;
  path: string;
  group?: string;
  description?: string;
  descriptionFile?: string;
  longDescriptionFile?: string;
  fullDescriptionFile?: string;
  isActive?: boolean;
  proDashPath?: string;
  gitPath?: string;
  scriptJsonFile?: string;
}

/**
 * Represents a script that can be executed in a terminal.
 * Handles variable resolution and execution logic.
 */
export interface Script {
  name: string;
  description?: string;
  group?: string;
  script: string | string[];
  terminal?: string;
  hidden?: boolean;
  event?: 'ON_ACTIVATE';
}

// Type for the new grouped project configuration
export interface ProjectGroups {
  [groupName: string]: Omit<Project, 'group'>[];
}

// Type for the new grouped script configuration
export interface ScriptGroups {
  [groupName: string]: Omit<Script, 'group'>[];
}
