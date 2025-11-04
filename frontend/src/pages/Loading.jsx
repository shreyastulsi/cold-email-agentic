import { motion } from 'framer-motion'
import { Logo } from '../components/logo'
import { LoaderOne } from '../components/ui/loader'

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray to-gray flex items-center justify-center px-4">
      <div className="flex flex-col items-center justify-center gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-4"
        >
          <Logo />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <LoaderOne />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-gray-300 text-sm font-medium"
        >
          Loading...
        </motion.p>
      </div>
    </div>
  )
}

