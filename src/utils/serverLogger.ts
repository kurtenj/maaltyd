type LogArgs = unknown[];

const isEnabled = process.env.NODE_ENV !== 'production';

export const serverLogger = {
  log: (module: string, message: string, ...args: LogArgs) => {
    if (isEnabled) console.log(`[${module}] ${message}`, ...args);
  },
  warn: (module: string, message: string, ...args: LogArgs) => {
    console.warn(`[${module}] ${message}`, ...args);
  },
  error: (module: string, message: string, ...args: LogArgs) => {
    console.error(`[${module}] ${message}`, ...args);
  },
};
