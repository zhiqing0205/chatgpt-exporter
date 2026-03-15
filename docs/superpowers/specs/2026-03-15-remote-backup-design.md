# Remote Backup Feature Design

## Overview

Add remote backup functionality to the ChatGPT Exporter userscript, supporting S3-compatible storage and WebDAV. Users can configure backup settings, set a default method, and trigger backups from the main menu. The main UI shows the last backup time with a hover-triggered backup button.

## Architecture

### New Files

- `src/utils/s3.ts` — S3 client with AWS Signature V4 signing, using browser-native `crypto.subtle`
- `src/utils/webdav.ts` — WebDAV client using PUT method with Basic Auth
- `src/utils/backup.ts` — Unified backup interface dispatching to S3 or WebDAV, plus `buildBackupZip` helper

### Modified Files

- `vite.config.ts` — Add `GM_xmlhttpRequest` grant and `@connect *` metadata
- `src/constants.ts` — New storage keys for backup configuration
- `src/ui/SettingContext.tsx` — Backup settings state management via `useGMStorage`
- `src/ui/SettingDialog.tsx` — New "Remote Backup" settings section
- `src/ui/Menu.tsx` — Last backup display and "Backup to Remote" button
- `src/locales/en.json` — English translations
- `src/locales/zh-Hans.json` — Chinese translations
- Other locale files (`zh-Hant`, `es`, `fr`, `ru`, `tr`, `id`, `jp`) — Add English fallback keys

### Data Flow

1. User clicks "Backup to Remote" → call `buildBackupZip()` to fetch all conversations and package as ZIP Blob (no browser download triggered)
2. ZIP Blob → convert to `ArrayBuffer` → dispatch to S3 or WebDAV client based on settings → upload via `GM_xmlhttpRequest` (bypasses CORS)
3. On success, store current timestamp in GMStorage → Menu reads and displays relative time

### Userscript Metadata Changes (`vite.config.ts`)

Add to the monkey plugin `userscript` config:

- `grant`: Add `GM_xmlhttpRequest` to the grant list (currently only `GM_deleteValue`, `GM_getValue`, `GM_setValue`, `unsafeWindow` are granted via vite-plugin-monkey auto-detection)
- `connect`: Add `'*'` to allow cross-origin requests to user-configured S3/WebDAV endpoints. Since endpoints are user-configured and unknown at build time, wildcard is required. Tampermonkey will still prompt users on first request to each domain.

## Storage Keys

All keys defined in `src/constants.ts`:

| Key | Type | Description |
|-----|------|-------------|
| `exporter:backup_enabled` | `boolean` | Whether remote backup is enabled |
| `exporter:backup_method` | `'S3' \| 'WebDAV'` | Default backup method |
| `exporter:backup_format` | `string` | Export format for backup (Markdown/HTML/JSON/JSON (ZIP)) |
| `exporter:backup_last_time` | `number` | Unix timestamp (ms) of last successful backup |
| `exporter:s3_endpoint` | `string` | S3 endpoint URL |
| `exporter:s3_region` | `string` | S3 region |
| `exporter:s3_bucket` | `string` | S3 bucket name |
| `exporter:s3_access_key` | `string` | S3 Access Key ID |
| `exporter:s3_secret_key` | `string` | S3 Secret Access Key |
| `exporter:s3_path_prefix` | `string` | Object key prefix (e.g., "backups/") |
| `exporter:webdav_url` | `string` | WebDAV server URL |
| `exporter:webdav_username` | `string` | WebDAV username |
| `exporter:webdav_password` | `string` | WebDAV password |
| `exporter:webdav_path_prefix` | `string` | WebDAV upload path prefix |

### Security Note

Credentials (S3 Secret Key, WebDAV password) are stored in plaintext in userscript storage (via `GM_setValue`). This is consistent with the existing storage approach and is a known limitation of the userscript environment. Users should be aware that credentials are accessible to other scripts running with `GM_getValue` access in the same scope.

## Settings UI

New section added after "Export Metadata" in `SettingDialog.tsx`:

- Top-level Toggle to enable/expand the section (persisted via `exporter:backup_enabled`)
- **Default Method**: Dropdown selecting S3 or WebDAV
- **Backup Format**: Dropdown selecting Markdown / HTML / JSON / JSON (ZIP)
- **S3 Configuration**: Endpoint, Region, Bucket, Access Key, Secret Key (`type="password"`), Path Prefix — six input fields
- **WebDAV Configuration**: URL, Username, Password (`type="password"`), Path Prefix — four input fields
- Both config blocks are always configurable; the currently selected default method's block is shown expanded

## Main Menu UI

New row added below "Export All" in the HoverCard menu:

```
┌─────────────────────────────────────────┐
│ Setting                                 │
│ Copy Text                               │
│ Screenshot        │ Markdown            │
│ HTML              │ JSON                │
│ Export All                              │
│ Last backup: 3h ago        [Backup]     │  ← new
└─────────────────────────────────────────┘
```

### Behavior

- Only shown when `backup_enabled` is true
- Default: displays small text "Last backup: Xm/Xh/Xd ago" using local time (timezone-agnostic relative time computed as `Date.now() - lastBackupTimestamp`)
- If never backed up: "Last backup: Never"
- Relative time rules: <1min → "Just now", <1h → "Xm ago", <24h → "Xh ago", >=24h → "Xd ago"
- On hover: "Backup to Remote" button appears on the right
- Button disabled with tooltip if backup not configured (missing required S3/WebDAV fields)
- Button disabled while a backup is in progress (tracked via component state `backingUp`)
- On click: button enters loading state → `buildBackupZip()` fetches all conversations and packages ZIP → upload via S3/WebDAV → update `backup_last_time` → show success feedback
- On failure: alert error message

