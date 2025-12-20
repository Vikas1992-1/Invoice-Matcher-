import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, Loader2, ArrowRight, Sparkles, CheckCircle2, AlertTriangle, Receipt, User, ShieldCheck } from 'lucide-react';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });
        if (error) throw error;
        
        if (data.user && !data.session) {
           setMessage("Account created! Please check your email to confirm.");
           setIsLogin(true);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fcfdfe] overflow-hidden p-4 md:p-8">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#f4cc2a]/10 rounded-full blur-[100px] animate-blob"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#1c2434]/5 rounded-full blur-[120px] animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#1c2434 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-4xl bg-white rounded-[2.5rem] shadow-[0_40px_100px_-20px_rgba(28,36,52,0.15)] border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        <div className="hidden md:flex w-2/5 bg-[#1c2434] relative p-10 flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f4cc2a]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-[#f4cc2a] p-2 rounded-xl shadow-lg shadow-[#f4cc2a]/20">
                <Receipt className="w-5 h-5 text-[#1c2434]" />
              </div>
              <span className="text-white font-black text-lg tracking-tight">InvoiceMatcher</span>
            </div>
            
            <h2 className="text-3xl font-black text-white leading-tight tracking-tight mb-4">
              Invoice <br/>
              <span className="text-[#f4cc2a]">Matching</span> <br/>
              Tool.
            </h2>
            <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[240px]">
              Use our AI to check your invoices quickly and without mistakes.
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
               <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-xs font-black uppercase tracking-widest">Safe Login</p>
              <p className="text-[10px] text-slate-400 font-medium">Your data is secure</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-sm mx-auto w-full">
            <div className="mb-8 md:hidden text-center">
               <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1c2434] mb-4">
                  <Receipt className="w-7 h-7 text-[#f4cc2a]" />
               </div>
            </div>

            <div className="mb-10 text-center md:text-left">
              <h1 className="text-2xl font-black text-[#1c2434] tracking-tight mb-2">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h1>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-60">
                {isLogin ? 'Please enter your login info' : 'Sign up to start checking invoices'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-700 font-black leading-tight uppercase tracking-tight">{error}</p>
              </div>
            )}

            {message && (
               <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-emerald-700 font-black leading-tight uppercase tracking-tight">{message}</p>
               </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Your Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="block w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#1c2434] text-[#f4cc2a] font-black rounded-xl shadow-lg shadow-[#1c2434]/20 hover:shadow-xl hover:shadow-[#1c2434]/30 transform transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xs uppercase tracking-widest mt-6"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In Now' : 'Sign Up Now'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-6 border-t border-slate-50 text-center">
              <p className="text-slate-500 text-[11px] font-bold tracking-tight">
                {isLogin ? "Need an account? " : "Already have an account? "}
                <button
                  onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                      setMessage(null);
                  }}
                  className="font-black text-[#1c2434] hover:text-[#f4cc2a] transition-all decoration-[#f4cc2a]/30 hover:decoration-[#f4cc2a] underline underline-offset-4"
                >
                  {isLogin ? 'Create one here' : 'Go to login'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-6 text-center w-full z-0 opacity-40">
         <p className="text-[8px] text-[#1c2434] font-black uppercase tracking-[0.5em]">Fast Invoice Check Tool</p>
      </div>
    </div>
  );
};

export default Login;