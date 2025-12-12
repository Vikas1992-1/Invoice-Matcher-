import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Receipt, ShieldCheck, AlertTriangle, Mail, Lock, Loader2, ArrowRight, FileCode } from 'lucide-react';

const Login: React.FC = () => {
  const { error: configError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configError) return;
    
    setAuthError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        await registerUser(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "Authentication failed. Please try again.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = "Invalid email or password.";
      } else if (err.code === 'auth/email-already-in-use') {
        msg = "This email is already registered. Please sign in.";
      } else if (err.code === 'auth/weak-password') {
        msg = "Password should be at least 6 characters.";
      } else if (err.code === 'auth/invalid-email') {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl inline-flex items-center justify-center mb-4 shadow-blue-200 shadow-lg">
             <Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-slate-500">
            {isLogin ? 'Sign in to access Invoice Matcher AI' : 'Get started with automated reconciliation'}
          </p>
        </div>
        
        {configError && (
           <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex flex-col gap-3">
              <div className="flex items-center gap-2 font-bold border-b border-red-200 pb-2">
                 <AlertTriangle className="w-5 h-5" />
                 Configuration Required
              </div>
              <p>You need to create a <code className="bg-red-100 px-1 py-0.5 rounded font-mono text-red-800">.env</code> file in your project root with your Firebase keys.</p>
              <div className="bg-slate-800 text-slate-200 p-3 rounded font-mono text-xs overflow-x-auto whitespace-pre">
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
# ... other firebase keys
              </div>
              <p className="text-xs text-red-600 mt-1">Don't forget to restart your server after creating the file!</p>
           </div>
        )}

        {authError && (
           <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
           </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                placeholder="you@company.com"
                disabled={!!configError}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                placeholder="••••••••"
                disabled={!!configError}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={!!configError || isLoading}
            className={`w-full font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all mt-6
              ${configError || isLoading
                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                 : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95'}`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {isLogin ? 'Sign In' : 'Sign Up'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setAuthError(null);
            }}
            disabled={!!configError}
            className={`text-sm font-medium hover:underline ${!!configError ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800'}`}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100">
           <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Secure Authentication</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Login;