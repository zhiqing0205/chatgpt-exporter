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
            url: `${dirUrl.replace(/\/+$/, '')}/`,
            headers: {
                Authorization: basicAuth(config.username, config.password),
            },
        })
        if (response.status !== 201 && response.status !== 405 && response.status !== 409) {
            console.warn(`[Exporter] MKCOL returned ${response.status}, continuing anyway`)
        }
    }
    catch {
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
