import type { FileMetadata, FileStatus, FileType } from '~/types/graphql'

export interface FileMetadataConnectionResult {
  items: FileMetadata[]
  count: number
  nextToken?: string | null
}

async function loadStubFileMetadata(): Promise<FileMetadataConnectionResult> {
  const response = await fetch('/stub-file-metadata-new.json')
  if (!response.ok) {
    throw new Error('Failed to load stub file metadata')
  }
  return response.json() as Promise<FileMetadataConnectionResult>
}

export function useUploadHistory() {
  async function listFileMetadata(options?: {
    type?: FileType
    status?: FileStatus
    created_by?: string
    limit?: number
    nextToken?: string
  }): Promise<FileMetadataConnectionResult> {
    const data = await loadStubFileMetadata()
    let items = Array.isArray(data.items) ? [...data.items] : []

    if (options?.type) items = items.filter((x) => x.type === options.type)
    if (options?.status) items = items.filter((x) => x.status === options.status)
    if (options?.created_by) items = items.filter((x) => x.created_by === options.created_by)
    if (options?.limit != null) items = items.slice(0, options.limit)

    return {
      items,
      count: items.length,
      nextToken: null,
    }
  }

  return { listFileMetadata }
}
