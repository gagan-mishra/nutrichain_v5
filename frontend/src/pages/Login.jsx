import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { useCtx } from "../state/context";

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function pickCurrentFy(fys) {
  const today = toDateStr(new Date());
  const current = (fys || []).find((f) => {
    const start = String(f?.startDate || "").slice(0, 10);
    const end = String(f?.endDate || "").slice(0, 10);
    return start && end && start <= today && today <= end;
  });
  return current || (fys || [])[0] || null;
}

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const setFirmCtx = useCtx((s) => s.setFirm);
  const setFyCtx = useCtx((s) => s.setFy);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("expired") === "1") {
      setErr("Your session has expired. Please login again.");
    }
  }, [location.search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");

    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("user", JSON.stringify(data.user));

      // reset previous selections first to avoid stale FY/Firm mismatch
      setFirmCtx(null);
      setFyCtx(null);

      // prefetch firms + fiscal years and set app context immediately
      try {
        const [firmsRes, fysRes] = await Promise.all([
          api.get("/firms"),
          api.get("/firms/fiscal-years"),
        ]);

        const firms = firmsRes.data || [];
        const fys = fysRes.data || [];

        const selectedFirm =
          (data?.user?.firmId != null
            ? firms.find((f) => String(f.id) === String(data.user.firmId))
            : null) ||
          firms[0] ||
          null;

        const selectedFy = pickCurrentFy(fys);

        setFirmCtx(selectedFirm || null);
        setFyCtx(selectedFy || null);
      } catch (prefetchErr) {
        console.warn("Could not prefetch firm/fy:", prefetchErr);
      }

      nav("/sales/order-confirm", { replace: true });
    } catch (submitErr) {
      console.error(submitErr);
      setErr("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen grid place-items-center"
      style={{ backgroundColor: "#030712" }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl p-6 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl"
      >
        <h1 className="text-xl font-semibold text-white">NutriChain - Login</h1>
        <p className="mt-1 text-white/60 text-sm">Sign in to continue</p>

        {err ? <div className="mt-3 text-sm text-red-300">{err}</div> : null}

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Username
        </label>
        <input
          className="mt-1 w-full rounded-lg px-3 py-2 text-sm bg-black/30 border border-white/10 text-white outline-none focus:ring-2 focus:ring-white/20"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-white/60">
          Password
        </label>
        <div className="mt-1 flex items-center gap-2 rounded-lg bg-black/30 border border-white/10 px-2">
          <input
            type={showPwd ? "text" : "password"}
            className="w-full px-1 py-2 text-sm bg-transparent text-white outline-none focus:ring-0"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            className="text-xs text-white/70 hover:text-white px-2 py-1 rounded"
            aria-label={showPwd ? "Hide password" : "Show password"}
          >
            {showPwd ? "Hide" : "Show"}
          </button>
        </div>

        <button
          disabled={loading}
          className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10"
        >
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
