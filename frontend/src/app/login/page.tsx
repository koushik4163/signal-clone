"use client";

import { useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Step = "identifier" | "otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("identifier");
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

  /*
   * Indian phone number validation
   *
   * Valid:
   * 9876543210
   * 9123456789
   *
   * Invalid:
   * 987654321
   * 98765432101
   * 1234567890
   *
   * We also require the first digit to be 6-9,
   * which is the normal Indian mobile-number pattern.
   */
  function isValidIndianMobile(phone: string): boolean {
    return /^[6-9][0-9]{9}$/.test(phone);
  }

  /*
   * Always convert the entered number into:
   *
   * +919876543210
   */
  function getFullPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");

    return `+91${digits}`;
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);

    /*
     * Remove spaces, hyphens, brackets, etc.
     *
     * Example:
     * "98765 43210" -> "9876543210"
     */
    const cleanPhone = identifier.replace(/\D/g, "");

    if (!cleanPhone) {
      setError("Please enter your mobile number.");
      return;
    }

    /*
     * Exactly 10 digits and must start with 6, 7, 8 or 9.
     */
    if (!isValidIndianMobile(cleanPhone)) {
      setError(
        "Please enter a valid Indian mobile number with exactly 10 digits."
      );
      return;
    }

    const fullPhoneNumber = getFullPhoneNumber(cleanPhone);

    setIsNewUser(false);
    setAvatarFile(null);
    setBusy(true);

    try {
      const res = await api.sendOtp(fullPhoneNumber);

      setMockedOtp(res.mocked_otp);
      setIsNewUser(res.is_new_user);

      /*
       * Keep the normalized international number.
       */
      setIdentifier(fullPhoneNumber);

      setStep("otp");
    } catch (err: any) {
      setError(
        err?.message || "Failed to send verification code."
      );
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
      setError(
        err?.message || "Failed to resend verification code."
      );
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

    const cleanOtp = otp.replace(/\D/g, "");

    if (!cleanOtp) {
      setError("Please enter the verification code.");
      return;
    }

    if (cleanOtp.length !== 6) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setBusy(true);

    try {
      const res = await api.verifyOtp({
        identifier: identifier.trim(),
        otp: cleanOtp,
        display_name: displayName.trim() || undefined,
      });

      let userForSession = res.user;

      /*
       * Upload avatar for new users.
       */
      if (isNewUser && avatarFile) {
        const formData = new FormData();

        formData.append("file", avatarFile);

        const uploadRes = await fetch(
          `${API_URL}/api/upload/avatar`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${res.token}`,
            },
            body: formData,
          }
        );

        if (uploadRes.ok) {
          userForSession = await uploadRes.json();
        }
      }

      /*
       * Save authentication session.
       */
      login(res.token, userForSession);

      router.push("/chat");
    } catch (err: any) {
      const msg = err?.message || "";

      /*
       * Backend tells us that a display name is required
       * for a new account.
       */
      if (msg.toLowerCase().includes("display name")) {
        setIsNewUser(true);

        setError(
          "Welcome! Please enter your name to complete registration."
        );
      } else {
        setError(msg || "Failed to verify OTP.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleAvatarChange(
    e: ChangeEvent<HTMLInputElement>
  ) {
    setAvatarFile(e.target.files?.[0] || null);
  }

  function handlePhoneChange(
    e: ChangeEvent<HTMLInputElement>
  ) {
    /*
     * Only allow numbers.
     *
     * Maximum 10 digits.
     */
    const digits = e.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    setIdentifier(digits);
    setError(null);
  }

  function handleChangeAccount() {
    setStep("identifier");
    setIdentifier("");
    setOtp("");
    setDisplayName("");
    setAvatarFile(null);
    setMockedOtp(null);
    setIsNewUser(false);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#edf0f5] px-4 font-sans relative overflow-y-auto py-10">
      {/* Decorative background */}
      <div className="absolute top-10 left-1/3 w-80 h-80 bg-blue-200 rounded-full filter blur-[100px] opacity-40" />

      <div className="absolute bottom-10 right-1/3 w-80 h-80 bg-indigo-200 rounded-full filter blur-[100px] opacity-40" />

      <div className="w-full max-w-lg flex flex-col rounded-3xl bg-white p-8 md:p-10 shadow-xl border border-gray-200/80 relative z-10 my-auto">
        <div>
          {/* Header */}
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2c6bed] to-indigo-600 text-white shadow-md shadow-[#2c6bed]/20 mb-3 transform transition hover:scale-105">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.607-.822A9.957 9.957 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" />
              </svg>
            </div>

            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Signal Clone
            </h1>

            <p className="text-xs text-gray-500 mt-1 font-medium">
              Connect safely · End-to-End Encrypted
            </p>
          </div>

          {/* =========================
              PHONE NUMBER STEP
             ========================= */}

          {step === "identifier" && (
            <div className="animate-in fade-in duration-300">
              <form
                onSubmit={handleSendOtp}
                className="flex flex-col gap-4"
              >
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">
                    Indian Mobile Number
                  </span>

                  <div className="flex items-center">
                    {/* Fixed India prefix */}
                    <div className="flex items-center gap-2 rounded-l-xl border border-r-0 border-gray-300 bg-white px-4 py-3.5 text-sm font-semibold text-gray-900 shadow-sm">
                      <span className="text-lg">🇮🇳</span>
                      <span>+91</span>
                    </div>

                    {/* Phone input */}
                    <input
                      type="tel"
                      required
                      value={identifier}
                      onChange={handlePhoneChange}
                      placeholder="98765 43210"
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="tel-national"
                      className="w-full rounded-r-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-[#2c6bed] focus:ring-2 focus:ring-[#2c6bed]/20 font-medium"
                    />
                  </div>

                  <span className="text-[11px] text-gray-500 ml-1">
                    Enter a valid 10-digit Indian mobile number
                  </span>
                </label>

                {error && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    busy ||
                    identifier.replace(/\D/g, "").length !== 10
                  }
                  className="mt-1 rounded-xl bg-[#2c6bed] py-3.5 font-bold text-white shadow-md shadow-[#2c6bed]/25 transition-all hover:bg-[#1d5bd8] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Sending Code..." : "Continue"}
                </button>
              </form>
            </div>
          )}

          {/* =========================
              OTP STEP
             ========================= */}

          {step === "otp" && (
            <form
              onSubmit={handleVerify}
              className="flex flex-col gap-5 animate-in fade-in duration-300"
            >
              <div className="text-center mb-1">
                <p className="text-sm text-gray-600 font-medium">
                  Verification code sent to{" "}
                  <span className="font-bold text-gray-900">
                    {identifier}
                  </span>
                </p>

                {/* Mock OTP */}
                {mockedOtp && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-5 py-3 text-sm text-blue-800 font-mono border border-blue-200 shadow-xs">
                      <span>Verification Code:</span>

                      <strong className="text-xl tracking-wider text-[#2c6bed]">
                        {mockedOtp}
                      </strong>
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

              {/* OTP input */}
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider ml-1">
                  Enter 6-Digit Code
                </span>

                <input
                  type="text"
                  required
                  value={otp}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    setOtp(value);
                    setError(null);
                  }}
                  placeholder="123456"
                  className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3.5 text-center text-2xl font-mono tracking-[0.5em] text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:bg-white focus:border-[#2c6bed] focus:ring-2 focus:ring-[#2c6bed]/20"
                />
              </label>

              {/* OTP actions */}
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
                  onClick={handleChangeAccount}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
                >
                  ← Use different number
                </button>
              </div>

              {/* New user registration */}
              {isNewUser && (
                <div className="mt-2 space-y-3.5 p-5 rounded-2xl bg-gray-50 border border-gray-200 animate-in fade-in duration-300">
                  <p className="text-xs font-bold text-[#2c6bed] uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2c6bed] animate-pulse" />

                    New Account Registration
                  </p>

                  {/* Display name */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      Display Name
                    </span>

                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) =>
                        setDisplayName(e.target.value)
                      }
                      placeholder="e.g. Alex Morgan"
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#2c6bed]"
                    />
                  </label>

                  {/* Avatar */}
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      Profile Avatar (optional)
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="block w-full text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-gray-800 hover:file:bg-gray-300 transition-all cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {error && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-3.5 rounded-xl border border-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className="mt-2 rounded-xl bg-[#2c6bed] py-3.5 font-bold text-white shadow-md shadow-[#2c6bed]/25 transition-all hover:bg-[#1d5bd8] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="font-semibold text-gray-700">
                End-to-End
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
              <span className="text-base">⚡</span>
              <span className="font-semibold text-gray-700">
                Instant Sync
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
              <span className="text-base">🛡️</span>
              <span className="font-semibold text-gray-700">
                Zero Logs
              </span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 font-medium text-center mt-3">
            Signal Clone · Private & Secure Communications
          </p>
        </div>
      </div>
    </div>
  );
}
