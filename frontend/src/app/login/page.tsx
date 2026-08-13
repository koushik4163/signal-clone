"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = "identifier" | "otp";

interface Country {
  name: string;
  code: string;
  flag: string;
}

const DEFAULT_COUNTRY: Country = { name: "United States", code: "+1", flag: "🇺🇸" };

const COUNTRIES: Country[] = [
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "+49", flag: "🇩🇪" },
  { name: "France", code: "+33", flag: "🇫🇷" },
  { name: "Japan", code: "+81", flag: "🇯🇵" },
  { name: "Singapore", code: "+65", flag: "🇸🇬" },
  { name: "UAE", code: "+971", flag: "🇦🇪" },
  { name: "Brazil", code: "+55", flag: "🇧🇷" },
  { name: "Argentina", code: "+54", flag: "🇦🇷" },
  { name: "Austria", code: "+43", flag: "🇦🇹" },
  { name: "Belgium", code: "+32", flag: "🇧🇪" },
  { name: "Chile", code: "+56", flag: "🇨🇱" },
  { name: "China", code: "+86", flag: "🇨🇳" },
  { name: "Colombia", code: "+57", flag: "🇨🇴" },
  { name: "Denmark", code: "+45", flag: "🇩🇰" },
  { name: "Egypt", code: "+20", flag: "🇪🇬" },
  { name: "Finland", code: "+358", flag: "🇫🇮" },
  { name: "Greece", code: "+30", flag: "🇬🇷" },
  { name: "Hong Kong", code: "+852", flag: "🇭🇰" },
  { name: "Indonesia", code: "+62", flag: "🇮🇩" },
  { name: "Ireland", code: "+353", flag: "🇮🇪" },
  { name: "Italy", code: "+39", flag: "🇮🇹" },
  { name: "Malaysia", code: "+60", flag: "🇲🇾" },
  { name: "Mexico", code: "+52", flag: "🇲🇽" },
  { name: "Netherlands", code: "+31", flag: "🇳🇱" },
  { name: "New Zealand", code: "+64", flag: "🇳🇿" },
  { name: "Norway", code: "+47", flag: "🇳🇴" },
  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "Philippines", code: "+63", flag: "🇵🇭" },
  { name: "Poland", code: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "+351", flag: "🇵🇹" },
  { name: "South Africa", code: "+27", flag: "🇿🇦" },
  { name: "South Korea", code: "+82", flag: "🇰🇷" },
  { name: "Spain", code: "+34", flag: "🇪🇸" },
  { name: "Sweden", code: "+46", flag: "🇸🇪" },
  { name: "Switzerland", code: "+41", flag: "🇨🇭" },
  { name: "Thailand", code: "+66", flag: "🇹🇭" },
  { name: "Turkey", code: "+90", flag: "🇹🇷" },
  { name: "Ukraine", code: "+380", flag: "🇺🇦" },
  { name: "Vietnam", code: "+84", flag: "🇻🇳" },
  { name: "Israel", code: "+972", flag: "🇮🇱" },
  { name: "Saudi Arabia", code: "+966", flag: "🇸🇦" },
  { name: "Qatar", code: "+974", flag: "🇶🇦" },
  { name: "Kuwait", code: "+965", flag: "🇰🇼" },
  { name: "Bahrain", code: "+973", flag: "🇧🇭" },
  { name: "Oman", code: "+968", flag: "🇴🇲" },
  { name: "Jordan", code: "+962", flag: "🇯🇴" },
  { name: "Iraq", code: "+964", flag: "🇮🇶" },
  { name: "Iran", code: "+98", flag: "🇮🇷" },
  { name: "Nepal", code: "+977", flag: "🇳🇵" },
  { name: "Bangladesh", code: "+880", flag: "🇧🇩" },
  { name: "Sri Lanka", code: "+94", flag: "🇱🇰" },
  { name: "Myanmar", code: "+95", flag: "🇲🇲" },
  { name: "Cambodia", code: "+855", flag: "🇰🇭" },
  { name: "Laos", code: "+856", flag: "🇱🇦" },
  { name: "Mongolia", code: "+976", flag: "🇲🇳" },
  { name: "Kazakhstan", code: "+7", flag: "🇰🇿" },
  { name: "Uzbekistan", code: "+998", flag: "🇺🇿" },
  { name: "Azerbaijan", code: "+994", flag: "🇦🇿" },
  { name: "Georgia", code: "+995", flag: "🇬🇪" },
  { name: "Armenia", code: "+374", flag: "🇦🇲" },
  { name: "Belarus", code: "+375", flag: "🇧🇾" },
  { name: "Romania", code: "+40", flag: "🇷🇴" },
  { name: "Czech Republic", code: "+420", flag: "🇨🇿" },
  { name: "Slovakia", code: "+421", flag: "🇸🇰" },
  { name: "Hungary", code: "+36", flag: "🇭🇺" },
  { name: "Croatia", code: "+385", flag: "🇭🇷" },
  { name: "Serbia", code: "+381", flag: "🇷🇸" },
  { name: "Slovenia", code: "+386", flag: "🇸🇮" },
  { name: "Bosnia and Herzegovina", code: "+387", flag: "🇧🇦" },
  { name: "Bulgaria", code: "+359", flag: "🇧🇬" },
  { name: "Albania", code: "+355", flag: "🇦🇱" },
  { name: "North Macedonia", code: "+389", flag: "🇲🇰" },
  { name: "Malta", code: "+356", flag: "🇲🇹" },
  { name: "Cyprus", code: "+357", flag: "🇨🇾" },
  { name: "Iceland", code: "+354", flag: "🇮🇸" },
  { name: "Peru", code: "+51", flag: "🇵🇪" },
  { name: "Uruguay", code: "+598", flag: "🇺🇾" },
  { name: "Paraguay", code: "+595", flag: "🇵🇾" },
  { name: "Ecuador", code: "+593", flag: "🇪🇨" },
  { name: "Bolivia", code: "+591", flag: "🇧🇴" },
  { name: "Venezuela", code: "+58", flag: "🇻🇪" },
  { name: "Costa Rica", code: "+506", flag: "🇨🇷" },
  { name: "Guatemala", code: "+502", flag: "🇬🇹" },
  { name: "Honduras", code: "+504", flag: "🇭🇳" },
  { name: "Panama", code: "+507", flag: "🇵🇦" },
  { name: "El Salvador", code: "+503", flag: "🇸🇻" },
  { name: "Nicaragua", code: "+505", flag: "🇳🇮" },
  { name: "Cuba", code: "+53", flag: "🇨🇺" },
  { name: "Dominican Republic", code: "+1", flag: "🇩🇴" },
  { name: "Puerto Rico", code: "+1", flag: "🇵🇷" },
  { name: "Jamaica", code: "+1", flag: "🇯🇲" },
  { name: "Trinidad and Tobago", code: "+1", flag: "🇹🇹" },
  { name: "Mauritius", code: "+230", flag: "🇲🇺" },
  { name: "Morocco", code: "+212", flag: "🇲🇦" },
  { name: "Tunisia", code: "+216", flag: "🇹🇳" },
  { name: "Nigeria", code: "+234", flag: "🇳🇬" },
  { name: "Kenya", code: "+254", flag: "🇰🇪" },
  { name: "Ghana", code: "+233", flag: "🇬🇭" },
  { name: "Uganda", code: "+256", flag: "🇺🇬" },
  { name: "Tanzania", code: "+255", flag: "🇹🇿" },
  { name: "Ethiopia", code: "+251", flag: "🇪🇹" },
  { name: "Senegal", code: "+221", flag: "🇸🇳" },
  { name: "Algeria", code: "+213", flag: "🇩🇿" },
  { name: "Angola", code: "+244", flag: "🇦🇴" },
  { name: "Zimbabwe", code: "+263", flag: "🇿🇼" },
  { name: "Botswana", code: "+267", flag: "🇧🇼" },
  { name: "Mozambique", code: "+258", flag: "🇲🇿" },
  { name: "Gabon", code: "+241", flag: "🇬🇦" },
  { name: "Cameroon", code: "+237", flag: "🇨🇲" },
  { name: "Ivory Coast", code: "+225", flag: "🇨🇮" },
  { name: "Madagascar", code: "+261", flag: "🇲🇬" },
  { name: "Zambia", code: "+260", flag: "🇿🇲" },
  { name: "Namibia", code: "+264", flag: "🇳🇦" },
  { name: "Lesotho", code: "+266", flag: "🇱🇸" },
  { name: "Rwanda", code: "+250", flag: "🇷🇼" },
  { name: "Burkina Faso", code: "+226", flag: "🇧🇫" },
  { name: "Mali", code: "+223", flag: "🇲🇱" },
  { name: "Guinea", code: "+224", flag: "🇬🇳" },
  { name: "Benin", code: "+229", flag: "🇧🇯" },
  { name: "Togo", code: "+228", flag: "🇹🇬" },
  { name: "Liberia", code: "+231", flag: "🇱🇷" },
  { name: "Sierra Leone", code: "+232", flag: "🇸🇱" },
  { name: "Congo", code: "+242", flag: "🇨🇬" },
  { name: "Democratic Republic of Congo", code: "+243", flag: "🇨🇩" },
  { name: "Sudan", code: "+249", flag: "🇸🇩" },
  { name: "Libya", code: "+218", flag: "🇱🇾" },
  { name: "Yemen", code: "+967", flag: "🇾🇪" },
  { name: "Palestine", code: "+970", flag: "🇵🇸" },
  { name: "Afghanistan", code: "+93", flag: "🇦🇫" },
  { name: "Tajikistan", code: "+992", flag: "🇹🇯" },
  { name: "Kyrgyzstan", code: "+996", flag: "🇰🇬" },
  { name: "Turkmenistan", code: "+993", flag: "🇹🇲" },
];



