# Change Log

All notable changes to the "ProDash" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2025-07-25

### Changed
- **Script Variables**: Scripts can now use variables `{{FULLDESCRIPTION_FILE}}`, and `{{GLOBALCONFIG_PATH}}`; `{{GROUPS_PATH}}` was removed.
- **Configuration templates**: Configuration template files are provided with the extension (located in 'templates' subfolder).

## [0.0.2] - 2025-07-13

### Added
- **Automatic Refresh**: The dashboard now automatically refreshes when changes are detected in `projects.jsonc`, `scripts.jsonc`, or a project's `description.$$$` and `longdescription.$$$` files.
- **`ON_ACTIVATE` Event**: Scripts can now have an `event` property set to `"ON_ACTIVATE"` to run automatically when their project becomes active.
- **Script Variables**: Scripts can now use variables like `{{PROJECT_PATH}}`, `{{PRODASH_PATH}}`, `{{DESCRIPTION_FILE}}`, `{{LONGDESCRIPTION_FILE}}`, and `{{GROUPS_PATH}}` which are resolved at runtime.
- **Automatic Project Setup**:
  - If the active workspace is not in `projects.jsonc`, it's automatically added to the dashboard.
  - For an active project, the extension can automatically create a `.prodash` folder with a sample `scripts.jsonc` file.
  - Automatically adds `.prodash/` to `.git/info/exclude` to avoid committing runtime files.
- **Dynamic Project Descriptions**: Project tooltips and descriptions can be updated dynamically by writing to `.prodash/description.$$$` and `.prodash/longdescription.$$$` files.
- **Terminal Selection**: Scripts can now specify a `terminal` property (`powershell`, `batch`, or default) for execution.
- **Hidden Scripts**: Scripts can be hidden from the tree view by adding a `"hidden": true` property, making them ideal for use as utility scripts called by other scripts.
- **Script Composition**: Scripts can call other scripts using the `{{RUN_SCRIPT:ScriptName}}` syntax. This allows for creating complex workflows from smaller, reusable scripts and includes circular dependency detection.

### Changed
- **Configuration Files**: Renamed configuration files to use the `.jsonc` extension (`projects.jsonc`, `scripts.jsonc`) to formally support JSON with comments.
- **Refactored Grouping**: Replaced nested group structure with a simpler, flat list for both projects and scripts. Grouping is now handled dynamically via an optional `group` property.
- **Services Refactoring**:
  - Centralized configuration loading into a `ConfigurationService`.
  - Introduced a dedicated `LoggingService` with a "ProDash" output channel for better troubleshooting.
  - Refactored terminal creation into a `TerminalService`.
- Improved internal type safety and overall code structure.
- **Tooltip Alignment**: Project information tooltips are now perfectly aligned by rendering them as a Markdown code block, which uses a monospace font.

## [0.0.1] - Proof Of Concept - 2025-07-06

### Added
- Pre-release (POC) of ProDash extension.
- Project dashboard tree view in the sidebar.
- Support for project groups and project registration.
- Script groups and script execution from the dashboard.
- Command palette commands: Edit Groups, Edit Scripts, Refresh, Open Folder, Execute Script.
- Automatic detection of active project based on workspace.
- Integration with `.prodash/groups.json` and `.prodash/scripts.json`.
- Utility scripts and project information output.