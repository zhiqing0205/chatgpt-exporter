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
    const path = `/${bucket}/${objectKey}`
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
