import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";




export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

    

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.token);

      // 🔑 fetch firms + fiscal years so the first page has context
      try {
        const [firmsRes, fysRes] = await Promise.all([
          api.get("/firms"),
          api.get("/firms/fiscal-years"),
        ]);
        const firms = firmsRes.data || [];
        const fys = fysRes.data || [];
        if (firms[0]) localStorage.setItem("firmId", String(firms[0].id));
        if (fys[0])   localStorage.setItem("fyId",   String(fys[0].id));
      } catch (err) {
        console.warn("Could not prefetch firm/fy:", err);
      }

      // now go to dashboard / order confirm
      nav("/sales/order-confirm", { replace: true });
    } catch (err) {
      console.error(err);
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
        <h1 className="text-xl font-semibold text-white">NutriChain — Login</h1>
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
          {loading ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
