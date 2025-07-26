import * as jsonc from 'jsonc-parser';
import { LoggingService } from './logging.service';
import { readFileContents } from '../utils/file-utils';


/**
 * A singleton service for loading and parsing JSONC (JSON with comments) configuration files.
 * It handles file reading and parsing errors gracefully.
 */
export class ConfigurationService {
  private static _instance: ConfigurationService;

  private constructor() { }

  /**
   * Gets the singleton instance of the ConfigurationService.
   */
  public static get instance(): ConfigurationService {
    if (!ConfigurationService._instance) {
      ConfigurationService._instance = new ConfigurationService();
    }
    return ConfigurationService._instance;
  }

  /**
   * Loads and parses a JSONC configuration file from the given path.
   * @param filePath The absolute path to the configuration file.
   * @param fileName The display name of the file for logging purposes.
   * @returns The parsed configuration object of type T, or null if the file
   *          does not exist or contains errors.
   */
  public loadConfiguration<T>(filePathAndName: string): T | null {
    try {
      const fileContent = readFileContents(filePathAndName);
      if (!fileContent) {
        return null;
      }
      const errors: jsonc.ParseError[] = [];
      const data = jsonc.parse(fileContent, errors) as T;

      if (errors.length > 0) {
        throw new Error(`Failed to parse '${filePathAndName}'. Error: ${jsonc.printParseErrorCode(errors[0].error)} at offset ${errors[0].offset}, length ${errors[0].length}`);
      }
      return data as T;
    } catch (error: any) {
      LoggingService.instance.logError(`Failed to read configuration file '${filePathAndName}': $(error.message)`, error);
      return null; // Is not an error - the configuration file does not exist
    }
  }

}