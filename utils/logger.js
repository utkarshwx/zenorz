const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, align } = format;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `[${timestamp}] ${level}: ${message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    logFormat
  ),
  transports: [
    
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        align(),
        logFormat
      )
    }),
    // File output - error logs
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error'
    }),
    // File output - combined logs
    new transports.File({
      filename: path.join(logsDir, 'combined.log')
    })
  ],
  exceptionHandlers: [
    new transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ]
});

module.exports = logger;