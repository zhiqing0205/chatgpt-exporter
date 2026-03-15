const API_MAPPING: Record<string, string> = {
    'https://chat.openai.com': 'https://chat.openai.com/backend-api',
    'https://chatgpt.com': 'https://chatgpt.com/backend-api',
    'https://new.oaifree.com': 'https://new.oaifree.com/backend-api',
}

// export const baseUrl = 'https://chat.openai.com'
export const baseUrl = new URL(location.href).origin
export const apiUrl = API_MAPPING[baseUrl]

export const KEY_LANGUAGE = 'exporter:language'
export const KEY_FILENAME_FORMAT = 'exporter:filename_format'
// export const KEY_OFFICIAL_JSON_FORMAT = 'exporter:official_json_format'
export const KEY_TIMESTAMP_ENABLED = 'exporter:enable_timestamp'
export const KEY_TIMESTAMP_24H = 'exporter:timestamp_24h'
export const KEY_TIMESTAMP_MARKDOWN = 'exporter:timestamp_markdown'
export const KEY_TIMESTAMP_HTML = 'exporter:timestamp_html'
export const KEY_META_ENABLED = 'exporter:enable_meta'
export const KEY_META_LIST = 'exporter:meta_list'
export const KEY_EXPORT_ALL_LIMIT = 'exporter:export_all_limit'

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

export const KEY_OAI_LOCALE = 'oai/apps/locale'
export const KEY_OAI_HISTORY_DISABLED = 'oai/apps/historyDisabled'
