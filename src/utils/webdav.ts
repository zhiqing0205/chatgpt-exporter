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

function joinUrl(base: string, ...parts: string[]): string {
    return parts.reduce((url, part) => {
        const cleanUrl = url.replace(/\/+$/, '')
        const cleanPart = part.replace(/^\/+/, '').replace(/\/+$/, '')
        return cleanPart ? `${cleanUrl}/${cleanPart}` : cleanUrl
    }, base)
}

function encodePathSegments(path: string): string {
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

async function ensureDirectory(config: WebDAVConfig): Promise<void> {
    if (!config.pathPrefix) return

    const dirUrl = `${joinUrl(config.url, config.pathPrefix)}/`

    try {
        const response = await gmFetch({
            method: 'MKCOL',
            url: dirUrl,
            headers: {
                Authorization: basicAuth(config.username, config.password),
            },
        })
        // 201=created, 405=not allowed (exists), 409=conflict (parent exists), 301=redirect
        if (response.status !== 201 && response.status !== 405 && response.status !== 409) {
            // eslint-disable-next-line no-console
            console.warn(`[Exporter] MKCOL returned ${response.status}, continuing anyway`)
        }
    }
    catch {
        // eslint-disable-next-line no-console
        console.warn('[Exporter] MKCOL failed, continuing with upload')
    }
}

export async function uploadToWebDAV(config: WebDAVConfig, data: ArrayBuffer, fileName: string): Promise<void> {
    await ensureDirectory(config)

    const encodedFileName = encodePathSegments(fileName)
    const uploadPath = config.pathPrefix
        ? `${config.pathPrefix.replace(/\/+$/, '')}/${encodedFileName}`
        : encodedFileName
    const uploadUrl = joinUrl(config.url, uploadPath)

    let response
    try {
        response = await gmFetch({
            method: 'PUT',
            url: uploadUrl,
            headers: {
                'Authorization': basicAuth(config.username, config.password),
                'Content-Type': 'application/zip',
            },
            data,
        })
    }
    catch (err) {
        throw new Error(`WebDAV PUT to ${uploadUrl} failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`WebDAV upload failed [${response.status}]: ${response.statusText} - ${response.responseText.slice(0, 300)}`)
    }
}

export async function testWebDAVConnection(config: WebDAVConfig): Promise<{ success: boolean; message: string }> {
    const testUrl = joinUrl(config.url, config.pathPrefix || '')
    try {
        const response = await gmFetch({
            method: 'PROPFIND',
            url: `${testUrl.replace(/\/+$/, '')}/`,
            headers: {
                Authorization: basicAuth(config.username, config.password),
                Depth: '0',
            },
        })
        if (response.status === 207 || response.status === 200) {
            return { success: true, message: `OK (${response.status})` }
        }
        if (response.status === 401 || response.status === 403) {
            return { success: false, message: `Auth failed (${response.status})` }
        }
        if (response.status === 404) {
            return { success: false, message: `Path not found (404)` }
        }
        return { success: false, message: `HTTP ${response.status}: ${response.statusText}` }
    }
    catch (err) {
        return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
}
