import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';

/**
 * Shown over the existing page (instead of replacing it) whenever a guest tries to use a
 * feature that needs an account — posting feedback, saving home/work, starting live
 * navigation, etc. Triggered via store.requireAuth('reason'); closes itself on successful
 * login/register.
 */
export const AuthPromptModal: React.FC = () => {
  const { authPromptOpen, authPromptReason, closeAuthPrompt, login } = useFloodStore();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  if (!authPromptOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return;
    }

    const success = login(email, password, isRegisterMode ? fullName : undefined);
    if (!success) {
      setErrorMessage('Invalid email or password.');
    }
    // On success, login() itself clears authPromptOpen — no need to close here.
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthPrompt();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-5 relative">
        <button
          type="button"
          onClick={closeAuthPrompt}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl overflow-hidden mx-auto shadow-lg shadow-blue-600/25 bg-blue-950 flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="JALDRISHTI Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {isRegisterMode ? 'Create your account' : 'Sign in to continue'}
          </h2>
          <p className="text-xs text-slate-500">
            {authPromptReason || 'This feature needs an account so your data stays saved and yours.'}
          </p>
        </div>

        {errorMessage && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs font-sans">
          {isRegisterMode && (
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Full Name</label>
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
            <label className="block font-bold text-slate-700 uppercase mb-1">Email Address</label>
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
            <label className="block font-bold text-slate-700 uppercase mb-1">Password</label>
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
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>{isRegisterMode ? 'REGISTER ACCOUNT' : 'SIGN IN'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-xs">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(!isRegisterMode);
              setErrorMessage('');
            }}
            className="text-blue-600 hover:text-blue-700 font-bold"
          >
            {isRegisterMode ? 'Already have an account? Sign In' : "Don't have an account? Register Now"}
          </button>
        </div>

        <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Your data stays private to your account</span>
        </div>
      </div>
    </div>
  );
};