export default function LoginPage() {
  const [step, setStep] = useState<Step>("identifier");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [mockedOtp, setMockedOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  function getFullPhoneNumber(inputPhone: string = identifier): string {
    const rawInput = inputPhone.trim();
    if (!rawInput) return "";
    if (rawInput.startsWith("+")) return rawInput;
    return `${country.code} ${rawInput}`;
  }

  async function handleSendOtp(overridePhone?: string, e?: FormEvent) {
    if (e) e.preventDefault();
    setError(null);

    const targetPhone = overridePhone || getFullPhoneNumber();
    if (!targetPhone) {
      setError("Please enter your phone number");
      return;
    }

    const cleanPhone = targetPhone.replace(/[\s\-\(\)]/g, "");
    if (!/^\+?[0-9]{4,15}$/.test(cleanPhone)) {
      setError("Please enter a valid phone number ");
      return;
    }

    setIsNewUser(false);
    setAvatarFile(null);
    setBusy(true);
    try {
      const res = await api.sendOtp(targetPhone);
      setMockedOtp(res.mocked_otp);
      setIsNewUser(res.is_new_user);
      setIdentifier(targetPhone);
      setStep("otp");
    } catch (err: any) {
      setError(err?.message || "Failed to send verification code");
    } finally {
      setBusy(false);
    }
  }


  async function handleResendOtp() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.sendOtp(identifier.trim());
      setMockedOtp(res.mocked_otp);
      setError("A fresh verification code has been generated!");
    } catch (err: any) {
      setError(err?.message || "Failed to resend code");
    } finally {
      setBusy(false);
    }
  }

  function handleAutoFillOtp() {
    if (mockedOtp) {
      setOtp(mockedOtp);
      setError(null);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!otp.trim()) {
      setError("Please enter the verification code");
      return;
    }
    setBusy(true);
    try {
      const res = await api.verifyOtp({
        identifier: identifier.trim(),
        otp: otp.trim(),
        display_name: displayName.trim() || undefined,
      });

      let userForSession = res.user;
      if (isNewUser && avatarFile) {
        const formData = new FormData();
        formData.append("file", avatarFile);
        const uploadRes = await fetch(`${API_URL}/api/upload/avatar`, {
          method: "POST",
          headers: { Authorization: `Bearer ${res.token}` },
          body: formData,
        });
        if (uploadRes.ok) {
          userForSession = await uploadRes.json();
        }
      }

      login(res.token, userForSession);
      router.push("/chat");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("display name")) {
        setIsNewUser(true);
        setError("Welcome! Please enter your name to complete registration.");
      } else {
        setError(msg || "Failed to verify OTP");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    setAvatarFile(e.target.files?.[0] || null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#edf0f5] px-4 font-sans relative overflow-y-auto py-10">
      {/* Decorative ambient background blur accents */}
      <div className="absolute top-10 left-1/3 w-80 h-80 bg-blue-200 rounded-full filter blur-[100px] opacity-40"></div>
      <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-indigo-200 rounded-full filter blur-[100px] opacity-40"></div>

      <div className="w-full max-w-lg flex flex-col rounded-3xl bg-white p-8 md:p-10 shadow-xl border border-gray-200/80 relative z-10 my-auto">
        <div>
          {/* Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2c6bed] to-indigo-600 text-white shadow-md shadow-[#2c6bed]/20 mb-3 transform transition hover:scale-105">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.607-.822A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Signal Clone</h1>
            <p className="text-xs text-gray-500 mt-1 font-medium">Connect safely · End-to-End Encrypted</p>
          </div>

          {step === "identifier" && (
            <div className="animate-in fade-in duration-300">
              <form onSubmit={(e) => handleSendOtp(undefined, e)} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">
                    Phone Number
                  </span>
                  <div className="relative flex items-center gap-2">
                    {/* Country prefix dropdown button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-3.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 shrink-0"
                      >
                        <span>{country.flag}</span>
                        <span>{country.code}</span>
                        <svg className="w-3.5 h-3.5 text-gray-500 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {showCountryDropdown && (
                        <div className="absolute left-0 top-full mt-1.5 z-50 w-56 max-h-56 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-xl border border-gray-200 animate-in fade-in duration-200">
                          {COUNTRIES.map((c) => (
                            <button
                              key={c.name + c.code}
                              type="button"
                              onClick={() => {
                                setCountry(c);
                                setShowCountryDropdown(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                                country.name === c.name && country.code === c.code
                                  ? "bg-white text-gray-900 ring-1 ring-gray-200 font-bold"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.name}</span>
                              </span>
                              <span className="font-mono font-semibold">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone input */}
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="98765 43210 or +15550001"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-[#2c6bed] focus:ring-2 focus:ring-[#2c6bed]/20 font-medium"
                    />
                  </div>
                </label>

                {error && <p className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 rounded-xl bg-[#2c6bed] py-3.5 font-bold text-white shadow-md shadow-[#2c6bed]/25 transition-all hover:bg-[#1d5bd8] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? "Sending Code..." : "Continue"}
                </button>
              </form>


            </div>
          )}

          {step === "otp" && (
            <form onSubmit={handleVerify} className="flex flex-col gap-5 animate-in fade-in duration-300">
              <div className="text-center mb-1">
                <p className="text-sm text-gray-600 font-medium">
                  Verification code sent to <span className="font-bold text-gray-900">{identifier}</span>
                </p>
                
                {mockedOtp && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-5 py-3 text-sm text-blue-800 font-mono border border-blue-200 shadow-xs">
                      <span>Verification Code:</span>
                      <strong className="text-xl tracking-wider text-[#2c6bed]">{mockedOtp}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoFillOtp}
                      className="text-xs font-bold text-[#2c6bed] hover:text-[#1d5bd8] underline cursor-pointer transition-colors mt-1"
                    >
                      ⚡ Click to Auto-fill Code
                    </button>
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">Enter 6-Digit Code</span>
                <input
                  type="text"
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-center text-2xl font-mono tracking-[0.5em] text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-[#2c6bed] focus:ring-2 focus:ring-[#2c6bed]/20"
                />
              </label>

              <div className="flex justify-between items-center px-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={busy}
                  className="text-xs font-bold text-[#2c6bed] hover:text-[#1d5bd8] transition-colors disabled:opacity-50"
                >
                  🔄 Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("identifier"); setError(null); }}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  ← Use different account
                </button>
              </div>

              {isNewUser && (
                <div className="mt-2 space-y-3.5 p-5 rounded-2xl bg-gray-50 border border-gray-200 animate-in fade-in duration-300">
                  <p className="text-xs font-bold text-[#2c6bed] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2c6bed] animate-pulse"></span>
                    New Account Registration
                  </p>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-700">Display Name</span>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2c6bed]"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-700">Profile Avatar (optional)</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-800 hover:file:bg-gray-300 transition-all cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {error && <p className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">{error}</p>}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 rounded-xl bg-[#2c6bed] py-3.5 font-bold text-white shadow-md shadow-[#2c6bed]/25 transition-all hover:bg-[#1d5bd8] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                {busy ? "Verifying..." : "Verify & Connect"}
              </button>
            </form>
          )}
        </div>

        {/* Security Feature Badges */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-gray-500">
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
              <span className="text-base">🔒</span>
              <span className="font-semibold text-gray-700">End-to-End</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
              <span className="text-base">⚡</span>
              <span className="font-semibold text-gray-700">Instant Sync</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
              <span className="text-base">🛡️</span>
              <span className="font-semibold text-gray-700">Zero Logs</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 font-medium text-center mt-3">Signal Clone · Private & Secure Communications</p>
        </div>
      </div>
    </div>
  );
}
