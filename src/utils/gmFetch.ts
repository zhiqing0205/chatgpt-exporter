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
