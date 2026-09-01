"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import ThemeToggle from "@/components/ThemeToggle";

type Mode = "login" | "signup";

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#00c8d0">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="#00c8d0">
      <path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z"/>
    </svg>
  );
}

function NameIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

/* ── Distinct feature icons for the left panel ── */
function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#00c8d0">
      <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z"/>
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c8d0" strokeWidth="2">
      <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/>
    </svg>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Signup state
  const [signupUsername, setSignupUsername] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupName, setSignupName] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Touched state for inline errors
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { login: authLogin } = useAuth();
  const router = useRouter();


  // ── Validation ──
  const isUsernameValid = (v: string) => /^[a-zA-Z0-9_]{3,20}$/.test(v.trim());
  const isNameValid = (v: string) => /^[a-zA-Z\s'-]{2,50}$/.test(v.trim());
  const isEmailValid = (v: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim());
  const isPhoneValid = (v: string) => v.replace(/\D/g, "").length === 10;

  // Password strength
  const hasMinLength = signupPassword.length >= 8;
  const hasUpper     = /[A-Z]/.test(signupPassword);
  const hasLower     = /[a-z]/.test(signupPassword);
  const hasNumber    = /\d/.test(signupPassword);
  const hasSpecial   = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(signupPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;

  const isSignupFormValid =
    isUsernameValid(signupUsername) &&
    isNameValid(signupName) &&
    isEmailValid(signupEmail) &&
    isPhoneValid(signupPhone) &&
    isPasswordValid;

  const handleBlur = (field: string) =>
    setTouched((p) => ({ ...p, [field]: true }));

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setTouched({});
  };

  /* ── Login ── */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginIdentifier.trim() || !loginPassword) {
      setError("Please enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.login({ username: loginIdentifier.trim(), password: loginPassword });
      authLogin(res.token, res.user, rememberMe);
      router.push("/chat");
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Invalid credentials or server unavailable.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  /* ── Signup ── */
  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const fieldsToTouch = [
      "username",
      "name",
      "email",
      "phone",
      "password",
    ];
    setTouched((prev) => ({ ...prev, ...Object.fromEntries(fieldsToTouch.map((field) => [field, true])) }));

    if (!isSignupFormValid) {
      setError("Please fill in all fields correctly before continuing.");
      return;
    }
    const fullPhone = `+91${signupPhone.replace(/\D/g, "")}`;
    setBusy(true);
    try {
      const res = await api.signup({
        username: signupUsername.trim(),
        password: signupPassword,
        display_name: signupName.trim(),
        email: signupEmail.trim().toLowerCase(),
        phone_number: fullPhone,
      });
      authLogin(res.token, res.user, rememberMe);
      router.push("/chat");
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : "Signup failed. Please check your details.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  /* ── Shared input classes ── */
  const inputBase =
    "w-full bg-[#1e2236] border border-[#252c44] rounded-xl pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-[#00c8d0] focus:bg-[#222840]";
  const inputErr =
    "w-full bg-[#1e2236] border border-red-500/70 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-red-400 outline-none focus:border-red-400";

  const tealBtn =
    "w-full py-3.5 rounded-xl font-bold text-sm text-[#0d1117] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed";

  /* ── Left panel feature list with distinct icons ── */
  const features = [
    { icon: <ShieldIcon />, text: "Secure rooms and direct chats" },
    { icon: <BoltIcon />, text: "Instant delivery and typing signals" },
    { icon: <ProfileIcon />, text: "Clean profile and conversation management" },
  ];

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#071827] px-4 py-8 font-sans text-white">
      <div className="fixed right-5 top-5 z-30"><ThemeToggle /></div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-[#00c8d0]/20 blur-3xl" />
        <div className="absolute bottom-[-14%] right-[-6%] h-[22rem] w-[22rem] rounded-full bg-[#8b5cf6]/15 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[820px] max-w-6xl items-center justify-center">
        <div className="grid w-full gap-6 overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.75)] backdrop-blur-xl lg:grid-cols-[1.15fr_0.85fr] lg:p-0 lg:pr-3">
          {/* ── LEFT PANEL ── */}
          <aside className="auth-brand-panel relative hidden min-h-[760px] overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#081d2d_0%,#0b2238_100%)] p-7 lg:flex lg:flex-col">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(0,200,208,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_30%)]" />
            {/* subtle dot-grid texture for depth */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />

            <div className="relative z-10">
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#00c8d0]/60 bg-[#00c8d0]/10 shadow-[0_0_24px_rgba(0,200,208,0.25)]">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="#00c8d0">
                    <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 11H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V7h10v2z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7dd3fc]">Signal Clone</p>
                  <h2 className="mt-1 text-[1.75rem] font-black leading-none text-white">Private messaging</h2>
                </div>
              </div>

              <div className="mt-10 max-w-xl">
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-[#00c8d0]">One account, every conversation</p>
                <h1 className="text-[3.65rem] font-black leading-[0.98] tracking-[-0.04em] text-white">
                  Stay close.
                  <span className="mt-1 block text-[#7dd3fc]">Stay secure.</span>
                </h1>
                <p className="mt-5 max-w-lg text-[0.98rem] leading-7 text-slate-300">
                  Sign in to pick up where you left off, or create an account in under a minute to start messaging with end-to-end privacy built in.
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-9 space-y-3">
              {features.map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur-sm">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00c8d0]/15 shadow-[0_0_16px_rgba(0,200,208,0.2)]">
                    {icon}
                  </div>
                  <span className="text-[0.95rem] font-medium text-slate-200">{text}</span>
                </div>
              ))}
            </div>

            {/* Bottom-anchored trust line fills dead space and closes the panel */}
            <div className="relative z-10 mt-auto flex items-center gap-2 pt-10 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00c8d0] shadow-[0_0_8px_rgba(0,200,208,0.6)]" />
              No spam. No ads. Just messaging.
            </div>
          </aside>

          {/* ── RIGHT PANEL ── */}
          <main className="auth-main flex items-center justify-center bg-[#101827]/90 px-3 py-4 sm:px-6 lg:px-6 lg:py-8">
            <div className="w-full max-w-md">
              <div role="tablist" aria-label="Authentication mode" className="auth-tabs mb-6 flex rounded-2xl border border-white/10 bg-[#0f172a]/80 p-1 shadow-inner shadow-black/20">
                {(["login", "signup"] as Mode[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchMode(tab)}
                    role="tab"
                    aria-selected={mode === tab}
                    aria-label={tab === "login" ? "Switch to login" : "Switch to sign up"}
                    className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold tracking-wide transition-all cursor-pointer capitalize ${
                      mode === tab
                        ? "bg-gradient-to-r from-[#00b8c8] to-[#00d4b0] text-[#08141c] shadow-[0_0_20px_rgba(0,200,208,0.35)]"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {tab === "login" ? "Login" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* Fixed-height card, contents vertically centered so login (fewer fields)
                  and signup (more fields) occupy the same overall panel height. */}
              <div className="auth-form-card flex min-h-[640px] flex-col justify-center rounded-[28px] border border-white/10 bg-[#0f172a]/80 p-5 shadow-[0_18px_40px_rgba(2,6,23,0.45)] sm:p-6">
                <div className="mb-6 flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#00c8d0]/50 bg-[#00c8d0]/10 shadow-[0_0_30px_rgba(0,200,208,0.2)]">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="#00c8d0">
                      <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-9 11H7v-2h4v2zm6 0h-4v-2h4v2zm0-4H7V7h10v2z"/>
                    </svg>
                  </div>
                </div>

                {error && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs font-semibold text-red-200">
                    <span className="shrink-0">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {mode === "login" && (
                  <form onSubmit={handleLogin} noValidate>
                    <div className="mb-7 text-center">
                      <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome back</h1>
                      <p className="mt-1 text-sm text-slate-400">Sign in to continue your conversations</p>
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Username</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><UserIcon /></span>
                        <input
                          type="text"
                          required
                          value={loginIdentifier}
                          onChange={(e) => { setLoginIdentifier(e.target.value); setError(null); }}
                          placeholder="Enter your username"
                          className={inputBase}
                        />
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Password</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><LockIcon /></span>
                        <input
                          type={showLoginPassword ? "text" : "password"}
                          required
                          value={loginPassword}
                          onChange={(e) => { setLoginPassword(e.target.value); setError(null); }}
                          placeholder="Enter your password"
                          className={`${inputBase} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00c8d0] transition cursor-pointer"
                        >
                          {showLoginPassword ? <EyeClosed /> : <EyeOpen />}
                        </button>
                      </div>
                    </div>

                    <div className="mb-6 flex items-center justify-start">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 cursor-pointer rounded accent-[#00c8d0]"
                        />
                        <span className="text-xs text-slate-400">Remember me</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className={tealBtn}
                      style={{
                        background: busy ? "#1e2236" : "linear-gradient(90deg, #00b8c8 0%, #00c8d0 50%, #00d4b0 100%)",
                        boxShadow: busy ? "none" : "0 0 24px rgba(0,200,208,0.3)",
                      }}
                    >
                      {busy ? "Signing in..." : "Sign In"}
                    </button>

                    <p className="mt-6 text-center text-xs text-slate-400">
                      Don&apos;t have an account?{" "}
                      <button type="button" onClick={() => switchMode("signup")} className="font-bold text-[#00c8d0] hover:text-[#33d6dd] transition cursor-pointer">
                        Sign up
                      </button>
                    </p>
                  </form>
                )}

                {mode === "signup" && (
                  <form onSubmit={handleSignup} noValidate>
                    <div className="mb-6 text-center">
                      <h1 className="text-3xl font-extrabold tracking-tight text-white">Create account</h1>
                      <p className="mt-1 text-sm text-slate-400">Start your secure messaging journey</p>
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Username</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><UserIcon /></span>
                        <input
                          type="text"
                          required
                          value={signupUsername}
                          onBlur={() => handleBlur("username")}
                          onChange={(e) => { setSignupUsername(e.target.value); setError(null); }}
                          placeholder={
                            touched.username && signupUsername && !isUsernameValid(signupUsername)
                              ? "Invalid! 3–20 chars, letters/numbers/_ only"
                              : "Choose a username"
                          }
                          className={
                            touched.username && signupUsername && !isUsernameValid(signupUsername)
                              ? inputErr
                              : inputBase
                          }
                        />
                      </div>
                      {touched.username && signupUsername && !isUsernameValid(signupUsername) && (
                        <p className="ml-1 mt-1 text-[11px] font-semibold text-red-400">3–20 characters; letters, numbers, and _ only.</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Full Name</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><NameIcon /></span>
                        <input
                          type="text"
                          required
                          value={signupName}
                          onBlur={() => handleBlur("name")}
                          onChange={(e) => { setSignupName(e.target.value); setError(null); }}
                          placeholder="Enter your full name"
                          className={
                            touched.name && signupName && !isNameValid(signupName)
                              ? inputErr
                              : inputBase
                          }
                        />
                      </div>
                      {touched.name && signupName && !isNameValid(signupName) && (
                        <p className="ml-1 mt-1 text-[11px] font-semibold text-red-400">2–50 characters; letters, spaces, hyphens, apostrophes.</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Email</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><MailIcon /></span>
                        <input
                          type="email"
                          required
                          value={signupEmail}
                          onBlur={() => handleBlur("email")}
                          onChange={(e) => { setSignupEmail(e.target.value); setError(null); }}
                          placeholder="Enter your email"
                          className={
                            touched.email && signupEmail && !isEmailValid(signupEmail)
                              ? inputErr
                              : inputBase
                          }
                        />
                      </div>
                      {touched.email && signupEmail && !isEmailValid(signupEmail) && (
                        <p className="ml-1 mt-1 text-[11px] font-semibold text-red-400">Please enter a valid email address.</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Phone Number</label>
                      <div className="flex">
                        <div className="flex shrink-0 items-center rounded-l-xl border border-r-0 border-[#252c44] bg-[#1e2236] px-3 text-sm font-semibold text-slate-300">
                          🇮🇳 +91
                        </div>
                        <input
                          type="tel"
                          required
                          value={signupPhone}
                          onBlur={() => handleBlur("phone")}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setSignupPhone(v);
                            setError(null);
                          }}
                          placeholder="9876543210"
                          maxLength={10}
                          className={`flex-1 rounded-r-xl border border-[#252c44] bg-[#1e2236] px-4 py-3 text-sm text-gray-100 placeholder-gray-500 outline-none transition focus:border-[#00c8d0] focus:bg-[#222840] ${
                            touched.phone && signupPhone && !isPhoneValid(signupPhone) ? "border-red-500/70" : ""
                          }`}
                        />
                      </div>
                      {touched.phone && signupPhone && !isPhoneValid(signupPhone) && (
                        <p className="ml-1 mt-1 text-[11px] font-semibold text-red-400">Must be exactly 10 digits.</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Password</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2"><LockIcon /></span>
                        <input
                          type={showSignupPassword ? "text" : "password"}
                          required
                          value={signupPassword}
                          onBlur={() => handleBlur("password")}
                          onChange={(e) => { setSignupPassword(e.target.value); setError(null); }}
                          placeholder="Create a password"
                          className={`${inputBase} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00c8d0] transition cursor-pointer"
                        >
                          {showSignupPassword ? <EyeClosed /> : <EyeOpen />}
                        </button>
                      </div>
                      {signupPassword.length > 0 && (
                        <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                          {[
                            [hasMinLength, "8+ characters"],
                            [hasUpper, "Uppercase letter"],
                            [hasLower, "Lowercase letter"],
                            [hasNumber, "Number"],
                          ].map(([ok, label]) => (
                            <span key={label as string} className={ok ? "font-semibold text-[#00c8d0]" : "text-slate-500"}>
                              {ok ? "✓" : "○"} {label as string}
                            </span>
                          ))}
                          <span className={`col-span-2 ${hasSpecial ? "font-semibold text-[#00c8d0]" : "text-slate-500"}`}>
                            {hasSpecial ? "✓" : "○"} Special character (!@#$%)
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={busy}
                      className={tealBtn}
                      style={{
                        background: busy ? "#1e2236" : "linear-gradient(90deg, #00b8c8 0%, #00c8d0 50%, #00d4b0 100%)",
                        boxShadow: busy ? "none" : "0 0 24px rgba(0,200,208,0.3)",
                        color: busy ? "#4a5580" : "#0d1117",
                      }}
                    >
                      {busy ? "Creating account..." : "Sign Up"}
                    </button>

                    <p className="mt-5 text-center text-xs text-slate-400">
                      Already have an account?{" "}
                      <button type="button" onClick={() => switchMode("login")} className="font-bold text-[#00c8d0] hover:text-[#33d6dd] transition cursor-pointer">
                        Sign in
                      </button>
                    </p>
                  </form>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}