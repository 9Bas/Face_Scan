import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu as MenuIcon } from 'lucide-react'
import Menu from './Menu'

const navItems = [
  { to: '/', label: 'หน้าแรก', end: true },
  { to: '/gallery', label: 'แกลเลอรี่' },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-300/60 bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 shadow-md shadow-brand-900/10">
        {/* Full-bleed row — flush to screen edges on every breakpoint */}
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
          {/* Left: Navigation (flush to left edge) */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'relative overflow-hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:px-4',
                    isActive
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-white/90 hover:bg-white/15 hover:text-white',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-bg"
                        className="absolute inset-0 -z-10 rounded-lg bg-white"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Right: Menu toggle (flush to right edge) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-white transition-colors hover:bg-white/15 hover:text-white"
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </div>
      </header>

      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}