# Remote Backup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S3-compatible and WebDAV remote backup to the ChatGPT Exporter userscript.

**Architecture:** New utility modules (`s3.ts`, `webdav.ts`, `backup.ts`) handle upload logic. Existing `exportAll*` functions are refactored to optionally return a Blob instead of downloading. Settings are managed through the existing `SettingContext` pattern. The main menu gains a backup status row with hover-triggered backup button.

**Tech Stack:** Preact, TypeScript, crypto.subtle (AWS SigV4), GM_xmlhttpRequest, vite-plugin-monkey

**Spec:** `docs/superpowers/specs/2026-03-15-remote-backup-design.md`

---

## Chunk 1: Foundation — Constants, Config, GM_xmlhttpRequest

### Task 1: Add storage keys and userscript metadata

**Files:**
- Modify: `src/constants.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add backup storage keys to constants.ts**

Add after the existing `KEY_EXPORT_ALL_LIMIT` line in `src/constants.ts`:

```typescript
export const KEY_BACKUP_ENABLED = 'exporter:backup_enabled'
export const KEY_BACKUP_METHOD = 'exporter:backup_method'
export const KEY_BACKUP_FORMAT = 'exporter:backup_format'
export const KEY_BACKUP_LAST_TIME = 'exporter:backup_last_time'

export const KEY_S3_ENDPOINT = 'exporter:s3_endpoint'
export const KEY_S3_REGION = 'exporter:s3_region'
export const KEY_S3_BUCKET = 'exporter:s3_bucket'
export const KEY_S3_ACCESS_KEY = 'exporter:s3_access_key'
export const KEY_S3_SECRET_KEY = 'exporter:s3_secret_key'
export const KEY_S3_PATH_PREFIX = 'exporter:s3_path_prefix'

export const KEY_WEBDAV_URL = 'exporter:webdav_url'
export const KEY_WEBDAV_USERNAME = 'exporter:webdav_username'
export const KEY_WEBDAV_PASSWORD = 'exporter:webdav_password'
export const KEY_WEBDAV_PATH_PREFIX = 'exporter:webdav_path_prefix'
```

- [ ] **Step 2: Add @connect to vite.config.ts**

In `vite.config.ts`, inside the `monkey({ userscript: { ... } })` block, add after `'run-at': 'document-end'`:

```typescript
'connect': [
    '*',
],
```

Note: Do NOT add an explicit `grant` array — vite-plugin-monkey auto-detects grants from imports. The `import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client'` in `gmFetch.ts` (Task 2) will trigger auto-detection of `GM_xmlhttpRequest` alongside the existing auto-detected grants (`GM_deleteValue`, `GM_getValue`, `GM_setValue`, `unsafeWindow`).

- [ ] **Step 3: Verify build works**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/constants.ts vite.config.ts
git commit -m "feat(backup): add storage keys and GM_xmlhttpRequest grant"
```

### Task 2: Create GM_xmlhttpRequest Promise wrapper

**Files:**
- Create: `src/utils/gmFetch.ts`

- [ ] **Step 1: Create gmFetch.ts**

```typescript
import { GM_xmlhttpRequest } from 'vite-plugin-monkey/dist/client'

export interface GmFetchOptions {
    method: string
    url: string
    headers?: Record<string, string>
    data?: ArrayBuffer
}

export interface GmFetchResponse {
    status: number
    statusText: string
    responseText: string
}

export function gmFetch(options: GmFetchOptions): Promise<GmFetchResponse> {
    return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
            method: options.method as any,
            url: options.url,
            headers: options.headers,
            data: options.data as any,
            responseType: 'text',
            onload: (response) => {
                resolve({
                    status: response.status,
                    statusText: response.statusText,
                    responseText: response.responseText,
                })
            },
            onerror: (error) => {
                reject(new Error(`Network error: ${error.statusText || 'Request failed'}`))
            },
            ontimeout: () => {
                reject(new Error('Request timed out'))
            },
        })
    })
}
```

- [ ] **Step 2: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/utils/gmFetch.ts
git commit -m "feat(backup): add GM_xmlhttpRequest promise wrapper"
```

### Task 3: Add backup settings to SettingContext

**Files:**
- Modify: `src/ui/SettingContext.tsx`

- [ ] **Step 1: Add imports for new storage keys**

