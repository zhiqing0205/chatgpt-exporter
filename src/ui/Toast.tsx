import { useCallback, useEffect, useState } from 'preact/hooks'
import type { FC } from '../type'

interface ToastItem {
    id: number
    message: string
    type: 'success' | 'error'
}

let toastId = 0

const toastListeners: Set<(toast: ToastItem) => void> = new Set()

export function showToast(message: string, type: 'success' | 'error') {
    const toast: ToastItem = { id: ++toastId, message, type }
    toastListeners.forEach(fn => fn(toast))
}

export const ToastContainer: FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([])

    useEffect(() => {
        const listener = (toast: ToastItem) => {
            setToasts(prev => [...prev, toast])
        }
        toastListeners.add(listener)
        return () => {
            toastListeners.delete(listener)
        }
    }, [])

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    if (toasts.length === 0) return null

    return (
        <div
            style={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxWidth: '360px',
            }}
        >
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        lineHeight: '1.4',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        animation: 'fadeIn 0.2s ease-out',
                        backgroundColor: toast.type === 'success' ? '#16a34a' : '#dc2626',
                    }}
                >
                    <span style={{ flex: 1, wordBreak: 'break-word' }}>{toast.message}</span>
                    <button
                        onClick={() => dismiss(toast.id)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer',
                            padding: '0 0 0 8px',
                            fontSize: '18px',
                            lineHeight: '1',
                            opacity: 0.8,
                            flexShrink: 0,
                        }}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    )
}
