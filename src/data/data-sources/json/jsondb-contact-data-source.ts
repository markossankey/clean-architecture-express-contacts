import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { ContactRequestModel, ContactResponseModel } from "../../../domain/models/contact";
import { ContactDataSource } from "../../interfaces/data-sources/contact-data-source";
import { NoSQLDatabaseWrapper } from "../../interfaces/data-sources/nosql-database-wrapper";

interface JsonDbInterface {
  read: () => any[];
  write: (contents: object[]) => any[];
}

export class JsonDb implements JsonDbInterface {
  private DIRECTORY = dirname(require.main?.path ?? "");
  private _dataDir = join(this.DIRECTORY, "data-store");
  constructor(private name: string) {}

  private get _fileName() {
    return `${this.name}.json`;
  }
  private get _location() {
    return join(this._dataDir, this._fileName);
  }

  load() {
    if (existsSync(this._location)) {
      return;
    }
    if (existsSync(this._dataDir)) {
      writeFileSync(this._location, "[]");
      return;
    }
    mkdirSync(this._dataDir);
    writeFileSync(this._location, "[]");
  }

  read(): any[] {
    try {
      return JSON.parse(readFileSync(this._location, "utf-8"));
    } catch (e) {
      throw new Error("Data store is unable to be loaded");
    }
  }

  write(contents: object[]): any[] {
    try {
      const stringifiedContents = JSON.stringify(contents);
      writeFileSync(this._location, stringifiedContents);
      return contents;
    } catch (e) {
      throw new Error("Unable to write to Data store");
    }
  }
}

export class JsonDBContactDataSource implements ContactDataSource {
  private db: JsonDb;
  constructor(db: JsonDb) {
    this.db = db;
  }
  async deleteOne(id: string) {
    const existingData = this.db.read();
    const newData = existingData.filter((record) => id !== record.id);
    this.db.write(newData);
  }

  create(contact: ContactRequestModel): void {
    const data = this.db.read();
    data.push(contact);
    this.db.write(data);
  }

  async getAll(): Promise<ContactResponseModel[]> {
    return this.db.read();
  }

  getOne(id: String): Promise<ContactResponseModel | null> {
    const data = this.db.read();
    return data.find((record) => record.id === id);
  }

  updateOne(id: String, data: ContactRequestModel): void {
    const existingData = this.db.read();
    const newData = existingData.filter((record) => id !== record.id);
    this.db.write([...newData, data]);
  }
}

export class MongoDBContactDataSource implements ContactDataSource {
  private db: NoSQLDatabaseWrapper;
  constructor(db: NoSQLDatabaseWrapper) {
    this.db = db;
  }
  async deleteOne(id: String) {
    await this.db.deleteOne(id);
  }
  async updateOne(id: String, data: ContactRequestModel) {
    await this.db.updateOne(id, data);
  }
  async getOne(id: String): Promise<ContactResponseModel> {
    const result = await this.db.find({ _id: id });
    return result.map((item) => ({
      id: item._id.toString(),
      name: item.name,
    }))[0];
  }

  async create(contact: ContactRequestModel) {
    await this.db.insertOne(contact);
  }

  async getAll(): Promise<ContactResponseModel[]> {
    const result = await this.db.find({});
    return result.map((item) => ({
      id: item._id.toString(),
      name: item.name,
    }));
  }
}
