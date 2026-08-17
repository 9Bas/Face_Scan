import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'

export interface ToastState {
  id: number
  message: string
}

export function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onClose, 2600)
    return () => clearTimeout(t)
  }, [toast, onClose])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl"
          >
            <CheckCircle2 size={18} className="text-brand-400" />
            {toast.message}
            <button
              type="button"
              onClick={onClose}
              className="ml-1 text-white/60 transition-colors hover:text-white"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}