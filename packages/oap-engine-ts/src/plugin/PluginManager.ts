/**
 * Plugin Manager - Manages agent plugins
 */

import { Logger } from '../utils/Logger';

export interface Plugin {
  name: string;
  version: string;
  initialize: () => Promise<void>;
  execute: (params: any) => Promise<any>;
  destroy?: () => Promise<void>;
}

export interface PluginRegistration {
  plugin: Plugin;
  config?: Record<string, any>;
}

export class PluginManager {
  private readonly plugins: Map<string, Plugin>;
  private readonly logger: Logger;

  constructor() {
    this.plugins = new Map();
    this.logger = new Logger('PluginManager');
  }

  /**
   * Register built-in plugins
   */
  async registerBuiltInPlugins(): Promise<void> {
    // Would register built-in plugins here
    this.logger.info('Built-in plugins registered');
  }

  /**
   * Register a plugin
   */
  async register(name: string, plugin: Plugin, config?: Record<string, any>): Promise<void> {
    if (this.plugins.has(name)) {
      throw new Error(`Plugin already registered: ${name}`);
    }

    this.logger.info(`Registering plugin: ${name}`);
    
    await plugin.initialize();
    this.plugins.set(name, plugin);
  }

  /**
   * Unregister a plugin
   */
  async unregister(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    if (plugin.destroy) {
      await plugin.destroy();
    }

    this.plugins.delete(name);
    this.logger.info(`Plugin unregistered: ${name}`);
  }

  /**
   * Get plugin
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Execute plugin
   */
  async execute(name: string, params: any): Promise<any> {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    return plugin.execute(params);
  }

  /**
   * Get all plugin names
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
}