In `src/ui/SettingContext.tsx`, add the new key imports to the existing import block from `'../constants'`:

```typescript
import {
    KEY_BACKUP_ENABLED,
    KEY_BACKUP_FORMAT,
    KEY_BACKUP_LAST_TIME,
    KEY_BACKUP_METHOD,
    KEY_EXPORT_ALL_LIMIT,
    KEY_FILENAME_FORMAT,
    KEY_META_ENABLED,
    KEY_META_LIST,
    KEY_S3_ACCESS_KEY,
    KEY_S3_BUCKET,
    KEY_S3_ENDPOINT,
    KEY_S3_PATH_PREFIX,
    KEY_S3_REGION,
    KEY_S3_SECRET_KEY,
    KEY_TIMESTAMP_24H,
    KEY_TIMESTAMP_ENABLED,
    KEY_TIMESTAMP_HTML,
    KEY_TIMESTAMP_MARKDOWN,
    KEY_WEBDAV_PASSWORD,
    KEY_WEBDAV_PATH_PREFIX,
    KEY_WEBDAV_URL,
    KEY_WEBDAV_USERNAME,
} from '../constants'
```

- [ ] **Step 2: Add backup fields to SettingContext default values**

Add after the `resetDefault: () => {},` line in the `createContext` call:

```typescript
    backupEnabled: false,
    setBackupEnabled: (_: boolean) => {},
    backupMethod: 'S3' as 'S3' | 'WebDAV',
    setBackupMethod: (_: 'S3' | 'WebDAV') => {},
    backupFormat: 'Markdown',
    setBackupFormat: (_: string) => {},
    backupLastTime: 0,
    setBackupLastTime: (_: number) => {},

    s3Endpoint: '',
    setS3Endpoint: (_: string) => {},
    s3Region: '',
    setS3Region: (_: string) => {},
    s3Bucket: '',
    setS3Bucket: (_: string) => {},
    s3AccessKey: '',
    setS3AccessKey: (_: string) => {},
    s3SecretKey: '',
    setS3SecretKey: (_: string) => {},
    s3PathPrefix: '',
    setS3PathPrefix: (_: string) => {},

    webdavUrl: '',
    setWebdavUrl: (_: string) => {},
    webdavUsername: '',
    setWebdavUsername: (_: string) => {},
    webdavPassword: '',
    setWebdavPassword: (_: string) => {},
    webdavPathPrefix: '',
    setWebdavPathPrefix: (_: string) => {},
```

- [ ] **Step 3: Add useGMStorage hooks in SettingProvider**

Add after the existing `useGMStorage` lines in `SettingProvider`:

```typescript
    const [backupEnabled, setBackupEnabled] = useGMStorage(KEY_BACKUP_ENABLED, false)
    const [backupMethod, setBackupMethod] = useGMStorage<'S3' | 'WebDAV'>(KEY_BACKUP_METHOD, 'S3')
    const [backupFormat, setBackupFormat] = useGMStorage(KEY_BACKUP_FORMAT, 'Markdown')
    const [backupLastTime, setBackupLastTime] = useGMStorage(KEY_BACKUP_LAST_TIME, 0)

    const [s3Endpoint, setS3Endpoint] = useGMStorage(KEY_S3_ENDPOINT, '')
    const [s3Region, setS3Region] = useGMStorage(KEY_S3_REGION, '')
    const [s3Bucket, setS3Bucket] = useGMStorage(KEY_S3_BUCKET, '')
    const [s3AccessKey, setS3AccessKey] = useGMStorage(KEY_S3_ACCESS_KEY, '')
    const [s3SecretKey, setS3SecretKey] = useGMStorage(KEY_S3_SECRET_KEY, '')
    const [s3PathPrefix, setS3PathPrefix] = useGMStorage(KEY_S3_PATH_PREFIX, '')

    const [webdavUrl, setWebdavUrl] = useGMStorage(KEY_WEBDAV_URL, '')
    const [webdavUsername, setWebdavUsername] = useGMStorage(KEY_WEBDAV_USERNAME, '')
    const [webdavPassword, setWebdavPassword] = useGMStorage(KEY_WEBDAV_PASSWORD, '')
    const [webdavPathPrefix, setWebdavPathPrefix] = useGMStorage(KEY_WEBDAV_PATH_PREFIX, '')
```

- [ ] **Step 4: Pass all new values into the Provider value**

