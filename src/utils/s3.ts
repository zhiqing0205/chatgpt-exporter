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

    let url: URL
    try {
        url = new URL(endpoint)
    }
    catch {
        throw new Error(`Invalid S3 endpoint URL: ${endpoint}`)
    }
    const encodedKey = objectKey.split('/').map(s => encodeURIComponent(s)).join('/')
    const path = `/${bucket}/${encodedKey}`
    const fullUrl = `${url.protocol}//${url.host}${path}`

    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const payloadHash = await sha256(data)
    const contentType = 'application/zip'

    const headers: Record<string, string> = {
        'Host': url.host,
        'Content-Type': contentType,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
    }

    const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort()
    const signedHeaders = signedHeaderKeys.join(';')
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[Object.keys(headers).find(h => h.toLowerCase() === k)!]}\n`).join('')

    const canonicalRequest = [
        'PUT',
        path,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n')

    const scope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        scope,
        await sha256Str(canonicalRequest),
    ].join('\n')

    const signingKey = await getSigningKey(secretKey, dateStamp, region, 's3')
    const signature = toHex(await hmacSha256(signingKey, stringToSign))

    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const response = await gmFetch({
        method: 'PUT',
        url: fullUrl,
        headers: {
            ...headers,
            Authorization: authorization,
        },
        data,
    })

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`S3 upload failed: ${response.status} ${response.statusText} - ${response.responseText}`)
    }
}

export async function testS3Connection(config: S3Config): Promise<{ success: boolean; message: string }> {
    const { endpoint, region, bucket, accessKey, secretKey } = config

    let url: URL
    try {
        url = new URL(endpoint)
    }
    catch {
        return { success: false, message: `Invalid endpoint URL: ${endpoint}` }
    }

    // HEAD bucket to test connectivity and auth
    const path = `/${bucket}/`
    const fullUrl = `${url.protocol}//${url.host}${path}`

    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const payloadHash = await sha256(new ArrayBuffer(0))

    const hdrs: Record<string, string> = {
        'Host': url.host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
    }

    const signedHeaderKeys = Object.keys(hdrs).map(k => k.toLowerCase()).sort()
    const signedHeaders = signedHeaderKeys.join(';')
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${hdrs[Object.keys(hdrs).find(h => h.toLowerCase() === k)!]}\n`).join('')

    const canonicalRequest = ['GET', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const scope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Str(canonicalRequest)].join('\n')
    const signingKey = await getSigningKey(secretKey, dateStamp, region, 's3')
    const signature = toHex(await hmacSha256(signingKey, stringToSign))
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    try {
        const response = await gmFetch({
            method: 'GET',
            url: fullUrl,
            headers: { ...hdrs, Authorization: authorization },
        })
        if (response.status === 200 || response.status === 301) {
            return { success: true, message: `OK (${response.status})` }
        }
        if (response.status === 403) {
            return { success: false, message: `Auth failed (403): check Access Key / Secret Key` }
        }
        if (response.status === 404) {
            return { success: false, message: `Bucket "${bucket}" not found (404)` }
        }
        return { success: false, message: `HTTP ${response.status}: ${response.responseText.slice(0, 200)}` }
    }
    catch (err) {
        return { success: false, message: err instanceof Error ? err.message : String(err) }
    }
}
