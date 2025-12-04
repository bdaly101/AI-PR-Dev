/**
 * Version utilities for AI-PR-Dev
 */

/**
 * Get the current version from package.json
 */
export function getVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../package.json');
  return pkg.version;
}

/**
 * Get application info
 */
export function getAppInfo(): { name: string; version: string; description: string } {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../package.json');
  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
  };
}

