import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Mail, Lock, Loader2, ArrowRight, CheckCircle2, AlertTriangle, Receipt, User, Sparkles, Check } from 'lucide-react';

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
    <div className="min-h-screen w-full flex items-center justify-center bg-[#fcfdfe] overflow-hidden p-6">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-[#f4cc2a]/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-[#1c2434]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl bg-white rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(28,36,52,0.12)] border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[640px]">
        
        {/* Left Column: Branding & Info */}
        <div className="w-full md:w-5/12 bg-[#1c2434] p-10 md:p-14 text-white relative flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#f4cc2a]/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#f4cc2a]/5 rounded-full -ml-32 -mb-32 blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <div className="bg-[#f4cc2a] p-2 rounded-xl shadow-lg shadow-[#f4cc2a]/20">
                <Receipt className="w-6 h-6 text-[#1c2434]" />
              </div>
              <h1 className="text-xl font-black tracking-tight">InvoiceMatcher <span className="text-[#f4cc2a]">AI</span></h1>
            </div>

            <h2 className="text-3xl md:text-4xl font-black leading-tight mb-6 tracking-tight">
              Advance AI <br/>
              <span className="text-[#f4cc2a]">Invoice Checking Tool</span>
            </h2>
            
            <p className="text-slate-400 text-sm font-medium mb-10 leading-relaxed max-w-xs">
              Powered by advanced Gemini AI to reconcile multi-invoice PDFs against Excel records with 99.8% precision.
            </p>

            <ul className="space-y-4">
              {[
                "Instant Discrepancy Detection",
                "Automated PDF Sorting",
                "Comprehensive Excel Reporting",
                "Secure Cloud Audit History"
              ].map((text, i) => (
                <li key={i} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                  <div className="bg-[#f4cc2a]/20 p-1 rounded-md">
                    <Check className="w-3 h-3 text-[#f4cc2a]" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-10 pt-12 mt-auto">
             <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                <div className="flex -space-x-2">
                   {[1,2,3].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-[#1c2434] bg-slate-700 flex items-center justify-center text-[8px] font-black">
                        {String.fromCharCode(64 + i)}
                     </div>
                   ))}
                </div>
                <p className="text-[10px] font-bold text-slate-400">Trusted by Finance Teams</p>
             </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="w-full md:w-7/12 p-10 md:p-14 bg-white flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-10">
              <h3 className="text-2xl font-black text-[#1c2434] tracking-tight mb-2">
                {isLogin ? 'Welcome Back' : 'Get Started'}
              </h3>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                {isLogin ? 'Enter your credentials to access tool' : 'Create an account to begin matching'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-700 font-black leading-tight uppercase tracking-tight">{error}</p>
              </div>
            )}

            {message && (
               <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                 <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                 <p className="text-[10px] text-emerald-700 font-black leading-tight uppercase tracking-tight">{message}</p>
               </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Email Address</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                  </div>
                  <input
                    type="email"
                    required
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                   <label className="text-[9px] font-black text-slate-400 ml-1 uppercase tracking-widest">Password</label>
                   {isLogin && (
                      <button type="button" className="text-[9px] font-black text-[#1c2434] uppercase tracking-widest hover:text-[#f4cc2a] transition-colors">Forgot?</button>
                   )}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-slate-400 group-focus-within:text-[#1c2434] transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="block w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#1c2434]/5 focus:border-[#1c2434] transition-all font-bold"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-[#1c2434] text-[#f4cc2a] font-black rounded-xl shadow-xl shadow-[#1c2434]/15 hover:shadow-2xl hover:shadow-[#1c2434]/25 transform transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] mt-8 group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In Account' : 'Create Free Account'}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-50 text-center">
              <p className="text-slate-500 text-[11px] font-bold tracking-tight">
                {isLogin ? "Don't have an account yet? " : "Already have an account? "}
                <button
                  onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                      setMessage(null);
                  }}
                  className="font-black text-[#1c2434] hover:text-[#f4cc2a] transition-all underline underline-offset-4 decoration-[#f4cc2a]/30"
                >
                  {isLogin ? 'Signup' : 'Login instead'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;