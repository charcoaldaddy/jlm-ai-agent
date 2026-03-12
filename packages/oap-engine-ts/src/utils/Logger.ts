/**
 * Logger - Simple logging utility
 */

export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: string;
}

export class Logger {
  private readonly context: string;
  private readonly minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = LogLevel.Info) {
    this.context = context;
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (level < this.minLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const formattedMessage = args.length > 0 
      ? `${message} ${JSON.stringify(args)}`
      : message;

    const output = `[${timestamp}] [${levelStr}] [${this.context}] ${formattedMessage}`;

    switch (level) {
      case LogLevel.Debug:
      case LogLevel.Info:
        console.log(output);
        break;
      case LogLevel.Warn:
        console.warn(output);
        break;
      case LogLevel.Error:
        console.error(output);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.Debug, message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log(LogLevel.Info, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.Warn, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log(LogLevel.Error, message, ...args);
  }
}
