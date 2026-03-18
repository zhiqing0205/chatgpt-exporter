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
    finalUrl: string
}

export function gmFetch(options: GmFetchOptions): Promise<GmFetchResponse> {
    return new Promise((resolve, reject) => {
        // eslint-disable-next-line no-console
        console.log(`[Exporter] gmFetch ${options.method} ${options.url}`)
        try {
            GM_xmlhttpRequest({
                method: options.method as any,
                url: options.url,
                headers: options.headers,
                data: options.data as any,
                responseType: 'text',
                onload: (response) => {
                    // eslint-disable-next-line no-console
                    console.log(`[Exporter] gmFetch response: ${response.status} ${response.statusText} from ${response.finalUrl || options.url}`)
                    resolve({
                        status: response.status,
                        statusText: response.statusText,
                        responseText: response.responseText,
                        finalUrl: response.finalUrl || options.url,
                    })
                },
                onerror: (error) => {
                    const detail = [
                        `method=${options.method}`,
                        `url=${options.url}`,
                        `status=${(error as any).status ?? 'N/A'}`,
                        `statusText=${(error as any).statusText || 'N/A'}`,
                        `finalUrl=${(error as any).finalUrl || 'N/A'}`,
                        `responseText=${((error as any).responseText || '').slice(0, 200)}`,
                    ].join(', ')
                    console.error(`[Exporter] gmFetch onerror: ${detail}`)
                    reject(new Error(`Network error [${options.method} ${new URL(options.url).host}]: ${(error as any).statusText || (error as any).responseText || 'Connection failed. Check if the URL is correct and accessible.'}`.trim()))
                },
                ontimeout: () => {
                    console.error(`[Exporter] gmFetch timeout: ${options.method} ${options.url}`)
                    reject(new Error(`Request timed out [${options.method} ${new URL(options.url).host}]`))
                },
            })
        }
        catch (err) {
            // GM_xmlhttpRequest itself threw (e.g. not available)
            console.error('[Exporter] GM_xmlhttpRequest threw:', err)
            reject(new Error(`GM_xmlhttpRequest unavailable: ${err instanceof Error ? err.message : String(err)}`))
        }
    })
}
