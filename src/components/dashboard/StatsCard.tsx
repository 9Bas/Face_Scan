import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1] as const

interface StatsCardProps {
  icon: ReactNode
  label: string
  value: number | string
  hint?: string
  delay?: number
}

export default function StatsCard({
  icon,
  label,
  value,
  hint,
  delay = 0,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <span className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-600">
          {icon}
        </span>
        {hint && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {hint}
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-sm text-slate-500">{label}</p>
    </motion.div>
  )
}