Add all the new state/setter pairs to the `<SettingContext.Provider value={{ ... }}>` object, after the existing `resetDefault`:

```typescript
                backupEnabled,
                setBackupEnabled,
                backupMethod,
                setBackupMethod,
                backupFormat,
                setBackupFormat,
                backupLastTime,
                setBackupLastTime,

                s3Endpoint,
                setS3Endpoint,
                s3Region,
                setS3Region,
                s3Bucket,
                setS3Bucket,
                s3AccessKey,
                setS3AccessKey,
                s3SecretKey,
                setS3SecretKey,
                s3PathPrefix,
                setS3PathPrefix,

                webdavUrl,
                setWebdavUrl,
                webdavUsername,
                setWebdavUsername,
                webdavPassword,
                setWebdavPassword,
                webdavPathPrefix,
                setWebdavPathPrefix,
```

- [ ] **Step 5: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ui/SettingContext.tsx
git commit -m "feat(backup): add backup settings to SettingContext"
```

---

## Chunk 2: S3 and WebDAV Upload Clients

### Task 4: Implement S3 client with AWS Signature V4

**Files:**
- Create: `src/utils/s3.ts`

- [ ] **Step 1: Create s3.ts with S3Config interface and signing helpers**

```typescript
import { gmFetch } from './gmFetch'

export interface S3Config {
    endpoint: string
    region: string
    bucket: string
    accessKey: string
    secretKey: string
    pathPrefix: string
}

async function sha256(data: ArrayBuffer): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Str(data: string): Promise<string> {
    return sha256(new TextEncoder().encode(data))
}

async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

async function getSigningKey(secretKey: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp)
    const kRegion = await hmacSha256(kDate, region)
    const kService = await hmacSha256(kRegion, service)
    return hmacSha256(kService, 'aws4_request')
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function uploadToS3(config: S3Config, data: ArrayBuffer, objectKey: string): Promise<void> {
    const { endpoint, region, bucket, accessKey, secretKey } = config

    const url = new URL(endpoint)
    // Use path-style URL: endpoint/bucket/key
    const path = `/${bucket}/${objectKey}`
    const fullUrl = `${url.protocol}//${url.host}${path}`

    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8) // YYYYMMDD
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // YYYYMMDDTHHmmssZ

    const payloadHash = await sha256(data)
    const contentType = 'application/zip'

    const headers: Record<string, string> = {
        'Host': url.host,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
    }

    // Build canonical request
    const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort()
    const signedHeaders = signedHeaderKeys.join(';')
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[Object.keys(headers).find(h => h.toLowerCase() === k)!]}\n`).join('')

    const canonicalRequest = [
        'PUT',
        path,
        '', // query string
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n')

    // Build string to sign
    const scope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        scope,
        await sha256Str(canonicalRequest),
    ].join('\n')

    // Calculate signature
    const signingKey = await getSigningKey(secretKey, dateStamp, region, 's3')
    const signature = toHex(await hmacSha256(signingKey, stringToSign))

    // Build authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const response = await gmFetch({
        method: 'PUT',
        url: fullUrl,
        headers: {
            ...headers,
            'Authorization': authorization,
        },
        data,
    })

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText} - ${response.responseText}`)
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/utils/s3.ts
git commit -m "feat(backup): implement S3 client with AWS Signature V4"
```

### Task 5: Implement WebDAV client

**Files:**
- Create: `src/utils/webdav.ts`

- [ ] **Step 1: Create webdav.ts**

```typescript
import { gmFetch } from './gmFetch'

export interface WebDAVConfig {
    url: string
    username: string
    password: string
    pathPrefix: string
}

function basicAuth(username: string, password: string): string {
    return `Basic ${btoa(`${username}:${password}`)}`
}

function joinUrl(base: string, path: string): string {
    const cleanBase = base.replace(/\/+$/, '')
    const cleanPath = path.replace(/^\/+/, '')
    return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase
}

async function ensureDirectory(config: WebDAVConfig): Promise<void> {
    if (!config.pathPrefix) return

    const dirUrl = joinUrl(config.url, config.pathPrefix)

    try {
        const response = await gmFetch({
            method: 'MKCOL',
            url: dirUrl.replace(/\/+$/, '') + '/',
            headers: {
                'Authorization': basicAuth(config.username, config.password),
            },
        })
        // 201 = created, 405 = method not allowed (already exists), 409 = conflict (parent exists)
        if (response.status !== 201 && response.status !== 405 && response.status !== 409) {
            console.warn(`[Exporter] MKCOL returned ${response.status}, continuing anyway`)
        }
    }
    catch {
        // Ignore MKCOL errors — the PUT will fail if the directory truly doesn't exist
        console.warn('[Exporter] MKCOL failed, continuing with upload')
    }
}

