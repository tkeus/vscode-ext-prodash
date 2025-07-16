import * as fs from 'fs';
import { parse, printParseErrorCode, ParseError } from 'jsonc-parser';
import { LoggingService } from './logging.service';

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
    public loadConfiguration<T>(filePath: string, fileName: string): T | null {
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const errors: ParseError[] = [];
            const config = parse(fileContent, errors) as T;

            if (errors.length > 0) {
                const error = errors[0];
                LoggingService.instance.logError(
                    `Failed to parse '${fileName}'. Error: ${printParseErrorCode(error.error)} at offset ${error.offset}, length ${error.length}`
                );
                return null;
            }

            return config;
        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                LoggingService.instance.logError(`Failed to read configuration file '${fileName}' at '${filePath}'`, err);
            }
            return null;
        }
    }
}