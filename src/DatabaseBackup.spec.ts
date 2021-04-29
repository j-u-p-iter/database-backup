import path from 'path';
import { InvalidPathError } from '@j.u.p.iter/custom-error';
import { DatabaseBackup } from '.';
import { ensureDir, pathExists, remove } from 'fs-extra';
import MockDate from 'mockdate';
import childProcess from 'child_process'

const getRootFolderPath = () =>  {
  const rootFolderName = 'databaseBackups';

  return path.join(__dirname, rootFolderName); 
}

const createBackupsFolderPath = (backupsFolderName: string, defaultRootFolderPath?: string) => {
  const rootFolderPath = defaultRootFolderPath || getRootFolderPath();
  const backupsFolderPath = path.join(rootFolderPath, backupsFolderName);

  return {
    rootFolderPath,
    backupsFolderPath,
  };
};

const mockExecMethod = (error = null) => {
  return (
    jest.spyOn(childProcess, 'exec').mockImplementation((_, __, callback) => {
      callback(error, {} as any, {} as any);

      return {} as any;
    })
  );
}

describe('DatabaseBackup', () => {
  afterEach(async () => {
    await remove(getRootFolderPath())
  });

  describe('when there is no folder for backups', () => {
    it('throws an appropriate error', async () => {
      const databaseBackup = new DatabaseBackup({ 
        backupsFolderPath: './someInvalidPath',
        databaseConnectionURL: "mongodb+srv://jupiter:kirill141284@cluster0.1h1jd.mongodb.net/jupiterBlogDev"
      });

      const runDabatabaseBackup = databaseBackup.run();

      expect(runDabatabaseBackup).rejects.toThrow(InvalidPathError);
      expect(runDabatabaseBackup).rejects.toThrow('Directory /Users/j.u.p.iter/projects/database-backup/someInvalidPath does not exist');
    });
  });

  describe('when there is already folder for backups with the same name', () => {
    it('throws an appropriate error', async () => {
      MockDate.set('2012-10-20');

      const {
        rootFolderPath,
        backupsFolderPath,
      } = createBackupsFolderPath('2012-10-20');

      await ensureDir(backupsFolderPath);

      const databaseBackup = new DatabaseBackup({ 
        backupsFolderPath: rootFolderPath, 
        databaseConnectionURL: "mongodb+srv://jupiter:kirill141284@cluster0.1h1jd.mongodb.net/jupiterBlogDev"
      });

      const runDabatabaseBackup = databaseBackup.run();

      await expect(runDabatabaseBackup).rejects.toThrow(`The directory ${backupsFolderPath} already exists. There is a risk to overwrite existing backup.`);

      remove(rootFolderPath);
    });
  });

  describe('when there is no folder for backups', () => {
    describe('when execute mongodump with error', () => {
      it('throws appropriate error and removes newly created folder', async () => {
        const databaseConnectionURL = "someDatabaseConnectionURL";

        MockDate.set('2012-10-28');

        const execMethodMock = mockExecMethod(new Error('some error'));
        execMethodMock.mockClear();

        const {
          rootFolderPath,
          backupsFolderPath,
        }  = createBackupsFolderPath('2012-10-28');

        await ensureDir(rootFolderPath);

        const databaseBackup = new DatabaseBackup({ 
          databaseConnectionURL,
          backupsFolderPath: rootFolderPath,  
        });

        const runDatabaseBackup = databaseBackup.run();

        await expect(runDatabaseBackup).rejects.toThrow('"mongodump" failed with an error');

        expect(execMethodMock).toHaveBeenCalledTimes(1);
        expect(execMethodMock.mock.calls[0][0]).toBe(`mongodump --uri someDatabaseConnectionURL --out ${backupsFolderPath}`);

        const doesFolderExist = await pathExists(backupsFolderPath);

        expect(doesFolderExist).toBe(false);

        remove(rootFolderPath);
      });
    });

    describe('when execute mongodump without error', () => {
      it('runs backup properly', async () => {
        const databaseConnectionURL = "someDatabaseConnectionURL";

        MockDate.set('2012-10-28');

        const execMethodMock = mockExecMethod();
        execMethodMock.mockClear();

        const {
          rootFolderPath,
          backupsFolderPath,
        } = createBackupsFolderPath('2012-10-28');

        await ensureDir(rootFolderPath);

        const databaseBackup = new DatabaseBackup({ 
          databaseConnectionURL,
          backupsFolderPath: rootFolderPath,  
        });

        await databaseBackup.run();

        expect(execMethodMock).toHaveBeenCalledTimes(1);
        expect(execMethodMock.mock.calls[0][0]).toBe(`mongodump --uri someDatabaseConnectionURL --out ${backupsFolderPath}`);

        const doesFolderExist = await pathExists(backupsFolderPath);
        expect(doesFolderExist).toBe(true);

        remove(rootFolderPath);
      });

      it('removes correct folder with outdated backups by default', async () => {
        const databaseConnectionURL = "someDatabaseConnectionURL";

        MockDate.set('2012-10-28');

        const execMethodMock = mockExecMethod();
        execMethodMock.mockClear();

        const { rootFolderPath } = createBackupsFolderPath('2012-10-28');

        const { backupsFolderPath: backupsFolderPathFor23 } = createBackupsFolderPath('2012-10-23', rootFolderPath);
        const { backupsFolderPath: backupsFolderPathFor24 } = createBackupsFolderPath('2012-10-24', rootFolderPath);


        await ensureDir(backupsFolderPathFor23);

        await ensureDir(backupsFolderPathFor24);

        await ensureDir(rootFolderPath);

        const databaseBackup = new DatabaseBackup({ 
          databaseConnectionURL,
          backupsFolderPath: rootFolderPath,  
        });

        await databaseBackup.run();

        const doesOutdatedBackupExist = await pathExists(backupsFolderPathFor23);
        expect(doesOutdatedBackupExist).toBe(false);

        const doesNotYetOutdatedBackupExist = await pathExists(backupsFolderPathFor24);
        expect(doesNotYetOutdatedBackupExist).toBe(true);

        remove(rootFolderPath);
      });

      it('removes correct folder with outdated backups according to provided "amountOfDaysToStoreBackupsFor"', async () => {
        const databaseConnectionURL = "someDatabaseConnectionURL";

        MockDate.set('2012-10-28');

        const execMethodMock = mockExecMethod();
        execMethodMock.mockClear();

        const { rootFolderPath } = createBackupsFolderPath('2012-10-28');

        const { backupsFolderPath: backupsFolderPathFor26 } = createBackupsFolderPath('2012-10-26', rootFolderPath);
        const { backupsFolderPath: backupsFolderPathFor27 } = createBackupsFolderPath('2012-10-27', rootFolderPath);

        await ensureDir(backupsFolderPathFor26);
        await ensureDir(backupsFolderPathFor27);

        await ensureDir(rootFolderPath);

        const databaseBackup = new DatabaseBackup({ 
          databaseConnectionURL,
          backupsFolderPath: rootFolderPath,  
          amountOfDaysToStoreBackupsFor: 2,
        });

        await databaseBackup.run();

        const doesOutdatedBackupExist = await pathExists(backupsFolderPathFor26);
        expect(doesOutdatedBackupExist).toBe(false);

        const doesNotYetOutdatedBackupExist = await pathExists(backupsFolderPathFor27);
        expect(doesNotYetOutdatedBackupExist).toBe(true);

        remove(rootFolderPath);
      });
    });
  });
});
