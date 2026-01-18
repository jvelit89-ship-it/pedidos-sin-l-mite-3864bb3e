import { motion, AnimatePresence } from 'framer-motion';
import { Bell } from 'lucide-react';

interface NewOrderBadgeProps {
  count: number;
}

export function NewOrderBadge({ count }: NewOrderBadgeProps) {
  if (count === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        className="relative inline-flex"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
          }}
          transition={{ 
            duration: 0.5, 
            repeat: Infinity, 
            repeatDelay: 2 
          }}
          className="p-2 rounded-full bg-[hsl(var(--status-pending-bg))]"
        >
          <Bell className="w-5 h-5 text-[hsl(var(--status-pending))]" />
        </motion.div>
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-xs font-bold text-white bg-destructive rounded-full"
        >
          {count > 9 ? '9+' : count}
        </motion.span>
      </motion.div>
    </AnimatePresence>
  );
}
