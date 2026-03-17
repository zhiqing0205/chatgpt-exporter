import JSZip from 'jszip'
import { fetchAllConversations, fetchConversation, getCurrentWorkspaceName } from '../api'
import { exportAllToHtml } from '../exporter/html'
import { exportAllToJson, exportAllToOfficialJson } from '../exporter/json'
import { exportAllToMarkdown } from '../exporter/markdown'
import { RequestQueue } from './queue'
import { uploadToS3 } from './s3'
import { timestamp } from './utils'
import { uploadToWebDAV } from './webdav'
import type { S3Config } from './s3'
import type { WebDAVConfig } from './webdav'
import type { ApiConversationWithId } from '../api'
import type { ExportMeta } from '../ui/SettingContext'

export type BackupConfig =
    | ({ method: 'S3' } & S3Config)
    | ({ method: 'WebDAV' } & WebDAVConfig)

export interface BackupResult {
    success: boolean
    error?: string
}

type ExportAllFn = (
    format: string,
    conversations: ApiConversationWithId[],
    metaList?: ExportMeta[],
    projectName?: string,
    returnBlob?: boolean,
) => Promise<Blob | boolean>

function getExportFunction(backupFormat: string): ExportAllFn {
    switch (backupFormat) {
        case 'HTML':
            return exportAllToHtml as ExportAllFn
        case 'JSON':
            return exportAllToOfficialJson as ExportAllFn
        case 'JSON (ZIP)':
            return exportAllToJson as ExportAllFn
        case 'Markdown':
        default:
            return exportAllToMarkdown as ExportAllFn
    }
}

export async function buildBackupZip(
    format: string,
    metaList: ExportMeta[],
    exportAllLimit: number,
    backupFormat: string,
    onProgress?: (progress: { completed: number; total: number; currentName: string }) => void,
): Promise<Blob> {
    // Step 1: Fetch all conversations
    const conversationItems = await fetchAllConversations(null, exportAllLimit)

    // Step 2: Fetch full conversation data
    const queue = new RequestQueue<ApiConversationWithId>(200, 1600)
    conversationItems.forEach((item) => {
        queue.add({
            name: item.title,
            request: () => fetchConversation(item.id, backupFormat !== 'JSON'),
        })
    })

    const conversations = await new Promise<ApiConversationWithId[]>((resolve) => {
        if (onProgress) {
            queue.on('progress', onProgress)
        }
        queue.on('done', resolve)
        queue.start()
    })

    // Step 3: Build ZIP blob using the selected format
    const exportFn = getExportFunction(backupFormat)
    const result = await exportFn(format, conversations, metaList, undefined, true)
    const blob = result as Blob

    // Official JSON format returns a raw JSON blob, not a ZIP.
    // Wrap it in a ZIP for consistency.
    if (backupFormat === 'JSON') {
        const zip = new JSZip()
        zip.file('chatgpt-export.json', blob)
        return zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 },
        })
    }

    return blob
}

function normalizeWorkspaceName(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]+/g, '-')
        .replace(/^-+|-+$/g, '')
        || 'default'
}

export async function backupToRemote(
    blob: Blob,
    config: BackupConfig,
): Promise<BackupResult> {
    try {
        const data = await blob.arrayBuffer()
        const workspaceName = await getCurrentWorkspaceName()
        const safeName = normalizeWorkspaceName(workspaceName)
        const fileName = `ChatGPT-backup-${safeName}-${timestamp()}.zip`

        if (config.method === 'S3') {
            const objectKey = config.pathPrefix
                ? `${config.pathPrefix.replace(/\/+$/, '')}/${fileName}`
                : fileName
            await uploadToS3(config, data, objectKey)
        }
        else {
            await uploadToWebDAV(config, data, fileName)
        }

        return { success: true }
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}
