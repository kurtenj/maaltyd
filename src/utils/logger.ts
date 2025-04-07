/**
 * Logger utility to centralize and control logging throughout the application
 * Logging can be easily toggled on/off based on environment
 */

// Determine if we're in development mode
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

// Enable logging based on environment or localStorage setting
const isLoggingEnabled = () => {
  // Always check localStorage first to allow override
  const localStorageSetting = localStorage.getItem('debug');
  if (localStorageSetting !== null) {
    return localStorageSetting === 'true';
  }
  
  // Default based on environment
  return isDev;
};

/**
 * Format log messages with a consistent prefix
 */
const formatMessage = (module: string, message: string) => {
  return `[${module}] ${message}`;
};

// Define a more specific type for log arguments
type LogArgs = unknown[];

/**
 * Logger object with methods for different log levels
 */
export const logger = {
  /**
   * Enable or disable logging globally
   */
  setEnabled: (enabled: boolean) => {
    localStorage.setItem('debug', String(enabled));
  },
  
  /**
   * Standard log
   */
  log: (module: string, message: string, ...args: LogArgs) => {
    if (isLoggingEnabled()) {
      console.log(formatMessage(module, message), ...args);
    }
  },
  
  /**
   * Info log
   */
  info: (module: string, message: string, ...args: LogArgs) => {
    if (isLoggingEnabled()) {
      console.info(formatMessage(module, message), ...args);
    }
  },
  
  /**
   * Warning log (always shown)
   */
  warn: (module: string, message: string, ...args: LogArgs) => {
    console.warn(formatMessage(module, message), ...args);
  },
  
  /**
   * Error log (always shown)
   */
  error: (module: string, message: string, ...args: LogArgs) => {
    console.error(formatMessage(module, message), ...args);
  },
  
  /**
   * Group logs together
   */
  group: (module: string, label: string, collapsed = false) => {
    if (isLoggingEnabled()) {
      const formattedLabel = formatMessage(module, label);
      if (collapsed) {
        console.groupCollapsed(formattedLabel);
      } else {
        console.group(formattedLabel);
      }
    }
  },
  
  /**
   * End a group
   */
  groupEnd: () => {
    if (isLoggingEnabled()) {
      console.groupEnd();
    }
  },
  
  /**
   * Time an operation
   */
  time: (module: string, label: string) => {
    if (isLoggingEnabled()) {
      console.time(formatMessage(module, label));
    }
  },
  
  /**
   * End timing an operation
   */
  timeEnd: (module: string, label: string) => {
    if (isLoggingEnabled()) {
      console.timeEnd(formatMessage(module, label));
    }
  }
}; 