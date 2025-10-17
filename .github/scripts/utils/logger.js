import chalk from 'chalk';

/**
 * Centralized logging utility with color-coded output
 * Provides consistent, readable console logging across all scripts
 * 
 * Features:
 * - Color-coded messages by type (success, error, warning, info)
 * - Automatic graceful fallback for terminals without color support
 * - Consistent emoji usage with colored text
 */

const logger = {
  /**
   * Success messages - Green with ✅
   * Use for: Successful operations, confirmations, completed tasks
   */
  success: (message, ...args) => {
    console.log(chalk.green('✅', message), ...args);
  },

  /**
   * Error messages - Red with ❌
   * Use for: Errors, failures, critical issues
   */
  error: (message, ...args) => {
    console.error(chalk.red('❌', message), ...args);
  },

  /**
   * Warning messages - Yellow with ⚠️
   * Use for: Warnings, cautions, non-critical issues
   */
  warn: (message, ...args) => {
    console.warn(chalk.yellow('⚠️ ', message), ...args);
  },

  /**
   * Info messages - Blue with ℹ️
   * Use for: Informational messages, status updates
   */
  info: (message, ...args) => {
    console.log(chalk.blue('ℹ️ ', message), ...args);
  },

  /**
   * General log messages - Default color
   * Use for: General output, data, results
   */
  log: (message, ...args) => {
    console.log(message, ...args);
  },

  /**
   * Debug messages - Dim/gray
   * Use for: Debug information, verbose output
   */
  debug: (message, ...args) => {
    console.log(chalk.dim('🔍', message), ...args);
  },

  /**
   * Header/section messages - Bold cyan
   * Use for: Section headers, important announcements
   */
  header: (message, ...args) => {
    console.log(chalk.cyan.bold(message), ...args);
  },

  /**
   * Data/stats messages - Cyan
   * Use for: Statistics, metrics, data output
   */
  data: (message, ...args) => {
    console.log(chalk.cyan(message), ...args);
  }
};

export default logger;