export async function uploadToWebDAV(config: WebDAVConfig, data: ArrayBuffer, fileName: string): Promise<void> {
    await ensureDirectory(config)

    const uploadPath = config.pathPrefix
        ? `${config.pathPrefix.replace(/\/+$/, '')}/${fileName}`
        : fileName
    const uploadUrl = joinUrl(config.url, uploadPath)

    const response = await gmFetch({
        method: 'PUT',
        url: uploadUrl,
        headers: {
            'Authorization': basicAuth(config.username, config.password),
            'Content-Type': 'application/zip',
        },
        data,
    })

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`WebDAV upload failed: ${response.status} ${response.statusText} - ${response.responseText}`)
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/utils/webdav.ts
git commit -m "feat(backup): implement WebDAV client"
```

---

## Chunk 3: Backup Logic — Refactor exportAll, buildBackupZip, backupToRemote

### Task 6: Refactor exportAll functions to optionally return Blob

The existing `exportAllToMarkdown`, `exportAllToHtml`, `exportAllToJson`, `exportAllToOfficialJson` all call `downloadFile()` at the end. Refactor them to accept an optional `returnBlob` parameter. When true, return the Blob instead of downloading.

**Files:**
- Modify: `src/exporter/markdown.ts`
- Modify: `src/exporter/html.ts`
- Modify: `src/exporter/json.ts`

- [ ] **Step 1: Refactor exportAllToMarkdown**

In `src/exporter/markdown.ts`, change the `exportAllToMarkdown` function signature and return logic:

```typescript
export async function exportAllToMarkdown(fileNameFormat: string, apiConversations: ApiConversationWithId[], metaList?: ExportMeta[], projectName?: string, returnBlob?: boolean): Promise<true | Blob> {
    const zip = new JSZip()
    const filenameMap = new Map<string, number>()
    const conversations = apiConversations.map(x => processConversation(x))
    conversations.forEach((conversation) => {
        let fileName = getFileNameWithFormat(fileNameFormat, 'md', {
            title: conversation.title,
            chatId: conversation.id,
            createTime: conversation.createTime,
            updateTime: conversation.updateTime,
        })
        if (filenameMap.has(fileName)) {
            const count = filenameMap.get(fileName) ?? 1
            filenameMap.set(fileName, count + 1)
            fileName = `${fileName.slice(0, -3)} (${count}).md`
        }
        else {
            filenameMap.set(fileName, 1)
        }
        const content = conversationToMarkdown(conversation, metaList)
        zip.file(fileName, content)
    })

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
            level: 9,
        },
    })

    if (returnBlob) return blob
    downloadFile(buildZipFileName('markdown', projectName), 'application/zip', blob)
    return true
}
```

- [ ] **Step 2: Refactor exportAllToHtml**

In `src/exporter/html.ts`, apply same pattern to `exportAllToHtml`:

```typescript
export async function exportAllToHtml(fileNameFormat: string, apiConversations: ApiConversationWithId[], metaList?: ExportMeta[], projectName?: string, returnBlob?: boolean): Promise<true | Blob> {
```

At the end of the function, replace:
```typescript
    downloadFile(buildZipFileName('html', projectName), 'application/zip', blob)
    return true
```
with:
```typescript
    if (returnBlob) return blob
    downloadFile(buildZipFileName('html', projectName), 'application/zip', blob)
    return true
```

- [ ] **Step 3: Refactor exportAllToJson**

In `src/exporter/json.ts`, apply same pattern to `exportAllToJson`:

```typescript
export async function exportAllToJson(fileNameFormat: string, apiConversations: ApiConversationWithId[], _metaList?: ExportMeta[], projectName?: string, returnBlob?: boolean): Promise<true | Blob> {
```

At the end, replace:
```typescript
    downloadFile(buildZipFileName('json', projectName), 'application/zip', blob)
    return true
```
with:
```typescript
    if (returnBlob) return blob
    downloadFile(buildZipFileName('json', projectName), 'application/zip', blob)
    return true
```

- [ ] **Step 4: Refactor exportAllToOfficialJson**

In `src/exporter/json.ts`, apply same pattern to `exportAllToOfficialJson`:

```typescript
export async function exportAllToOfficialJson(_fileNameFormat: string, apiConversations: ApiConversationWithId[], _metaList?: ExportMeta[], projectName?: string, returnBlob?: boolean): Promise<true | Blob> {
    const content = conversationToJson(apiConversations)
    const baseName = projectName
        ? `chatgpt-export-project-${normalizeProjectName(projectName)}`
        : 'chatgpt-export'

    if (returnBlob) return new Blob([content], { type: 'application/json' })
    downloadFile(`${baseName}.json`, 'application/json', content)
    return true
}
```

- [ ] **Step 5: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/exporter/markdown.ts src/exporter/html.ts src/exporter/json.ts
git commit -m "refactor(export): add returnBlob option to exportAll functions"
```

### Task 7: Create unified backup module

**Files:**
- Create: `src/utils/backup.ts`

- [ ] **Step 1: Create backup.ts with buildBackupZip and backupToRemote**

```typescript
import JSZip from 'jszip'
import { fetchAllConversations, fetchConversation } from '../api'
import { exportAllToHtml } from '../exporter/html'
import { exportAllToJson, exportAllToOfficialJson } from '../exporter/json'
import { exportAllToMarkdown } from '../exporter/markdown'
import { RequestQueue } from './queue'
import { uploadToS3 } from './s3'
import { uploadToWebDAV } from './webdav'
import type { ApiConversationWithId } from '../api'
import type { ExportMeta } from '../ui/SettingContext'
import type { S3Config } from './s3'
import type { WebDAVConfig } from './webdav'

export type BackupConfig =
    | ({ method: 'S3' } & S3Config)
    | ({ method: 'WebDAV' } & WebDAVConfig)

export interface BackupResult {
    success: boolean
    error?: string
}

function generateBackupFileName(): string {
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    return `ChatGPT-backup-${ts}.zip`
}

export async function buildBackupZip(
    format: string,
    metaList: ExportMeta[],
    exportAllLimit: number,
    backupFormat: string,
    onProgress?: (progress: { completed: number; total: number; currentName: string }) => void,
): Promise<Blob> {
    // Step 1: Fetch all conversation list
    const conversationItems = await fetchAllConversations(null, exportAllLimit)

    // Step 2: Fetch each conversation detail
    const queue = new RequestQueue<ApiConversationWithId>(200, 1600)
    const shouldReplaceAssets = backupFormat !== 'JSON'

    conversationItems.forEach(({ id, title }) => {
        queue.add({
            name: title,
            request: () => fetchConversation(id, shouldReplaceAssets),
        })
    })

    const conversations = await new Promise<ApiConversationWithId[]>((resolve) => {
        queue.on('done', resolve)
        if (onProgress) {
            queue.on('progress', (p) => {
                onProgress({ completed: p.completed, total: p.total, currentName: p.currentName })
            })
        }
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

function getExportFunction(backupFormat: string) {
    switch (backupFormat) {
        case 'HTML':
            return exportAllToHtml
        case 'JSON':
            return exportAllToOfficialJson
        case 'JSON (ZIP)':
            return exportAllToJson
        case 'Markdown':
        default:
            return exportAllToMarkdown
    }
}

export async function backupToRemote(blob: Blob, config: BackupConfig): Promise<BackupResult> {
    try {
        const data = await blob.arrayBuffer()
        const fileName = generateBackupFileName()

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
        const message = error instanceof Error ? error.message : String(error)
        return { success: false, error: message }
    }
}
```

- [ ] **Step 2: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/utils/backup.ts
git commit -m "feat(backup): create unified backup module with buildBackupZip and backupToRemote"
```

---

## Chunk 4: Settings UI

### Task 8: Add Remote Backup section to SettingDialog

**Files:**
- Modify: `src/ui/SettingDialog.tsx`

- [ ] **Step 1: Add backup settings destructuring**

In `SettingDialog.tsx`, add the backup settings to the destructuring from `useSettingContext()`, after `exportAllLimit, setExportAllLimit,`:

```typescript
        backupEnabled, setBackupEnabled,
        backupMethod, setBackupMethod,
        backupFormat, setBackupFormat,
        s3Endpoint, setS3Endpoint,
        s3Region, setS3Region,
        s3Bucket, setS3Bucket,
        s3AccessKey, setS3AccessKey,
        s3SecretKey, setS3SecretKey,
        s3PathPrefix, setS3PathPrefix,
        webdavUrl, setWebdavUrl,
        webdavUsername, setWebdavUsername,
        webdavPassword, setWebdavPassword,
        webdavPathPrefix, setWebdavPathPrefix,
```

- [ ] **Step 2: Add Remote Backup settings section**

In `SettingDialog.tsx`, add after the "Export Metadata" `</div>` block (before the closing `</dl>`), add a new section:

```tsx
                        <div className="relative flex bg-white dark:bg-white/5 rounded p-4">
                            <div className="w-full">
                                <dt className="text-md font-medium text-gray-800 dark:text-white">
                                    {t('Remote Backup')}
                                </dt>
                                <dd className="text-sm text-gray-700 dark:text-gray-300">
                                    {backupEnabled && (
                                        <>
                                            <div className="mt-3">
                                                <label className="block text-sm font-medium mb-1">{t('Backup Method')}</label>
                                                <select
                                                    className="Select"
                                                    value={backupMethod}
                                                    onChange={e => setBackupMethod(e.currentTarget.value as 'S3' | 'WebDAV')}
                                                >
                                                    <option value="S3">S3</option>
                                                    <option value="WebDAV">WebDAV</option>
                                                </select>
                                            </div>
                                            <div className="mt-3">
                                                <label className="block text-sm font-medium mb-1">{t('Backup Format')}</label>
                                                <select
                                                    className="Select"
                                                    value={backupFormat}
                                                    onChange={e => setBackupFormat(e.currentTarget.value)}
                                                >
                                                    <option value="Markdown">Markdown</option>
                                                    <option value="HTML">HTML</option>
                                                    <option value="JSON">JSON</option>
                                                    <option value="JSON (ZIP)">JSON (ZIP)</option>
                                                </select>
                                            </div>

                                            <div className={`mt-4 p-3 border rounded ${backupMethod === 'S3' ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
                                                <div className="text-sm font-medium mb-2">{t('S3 Configuration')}</div>
                                                <div className="space-y-2">
                                                    <input className="Input" placeholder={t('Endpoint')} value={s3Endpoint} onChange={e => setS3Endpoint(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Region')} value={s3Region} onChange={e => setS3Region(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Bucket')} value={s3Bucket} onChange={e => setS3Bucket(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Access Key')} value={s3AccessKey} onChange={e => setS3AccessKey(e.currentTarget.value)} />
                                                    <input className="Input" type="password" placeholder={t('Secret Key')} value={s3SecretKey} onChange={e => setS3SecretKey(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Path Prefix')} value={s3PathPrefix} onChange={e => setS3PathPrefix(e.currentTarget.value)} />
                                                </div>
                                            </div>

                                            <div className={`mt-3 p-3 border rounded ${backupMethod === 'WebDAV' ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-gray-700 opacity-60'}`}>
                                                <div className="text-sm font-medium mb-2">{t('WebDAV Configuration')}</div>
                                                <div className="space-y-2">
                                                    <input className="Input" placeholder={t('WebDAV URL')} value={webdavUrl} onChange={e => setWebdavUrl(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Username')} value={webdavUsername} onChange={e => setWebdavUsername(e.currentTarget.value)} />
                                                    <input className="Input" type="password" placeholder={t('Password')} value={webdavPassword} onChange={e => setWebdavPassword(e.currentTarget.value)} />
                                                    <input className="Input" placeholder={t('Path Prefix')} value={webdavPathPrefix} onChange={e => setWebdavPathPrefix(e.currentTarget.value)} />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </dd>
                            </div>
                            <div className="absolute right-4">
                                <Toggle label="" checked={backupEnabled} onCheckedUpdate={setBackupEnabled} />
                            </div>
                        </div>
```

- [ ] **Step 3: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/ui/SettingDialog.tsx
git commit -m "feat(backup): add Remote Backup settings section to SettingDialog"
```

---

## Chunk 5: Main Menu UI — Backup Status and Button

### Task 9: Add backup status row and button to Menu

**Files:**
- Modify: `src/ui/Menu.tsx`

- [ ] **Step 1: Add imports**

In `src/ui/Menu.tsx`, add these imports at the top:

```typescript
import { backupToRemote, buildBackupZip } from '../utils/backup'
import type { BackupConfig } from '../utils/backup'
```

- [ ] **Step 2: Add backup state and helpers in MenuInner**

Inside the `MenuInner` component, after the existing `useSettingContext()` destructuring, add the backup-related state. First update the destructuring to include backup settings:

```typescript
    const {
        format,
        enableTimestamp,
        timeStamp24H,
        enableMeta,
        exportMetaList,
        backupEnabled,
        backupMethod,
        backupFormat,
        backupLastTime,
        setBackupLastTime,
        exportAllLimit,
        s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey, s3PathPrefix,
        webdavUrl, webdavUsername, webdavPassword, webdavPathPrefix,
    } = useSettingContext()
```

Then add backup state and helper functions after the `metaList` memo:

```typescript
    const [backingUp, setBackingUp] = useState(false)
    const [backupHover, setBackupHover] = useState(false)

    const backupConfigured = useMemo(() => {
        if (backupMethod === 'S3') {
            return !!(s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey)
        }
        return !!(webdavUrl && webdavUsername && webdavPassword)
    }, [backupMethod, s3Endpoint, s3Bucket, s3AccessKey, s3SecretKey, webdavUrl, webdavUsername, webdavPassword])

    const relativeTime = useMemo(() => {
        if (!backupLastTime) return t('Never')
        const diff = Date.now() - backupLastTime
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)
        if (minutes < 1) return t('Just now')
        if (hours < 1) return t('{n}m ago', { n: minutes })
        if (days < 1) return t('{n}h ago', { n: hours })
        return t('{n}d ago', { n: days })
    }, [backupLastTime, t])

    const onClickBackup = useCallback(async () => {
        if (backingUp || !backupConfigured) return
        setBackingUp(true)
        try {
            const blob = await buildBackupZip(format, enableMeta ? exportMetaList : [], exportAllLimit, backupFormat)
            const config: BackupConfig = backupMethod === 'S3'
                ? { method: 'S3', endpoint: s3Endpoint, region: s3Region, bucket: s3Bucket, accessKey: s3AccessKey, secretKey: s3SecretKey, pathPrefix: s3PathPrefix }
                : { method: 'WebDAV', url: webdavUrl, username: webdavUsername, password: webdavPassword, pathPrefix: webdavPathPrefix }
            const result = await backupToRemote(blob, config)
            if (result.success) {
                setBackupLastTime(Date.now())
                alert(t('Backup Success'))
            }
            else {
                alert(`${t('Backup Failed')}: ${result.error}`)
            }
        }
        catch (error) {
            alert(`${t('Backup Failed')}: ${error instanceof Error ? error.message : String(error)}`)
        }
        finally {
            setBackingUp(false)
        }
    }, [
        backingUp, backupConfigured, format, enableMeta, exportMetaList,
        exportAllLimit, backupFormat, backupMethod,
        s3Endpoint, s3Region, s3Bucket, s3AccessKey, s3SecretKey, s3PathPrefix,
        webdavUrl, webdavUsername, webdavPassword, webdavPathPrefix,
        setBackupLastTime, t,
    ])
```

- [ ] **Step 3: Add backup status row JSX**

In `Menu.tsx`, add the backup status row after the `</ExportDialog>` closing tag and before the `{!isMobile && (` HoverCard.Arrow block:

```tsx
                        {backupEnabled && (
                            <div
                                className="row-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
                                onMouseEnter={() => setBackupHover(true)}
                                onMouseLeave={() => setBackupHover(false)}
                            >
                                <span>{t('Last Backup')}: {relativeTime}</span>
                                {(backupHover || isMobile) && (
                                    <button
                                        className="px-2 py-1 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        disabled={backingUp || !backupConfigured}
                                        title={!backupConfigured ? t('Please configure remote backup in settings') : ''}
                                        onClick={onClickBackup}
                                    >
                                        {backingUp ? t('Backup in progress') : t('Backup to Remote')}
                                    </button>
                                )}
                            </div>
                        )}
```

- [ ] **Step 4: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Menu.tsx
git commit -m "feat(backup): add backup status row and button to main menu"
```

---

## Chunk 6: i18n Translations

### Task 10: Add translation keys to all locale files

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh-Hans.json`
- Modify: `src/locales/zh-Hant.json`
- Modify: `src/locales/es.json`
- Modify: `src/locales/fr.json`
- Modify: `src/locales/ru.json`
- Modify: `src/locales/tr.json`
- Modify: `src/locales/id.json`
- Modify: `src/locales/jp.json`

- [ ] **Step 1: Add English translations**

Add the following keys to `src/locales/en.json` before the closing `}`:

```json
  "Remote Backup": "Remote Backup",
  "Backup Method": "Backup Method",
  "Backup Format": "Backup Format",
  "S3 Configuration": "S3 Configuration",
  "WebDAV Configuration": "WebDAV Configuration",
  "Endpoint": "Endpoint",
  "Region": "Region",
  "Bucket": "Bucket",
  "Access Key": "Access Key",
  "Secret Key": "Secret Key",
  "Path Prefix": "Path Prefix",
  "WebDAV URL": "WebDAV URL",
  "Username": "Username",
  "Password": "Password",
  "Backup to Remote": "Backup to Remote",
  "Last Backup": "Last Backup",
  "Never": "Never",
  "Just now": "Just now",
  "{n}m ago": "{{n}}m ago",
  "{n}h ago": "{{n}}h ago",
  "{n}d ago": "{{n}}d ago",
  "Backup Success": "Backup successful",
  "Backup Failed": "Backup failed",
  "Backup in progress": "Backing up...",
  "Please configure remote backup in settings": "Please configure remote backup in settings"
```

Note: i18next uses `{{n}}` for interpolation (double curly braces).

- [ ] **Step 2: Add Chinese Simplified translations**

Add the following keys to `src/locales/zh-Hans.json` before the closing `}`:

```json
  "Remote Backup": "远程备份",
  "Backup Method": "备份方式",
  "Backup Format": "备份格式",
  "S3 Configuration": "S3 配置",
  "WebDAV Configuration": "WebDAV 配置",
  "Endpoint": "端点地址",
  "Region": "区域",
  "Bucket": "存储桶",
  "Access Key": "Access Key",
  "Secret Key": "Secret Key",
  "Path Prefix": "路径前缀",
  "WebDAV URL": "WebDAV 地址",
  "Username": "用户名",
  "Password": "密码",
  "Backup to Remote": "备份到远程",
  "Last Backup": "上次备份",
  "Never": "从未",
  "Just now": "刚刚",
  "{n}m ago": "{{n}}分钟前",
  "{n}h ago": "{{n}}小时前",
  "{n}d ago": "{{n}}天前",
  "Backup Success": "备份成功",
  "Backup Failed": "备份失败",
  "Backup in progress": "备份中...",
  "Please configure remote backup in settings": "请先在设置中配置远程备份"
```

- [ ] **Step 3: Add English fallback keys to all other locale files**

For each of the following files, add the same English keys (same as Step 1) before the closing `}`:
- `src/locales/zh-Hant.json`
- `src/locales/es.json`
- `src/locales/fr.json`
- `src/locales/ru.json`
- `src/locales/tr.json`
- `src/locales/id.json`
- `src/locales/jp.json`

Use the English values as fallback for all these locales.

- [ ] **Step 4: Verify build**

Run: `cd /root/chatgpt-exporter && npx vite build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/locales/
git commit -m "feat(backup): add i18n translation keys for remote backup"
```

---

## Chunk 7: Final Build Verification

### Task 11: Full build and lint check

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `cd /root/chatgpt-exporter && npx vite build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify the userscript output contains GM_xmlhttpRequest grant**

Run: `head -50 /root/chatgpt-exporter/dist/chatgpt.user.js | grep -E 'grant|connect'`
Expected: Output contains `// @grant GM_xmlhttpRequest` and `// @connect *`

- [ ] **Step 3: Run lint if available**

Run: `cd /root/chatgpt-exporter && npx eslint src/utils/s3.ts src/utils/webdav.ts src/utils/backup.ts src/utils/gmFetch.ts src/ui/Menu.tsx src/ui/SettingDialog.tsx src/ui/SettingContext.tsx --fix 2>&1 | tail -20`
Expected: No errors (warnings acceptable).

- [ ] **Step 4: Fix any lint issues and commit**

```bash
git add -A
git commit -m "chore: fix lint issues from remote backup feature"
```
