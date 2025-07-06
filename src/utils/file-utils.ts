import * as fs from 'fs';
import * as path from 'path';

/**
 * Normalizes a file path for comparison:
 * - Converts to lowercase
 * - Replaces backslashes with forward slashes
 * This helps ensure consistent path comparisons across platforms.
 * @param filepath The file path to normalize
 * @returns The normalized path string
 */
export function normalizePathForCompare(filepath: string) {
   return filepath.toLowerCase().replaceAll('\\', '/');
}
      
/**
 * Checks if parentPath is the same as or a parent directory of childPath.
 * Useful for determining project/workspace relationships.
 * @param parentPath The supposed parent directory
 * @param childPath The supposed child directory
 * @returns True if parentPath is the same as or a parent of childPath
 */
export function isParentPathOf(parentPath: string, childPath: string): boolean {
  const parent = normalizePathForCompare(parentPath).replace(/\/+$/, ''); // remove trailing slash
  const child = normalizePathForCompare(childPath).replace(/\/+$/, '');
  return (parent === child) || child.startsWith(parent + '/');
}

/**
 * Searches up the directory tree from startDir for a folder with the given name.
 * Returns the absolute path to the found folder, or undefined if not found.
 * @param startDir The directory to start searching from
 * @param folderName The folder name to search for (e.g., '.git', '.prodash')
 * @returns The absolute path to the found folder, or undefined if not found
 */
export function findUpDirectoryWithName(startDir: string, folderName: string): string | undefined {
  let currentDir = startDir;
  while (true) {
    const candidate = path.join(currentDir, folderName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // reached root
    }
    currentDir = parentDir;
  }
  return undefined;
}

/**
 * Creates a folder at the specified path if it does not already exist.
 * @param folderPath The path of the folder to create
 */
export function createFolderIfNotExist(folderPath: string) {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }
}

/**
 * Creates a text file with the given template content if it does not already exist.
 * @param filePath The path of the file to create
 * @param template The content to write to the file (will be stringified as JSON)
 */
export function createTextFileIfNotExist(filePath: string, fileContents: string) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, fileContents, 'utf8');
  }
}

/**
 * Reads the contents of a text file and returns it as a string.
 * Trims whitespace from the result. Returns an empty string if the file does not exist or an error occurs.
 * @param filePath The path to the file to read
 * @returns The trimmed file contents, or an empty string if not found or on error
 */
export function readFileContents(filePath: string): string { 
  let fileContents = '';
  if (filePath && fs.existsSync(filePath)) {
    try {
      fileContents = fs.readFileSync(filePath, 'utf8').trim();
    } catch (e) { 
      // Ignore errors
    }
  }
  return fileContents;
}
