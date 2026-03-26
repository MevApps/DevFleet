export interface FileSystem {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  edit(path: string, oldContent: string, newContent: string): Promise<void>
  glob(pattern: string): Promise<ReadonlyArray<string>>
  exists(path: string): Promise<boolean>
}

export type FileSystemFactory = (rootPath: string) => FileSystem
