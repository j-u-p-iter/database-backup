import { InvalidPathError } from "@j.u.p.iter/custom-error";
import { FolderPath } from "@j.u.p.iter/folder-path";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

export class DatabaseBackup {
  folderPath = new FolderPath();

  databaseConnectionURL: string | null = null;

  resolvedPath: string | null = null;

  newFolderPath: string | null = null;

  backupsFolderPath: string | null = null;

  amountOfDaysToStoreBackupsFor: number = 5;

  private validateBackupsFolder() {
    if (!fs.existsSync(this.resolvedPath)) {
      throw new InvalidPathError(this.resolvedPath, false);
    }
  }

  private getOutdatedBackupFolderPath(): string {
    const dateOfOutdatedBackup = new Date();

    dateOfOutdatedBackup.setDate(
      dateOfOutdatedBackup.getDate() - this.amountOfDaysToStoreBackupsFor
    );

    const currentYear = dateOfOutdatedBackup.getFullYear();
    const currentMonth = dateOfOutdatedBackup.getMonth() + 1;
    const currentDate = dateOfOutdatedBackup.getDate();

    return path.join(
      this.resolvedPath,
      `${currentYear}-${currentMonth}-${currentDate}`
    );
  }

  private getNewBackupFolderPath() {
    const now = new Date();

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDate = now.getDate();

    return path.join(
      this.resolvedPath,
      `${currentYear}-${currentMonth}-${currentDate}`
    );
  }

  private async createDatabaseBackupFolder() {
    this.newFolderPath = this.getNewBackupFolderPath();

    if (fs.existsSync(this.newFolderPath)) {
      throw new Error(
        `The directory ${this.newFolderPath} already exists. There is a risk to overwrite existing backup.`
      );
    }

    await fs.promises.mkdir(this.newFolderPath);
  }

  private backupDatabase() {
    const commandToExecute = `mongodump --uri ${this.databaseConnectionURL} --out ${this.newFolderPath}`;

    return new Promise((resolve, reject) => {
      exec(commandToExecute, {}, async error => {
        if (error) {
          await fs.promises.rmdir(this.newFolderPath);

          reject(new Error('"mongodump" failed with an error'));
        }

        resolve();
      });
    });
  }

  private async removeOutdatedBackup() {
    const outdatedBackupFolderPath = this.getOutdatedBackupFolderPath();

    if (!fs.existsSync(outdatedBackupFolderPath)) {
      return;
    }

    await fs.promises.rmdir(outdatedBackupFolderPath);
  }

  constructor(options: {
    databaseConnectionURL: string;
    backupsFolderPath: string;
    amountOfDaysToStoreBackupsFor?: number;
  }) {
    this.backupsFolderPath = options.backupsFolderPath;
    this.databaseConnectionURL = options.databaseConnectionURL;

    if (options.amountOfDaysToStoreBackupsFor) {
      this.amountOfDaysToStoreBackupsFor =
        options.amountOfDaysToStoreBackupsFor;
    }
  }

  public async run() {
    this.resolvedPath = await this.folderPath.resolve(this.backupsFolderPath);

    this.validateBackupsFolder();

    await this.createDatabaseBackupFolder();

    await this.backupDatabase();

    await this.removeOutdatedBackup();
  }
}
