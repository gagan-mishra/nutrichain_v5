import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Layers,
  Users,
  Building2,
  Package,
  FileText,
  ReceiptText,
  Banknote,
  BarChart3,
  ClipboardList,
  PieChart,
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { glass } from "./primitives";
import ChangePasswordDialog from "./change-password-dialog";
import { FirmPill, FyPill, CalendarBadge } from "./pickers";

/* ------------ Collapsible section in the sidebar ------------ */
const Section = ({ label, icon: Icon, items, isOpen, onToggle, activeKey, onSelect }) => (
  <div className="w-full">
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5"
    >
      <span className="flex items-center gap-2">
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </span>
      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
    </button>

    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.ul
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden pl-2"
        >
          {items.map((it) => {
            const active = activeKey === it.key;
            return (
              <li key={it.key}>
                <button
                  onClick={() => onSelect(it)}
                  className={`group mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div
                    className={`h-1.5 w-1.5 rounded-full transition-all ${
                      active ? "bg-white" : "bg-white/40 group-hover:bg-white/70"
                    }`}
                  />
                  {it.icon}
                  <span>{it.label}</span>
                </button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </AnimatePresence>
  </div>
);

/* ------------ Main shell ------------ */
export function AppShell({
  firm,
  fy,
  firms,
  fys,
  setFirm,
  setFy,
  activeKey: _activeKeyProp,   // optional legacy prop; we now derive from URL
  setActiveKey: _setActiveKey, // optional legacy prop
  children,
}) {
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  // Define sections with paths for navigation
  const sections = useMemo(
    () => [
      {
        id: "master",
        label: "Master",
        icon: Users,
        items: [
          { key: "party-registration",   label: "Party Registration",   path: "/master/party-registration",   icon: <Users size={16} /> },
          { key: "company-registration", label: "Company Registration", path: "/master/company-registration", icon: <Building2 size={16} /> },
          { key: "product-registration", label: "Product Registration", path: "/master/product-registration", icon: <Package size={16} /> },
        ],
      },
      {
        id: "sales",
        label: "Sales",
        icon: FileText,
        items: [
          { key: "order-confirm", label: "Order Confirm", path: "/sales/order-confirm", icon: <ClipboardList size={16} /> },
          { key: "party-bill",    label: "Party Bill",    path: "/sales/party-bill",    icon: <ReceiptText size={16} /> },
          { key: "bill-receive",  label: "Bill Receive",  path: "/sales/bill-receive",  icon: <Banknote size={16} /> },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        icon: BarChart3,
        items: [
          { key: "party-reports",     label: "Party Reports",     path: "/reports/party",      icon: <PieChart size={16} /> },
          { key: "sales-report",      label: "Sales Report",      path: "/reports/sales",      icon: <FileText size={16} /> },
          { key: "product-report",    label: "Product Report",    path: "/reports/product",    icon: <Package size={16} /> },
          { key: "transaction-report",label: "Transaction Report",path: "/reports/transaction",icon: <ArrowRightLeft size={16} /> },
        ],
      },
      {
        id: "analytics",
        label: (<span className="inline-flex items-center gap-2">Analytics <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-300">BETA</span></span>),
        icon: TrendingUp,
        items: [
          { key: "analytics-home", label: "Overview", path: "/analytics", icon: <BarChart3 size={16} /> },
          { key: "aging", label: "Aging", path: "/analytics/aging", icon: <FileText size={16} /> },
          { key: "payment-behavior", label: "Payment Behavior", path: "/analytics/payment-behavior", icon: <FileText size={16} /> },
          { key: "brokerage", label: "Brokerage", path: "/analytics/brokerage", icon: <FileText size={16} /> },
          { key: "top", label: "Top Parties/Products", path: "/analytics/top", icon: <FileText size={16} /> },
          { key: "cohorts", label: "Cohorts", path: "/analytics/cohorts", icon: <FileText size={16} /> },
          { key: "anomaly", label: "Anomaly Watch", path: "/analytics/anomaly", icon: <FileText size={16} /> },
        ],
      },
    ],
    []
  );

  // Flatten items to derive active key from the current pathname
  const allItems = useMemo(() => sections.flatMap((s) => s.items.map((it) => ({ ...it, sectionId: s.id }))), [sections]);

  const activeKey = useMemo(() => {
    // Prefer the longest matching path (so /analytics/aging beats /analytics)
    const matches = allItems.filter((it) => location.pathname.startsWith(it.path));
    const found = matches.sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0))[0];
    return found?.key ?? _activeKeyProp ?? "order-confirm";
  }, [allItems, location.pathname, _activeKeyProp]);

  // Keep the correct section open for the active route
  const [open, setOpen] = useState(() => {
    const found = allItems.find((it) => location.pathname.startsWith(it.path));
    return found?.sectionId || "master";
  });
  useEffect(() => {
    const found = allItems.find((it) => location.pathname.startsWith(it.path));
    if (found?.sectionId) setOpen(found.sectionId);
  }, [allItems, location.pathname]);

  const onSelect = (it) => {
    // optional legacy state
    _setActiveKey?.(it.key);
    // navigate to route
    if (it.path) nav(it.path);
    setMobileOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#030712" }}>
      {/* Sidebar (sticky) */}
      <aside className={`relative hidden w-72 shrink-0 flex-col p-3 text-white md:flex ${glass} md:sticky md:top-0 md:h-screen md:overflow-y-auto`}>
        <div className={`mb-3 rounded-2xl p-4 ${glass}`}>
          <div className="mb-1 text-xs uppercase tracking-wider text-white/50">Context</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers size={16} className="opacity-80" />
              <span className="text-sm font-medium truncate">{firm?.name || "Select Firm"}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3 text-white/80">
            <CalendarBadge fy={fy} />
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {sections.map((s) => (
            <Section
              key={s.id}
              label={s.label}
              icon={s.icon}
              items={s.items}
              isOpen={open === s.id}
              onToggle={() => setOpen(open === s.id ? "" : s.id)}
              activeKey={activeKey}
              onSelect={onSelect}
            />
          ))}
        </nav>

        <div className={`mt-3 rounded-2xl p-3 text-xs text-white/70 ${glass}`}>
          Tip: Switch firm/FY from the header. Lists & forms auto-scope to that context.
        </div>
      </aside>

      {/* Main area */}
      <div id="app-content" className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Top bar */}
        <div
          className={`sticky top-0 z-30 flex items-center justify-between px-4 py-3 ${glass}`}
          style={{ background: "linear-gradient(180deg, rgba(3,7,18,0.85), rgba(3,7,18,0.65))" }}
        >
          <div className="flex items-center gap-3 text-white">
            {/* Mobile menu toggle */}
            <button
              type="button"
              aria-label="Open menu"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5"
              onClick={() => setMobileOpen(true)}
            >
              <ChevronRight size={18} className="rotate-180" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Layers size={18} />
            </div>
            <div>
              <div className="text-xs text-white/60">Workspace</div>
              <div className="text-base font-semibold tracking-wide">NutriChain</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-white">
            {/* Hide pickers on mobile to reduce congestion; available in drawer */}
            <div className="hidden md:flex items-center gap-3">
              <FirmPill firm={firm} firms={firms} onPick={setFirm} />
              <FyPill fy={fy} fys={fys} onPick={setFy} />
            </div>

            <div className="hidden md:flex items-center gap-3">
              <div className="h-8 w-px bg-white/10" />
              <div className="rounded-lg bg-white/5 px-2 py-1 text-sm text-white">@username</div>

              {/* Change password */}
              <button
                onClick={() => setShowChangePwd(true)}
                className="rounded-lg px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/10"
                title="Change Password"
              >
                Change Password
              </button>

              {/* Logout button */}
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("firmId");
                  localStorage.removeItem("fyId");
                  nav("/login", { replace: true });
                }}
                className="rounded-lg px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 border border-white/10"
                title="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Page header */}
        <div className={`flex items-center justify-between gap-3 px-5 py-4 text-white ${glass}`}>
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">Active</div>
            <h1 className="text-lg font-semibold">{labelFromKey(activeKey)}</h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className={`rounded-lg px-2 py-1 text-xs text-white/70 ${glass}`}>
              Firm: <strong className="ml-1 text-white">{firm?.name || "—"}</strong>
            </span>
            <span className={`rounded-lg px-2 py-1 text-xs text-white/70 ${glass}`}>
              FY: <strong className="ml-1 text-white">{fy?.label || "—"}</strong>
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[60vh] flex-1 p-6 pb-40 pb-[env(safe-area-inset-bottom)]">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            {children}
          </motion.div>
        </div>
      </div>
      
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <div className={`absolute left-0 top-0 h-full w-72 p-3 text-white ${glass} overflow-y-auto`}
               style={{ backgroundColor: "rgba(17,24,39,0.85)" }}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="opacity-80" />
                <span className="text-sm font-medium">{firm?.name || "Select Firm"}</span>
              </div>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 border border-white/10"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className={`mb-3 rounded-2xl p-4 ${glass}`}>
              <div className="mb-2 text-xs uppercase tracking-wider text-white/50">Context</div>
              <div className="flex flex-col gap-2">
                <FirmPill firm={firm} firms={firms || []} onPick={setFirm} />
                <FyPill fy={fy} fys={fys || []} onPick={setFy} />
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <Section
                  key={s.id}
                  label={s.label}
                  icon={s.icon}
                  items={s.items}
                  isOpen={open === s.id}
                  onToggle={() => setOpen(open === s.id ? "" : s.id)}
                  activeKey={activeKey}
                  onSelect={onSelect}
                />
              ))}
            </nav>

            <div className={`mt-3 rounded-2xl p-3 text-xs text-white/70 ${glass}`}>
              Tip: Switch firm/FY from the header.
            </div>
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { setMobileOpen(false); setShowChangePwd(true); }}
                className="w-full rounded-xl px-3 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/10"
              >
                Change Password
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem("token");
                  localStorage.removeItem("firmId");
                  localStorage.removeItem("fyId");
                  setMobileOpen(false);
                  nav("/login", { replace: true });
                }}
                className="w-full rounded-xl px-3 py-2 text-sm bg-white/10 hover:bg-white/20 border border-white/10"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      <ChangePasswordDialog open={showChangePwd} onClose={() => setShowChangePwd(false)} />
    </div>
  );
}

/* ------------ helper ------------ */
function labelFromKey(key) {
  const map = {
    "party-registration": "Party Registration",
    "company-registration": "Company Registration",
    "product-registration": "Product Registration",
    "order-confirm": "Order Confirm",
    "party-bill": "Party Bill",
    "bill-receive": "Bill Receive",
    "party-reports": "Party Reports",
    "sales-report": "Sales Report",
    "product-report": "Product Report",
    "transaction-report": "Transaction Report",
    "analytics-home": "Analytics",
    "aging": "Aging",
    "payment-behavior": "Payment Behavior",
    "brokerage": "Brokerage",
    "top": "Top Parties/Products",
    "cohorts": "Cohorts",
    "anomaly": "Anomaly Watch",
  };
  return map[key] || key;
}
