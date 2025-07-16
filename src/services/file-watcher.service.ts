import * as vscode from 'vscode';
import * as path from 'path';
import { LoggingService } from './logging.service';

/**
 * Normalizes a file path by replacing backslashes with forward slashes for consistent glob patterns.
 * @param path The file path to normalize.
 * @returns The normalized path.
 */
function normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
}

/**
 * A singleton service for watching file system events for specific files.
 * This service allows registering callbacks for file changes, creations, or deletions.
 */
export class FileWatcherService {
    private static _instance: FileWatcherService;
    private readonly _watchers = new Map<string, vscode.FileSystemWatcher>();

    private constructor() { }

    /**
     * Gets the singleton instance of the FileWatcherService.
     */
    public static get instance(): FileWatcherService {
        if (!FileWatcherService._instance) {
            FileWatcherService._instance = new FileWatcherService();
        }
        return FileWatcherService._instance;
    }

    /**
     * Watches a specific file for changes. If the file is already being watched,
     * this method does nothing.
     *
     * @param filePath The absolute path of the file to watch.
     * @param callback The function to execute when the file changes, is created, or is deleted.
     */
    public watch(filePath: string, callback: (uri: vscode.Uri) => void): void {
        if (!filePath) {
            return;
        }

        const normalizedFilePath = normalizePath(filePath);
        if (this._watchers.has(normalizedFilePath)) {
            return;
        }

        try {
            const baseDir = path.dirname(normalizedFilePath);
            const pattern = path.basename(normalizedFilePath);
            const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(baseDir, pattern));

            watcher.onDidChange(callback);
            watcher.onDidCreate(callback);
            watcher.onDidDelete(callback);

            this._watchers.set(normalizedFilePath, watcher);
        } catch (error) {
            LoggingService.instance.logError(`Error watching file ${filePath}:`, error);
        }
    }

    /**
     * Disposes of all watchers.
     */
    public clear(): void {
        if (this._watchers.size > 0) {
            for (const watcher of this._watchers.values()) {
                watcher.dispose();
            }
            this._watchers.clear();
            LoggingService.instance.logInfo('Cleared all file watchers.');
        }
    }

    /**
     * Disposes of the service and all its watchers.
     * This should be called when the extension is deactivated.
     */
    public dispose(): void {
        this.clear();
    }
}