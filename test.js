const { DatabaseBackup }  = require('./dist/lib')

const databaseBackup = new DatabaseBackup({ backupsFolderPath: 'somepath' });

databaseBackup.run();
