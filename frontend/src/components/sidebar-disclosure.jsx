import { AnimatePresence, motion } from "framer-motion";

export default function SidebarDisclosure({ open, id, duration, children }) {
  return (
    <div id={id} inert={!open}>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
