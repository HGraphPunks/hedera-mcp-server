// src/services/logger.ts
export enum LogLevel { DEBUG = 'DEBUG', INFO = 'INFO', WARN = 'WARN', ERROR = 'ERROR' }

export class Logger {
    log(level: LogLevel, message: string, ...meta: any[]) {
        const timestamp = new Date().toISOString();
        const metaStr = meta.length ? JSON.stringify(meta) : '';
        console.log(`[${timestamp}][${level}] ${message}`, metaStr);
    }
    debug(msg: string, ...meta: any[]) { this.log(LogLevel.DEBUG, msg, ...meta); }
    info(msg: string, ...meta: any[]) { this.log(LogLevel.INFO, msg, ...meta); }
    warn(msg: string, ...meta: any[]) { this.log(LogLevel.WARN, msg, ...meta); }
    error(msg: string, ...meta: any[]) { this.log(LogLevel.ERROR, msg, ...meta); }
}

export const logger = new Logger();