### ZIP Naming

Format: `ChatGPT-backup-{timestamp}.zip` where timestamp is ISO-like `YYYYMMDD-HHmmss`

## Backup ZIP Builder (`src/utils/backup.ts`)

### `buildBackupZip`

```typescript
async function buildBackupZip(
  format: string,
  metaList: ExportMeta[],
  exportAllLimit: number,
  onProgress?: (progress: { completed: number; total: number; currentName: string }) => void,
): Promise<Blob>
```

This function extracts the core logic from `ExportDialog` into a reusable form:

1. Call `fetchAllConversations()` to get conversation list
2. Fetch each conversation detail via `fetchConversation()` using a `RequestQueue`
3. Based on `format`, call the appropriate export function (`exportAllToMarkdown`, `exportAllToHtml`, `exportAllToJson`, etc.) but modified to return a ZIP `Blob` instead of triggering `downloadFile()`
4. The existing `exportAll*` functions in `src/exporter/*.ts` currently call `downloadFile()` internally. Refactor them to accept an optional parameter that returns the Blob instead of downloading. The download path remains the default behavior so existing functionality is unchanged.

## S3 Client (`src/utils/s3.ts`)

### Interface

```typescript
interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  pathPrefix: string
}

async function uploadToS3(config: S3Config, data: ArrayBuffer, objectKey: string): Promise<void>
```

### Implementation

- AWS Signature V4 signing using `crypto.subtle` for HMAC-SHA256 and SHA256
- Steps: Canonical Request → String to Sign → Signing Key → Signature → Authorization Header
- Blob must be converted to `ArrayBuffer` via `blob.arrayBuffer()` before signing (SHA-256 hash of body) and uploading
- PUT request via `GM_xmlhttpRequest` (bypasses CORS)
- Content-Type: `application/zip`
- Object key: `{pathPrefix}ChatGPT-backup-{timestamp}.zip`

## WebDAV Client (`src/utils/webdav.ts`)

### Interface

```typescript
interface WebDAVConfig {
  url: string
  username: string
  password: string
  pathPrefix: string
}

async function uploadToWebDAV(config: WebDAVConfig, data: ArrayBuffer, fileName: string): Promise<void>
```

### Implementation

- Blob converted to `ArrayBuffer` via `blob.arrayBuffer()` before upload
- PUT request via `GM_xmlhttpRequest`
- Authentication: Basic Auth (`Authorization: Basic base64(username:password)`)
- Upload path: `{url}/{pathPrefix}ChatGPT-backup-{timestamp}.zip`
- Pre-upload MKCOL to ensure directory exists (ignore 405/409 errors indicating already exists)

## Unified Backup Interface (`src/utils/backup.ts`)

```typescript
type BackupConfig =
  | { method: 'S3' } & S3Config
  | { method: 'WebDAV' } & WebDAVConfig

interface BackupResult {
  success: boolean
  error?: string
}

async function backupToRemote(
  blob: Blob,
  config: BackupConfig,
): Promise<BackupResult>
```

- Converts Blob to ArrayBuffer once
- Dispatches to S3 or WebDAV upload function based on `config.method`
- Unified error handling and return format

### GM_xmlhttpRequest Wrapper

Shared Promise wrapper for `GM_xmlhttpRequest` callback-style API:

```typescript
function gmFetch(options: {
  method: string
  url: string
  headers?: Record<string, string>
  data?: ArrayBuffer
}): Promise<{ status: number; responseText: string }>
```

- Wraps `GM_xmlhttpRequest` in a Promise
- Data is passed as `ArrayBuffer` (not Blob) for cross-userscript-manager compatibility
- Rejects on network error, resolves with status and response

## i18n Keys

New translation keys added to `en.json` and `zh-Hans.json`. All other locale files (`zh-Hant`, `es`, `fr`, `ru`, `tr`, `id`, `jp`) will have the English strings added so that `i18next` does not fall back to raw keys.

| Key | English | Chinese |
|-----|---------|---------|
| Remote Backup | Remote Backup | 远程备份 |
| Backup Method | Backup Method | 备份方式 |
| Backup Format | Backup Format | 备份格式 |
| S3 Configuration | S3 Configuration | S3 配置 |
| WebDAV Configuration | WebDAV Configuration | WebDAV 配置 |
| Endpoint | Endpoint | 端点地址 |
| Region | Region | 区域 |
| Bucket | Bucket | 存储桶 |
| Access Key | Access Key | Access Key |
| Secret Key | Secret Key | Secret Key |
| Path Prefix | Path Prefix | 路径前缀 |
| WebDAV URL | WebDAV URL | WebDAV 地址 |
| Username | Username | 用户名 |
| Password | Password | 密码 |
| Backup to Remote | Backup to Remote | 备份到远程 |
| Last Backup | Last Backup | 上次备份 |
| Never | Never | 从未 |
| Just now | Just now | 刚刚 |
| {n}m ago | {n}m ago | {n}分钟前 |
| {n}h ago | {n}h ago | {n}小时前 |
| {n}d ago | {n}d ago | {n}天前 |
| Backup Success | Backup successful | 备份成功 |
| Backup Failed | Backup failed | 备份失败 |
| Backup in progress | Backing up... | 备份中... |
| Please configure remote backup in settings | Please configure remote backup in settings | 请先在设置中配置远程备份 |
