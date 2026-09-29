import React, { useState } from 'react';
import { Navigation, Lock, Mail, ArrowRight, ShieldCheck, MailCheck } from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';

export const LoginView: React.FC = () => {
  const { registerAccount, loginAccount, resendVerification, authActionLoading } = useFloodStore();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setInfoMessage('');

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    const result = isRegisterMode
      ? await registerAccount(email, password, fullName)
      : await loginAccount(email, password);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    if (result.needsVerification) {
      // Registered successfully but not signed in yet — Firebase requires clicking the
      // emailed link first.
      setInfoMessage(result.message);
      setAwaitingVerification(true);
      setIsRegisterMode(false);
    }
    // Otherwise loginAccount already flipped isAuthenticated — the app re-renders past this view.
  };

  const handleResend = async () => {
    setErrorMessage('');
    const result = await resendVerification(email, password);
    setInfoMessage(result.message);
    if (!result.success) setErrorMessage(result.message);
  };

  return (
    <div id="jaldrishti-login-view" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto shadow-lg shadow-blue-600/25 bg-blue-950 flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="JALDRISHTI Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              JALDRISHTI Login
            </h1>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mt-0.5">
              Know the Flood Before You Reach It.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            Sign in to access real-time flood intelligence &amp; safe navigation
          </p>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Verification / Info Notice */}
        {infoMessage && !errorMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl text-center flex items-start space-x-2">
            <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{infoMessage}</span>
          </div>
        )}

        {awaitingVerification && (
          <button
            type="button"
            onClick={handleResend}
            disabled={authActionLoading}
            className="w-full text-center text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            Didn't get it? Resend verification email
          </button>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
          {isRegisterMode && (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                placeholder="Sourav Kumar"
                required={isRegisterMode}
              />
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                placeholder="name@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={authActionLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>
              {authActionLoading
                ? 'PLEASE WAIT...'
                : isRegisterMode
                ? 'REGISTER ACCOUNT'
                : 'SIGN IN TO JALDRISHTI'}
            </span>
            {!authActionLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="pt-2 border-t border-slate-100 text-center text-xs">
          <button
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMessage('');
              setInfoMessage('');
              setAwaitingVerification(false);
            }}
            className="text-blue-600 hover:text-blue-700 font-bold"
          >
            {isRegisterMode
              ? 'Already have an account? Sign In'
              : "Don't have an account? Register Now"}
          </button>
        </div>

        {/* Safety Note */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400 justify-center">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Barasat Municipality Verified Portal</span>
        </div>
      </div>
    </div>
  );
};
