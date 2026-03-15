import { createContext, useContext } from 'preact/compat'
import { useCallback } from 'preact/hooks'
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
import { useGMStorage } from '../hooks/useGMStorage'
import type { FC } from 'preact/compat'

const defaultFormat = 'ChatGPT-{title}'
const defaultExportAllLimit = 1000

export interface ExportMeta {
    name: string
    value: string
}

const defaultExportMetaList: ExportMeta[] = [
    { name: 'title', value: '{title}' },
    { name: 'source', value: '{source}' },
]

const SettingContext = createContext({
    format: defaultFormat,
    setFormat: (_: string) => {},

    enableTimestamp: false,
    setEnableTimestamp: (_: boolean) => {},
    timeStamp24H: false,
    setTimeStamp24H: (_: boolean) => {},
    enableTimestampHTML: false,
    setEnableTimestampHTML: (_: boolean) => {},
    enableTimestampMarkdown: false,
    setEnableTimestampMarkdown: (_: boolean) => {},

    enableMeta: false,
    setEnableMeta: (_: boolean) => {},
    exportMetaList: defaultExportMetaList,
    setExportMetaList: (_: ExportMeta[]) => {},
    exportAllLimit: defaultExportAllLimit,
    setExportAllLimit: (_: number) => {},
    resetDefault: () => {},

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
})

export const SettingProvider: FC = ({ children }) => {
    const [format, setFormat] = useGMStorage(KEY_FILENAME_FORMAT, defaultFormat)

    const [enableTimestamp, setEnableTimestamp] = useGMStorage(KEY_TIMESTAMP_ENABLED, false)
    const [timeStamp24H, setTimeStamp24H] = useGMStorage(KEY_TIMESTAMP_24H, false)
    const [enableTimestampHTML, setEnableTimestampHTML] = useGMStorage(KEY_TIMESTAMP_HTML, false)
    const [enableTimestampMarkdown, setEnableTimestampMarkdown] = useGMStorage(KEY_TIMESTAMP_MARKDOWN, false)

    const [enableMeta, setEnableMeta] = useGMStorage(KEY_META_ENABLED, false)

    const [exportMetaList, setExportMetaList] = useGMStorage(KEY_META_LIST, defaultExportMetaList)
    const [exportAllLimit, setExportAllLimit] = useGMStorage(KEY_EXPORT_ALL_LIMIT, defaultExportAllLimit)

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

    const resetDefault = useCallback(() => {
        setFormat(defaultFormat)
        setEnableTimestamp(false)
        setEnableMeta(false)
        setExportMetaList(defaultExportMetaList)
        setExportAllLimit(defaultExportAllLimit)
    }, [
        setFormat,
        setEnableTimestamp,
        setEnableMeta,
        setExportMetaList,
        setExportAllLimit,
    ])

    return (
        <SettingContext.Provider
            value={{
                format,
                setFormat,

                enableTimestamp,
                setEnableTimestamp,
                timeStamp24H,
                setTimeStamp24H,
                enableTimestampHTML,
                setEnableTimestampHTML,
                enableTimestampMarkdown,
                setEnableTimestampMarkdown,

                enableMeta,
                setEnableMeta,
                exportMetaList,
                setExportMetaList,

                exportAllLimit,
                setExportAllLimit,

                resetDefault,

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
            }}
        >
            {children}
        </SettingContext.Provider>
    )
}

export const useSettingContext = () => useContext(SettingContext)
