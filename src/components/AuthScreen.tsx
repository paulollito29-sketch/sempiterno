import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MinimalistLogo } from './MinimalistLogo';
import { AuthProviderType } from '../types';
import { triggerHapticImpact } from '../utils/native';
import { Loader2, Mail } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (provider: AuthProviderType, email?: string, name?: string) => Promise<void>;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<AuthProviderType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleProviderClick = async (provider: AuthProviderType) => {
    setErrorMsg(null);
    if (provider === 'email' && !email.trim().includes('@')) {
      setErrorMsg('Por favor ingresa un correo válido.');
      return;
    }

    await triggerHapticImpact('light');
    setLoadingProvider(provider);
    try {
      await onLogin(provider, email, name);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo iniciar sesión. Intenta nuevamente.');
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#FAF8F5] dark:bg-[#0F1015] flex flex-col justify-between px-6 py-10 max-w-md mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center mt-6 flex flex-col items-center"
      >
        <MinimalistLogo size="lg" />
        <span className="mt-5 text-[11px] font-bold tracking-[0.25em] text-rose-500 uppercase">
          Sempiterno Duo
        </span>
        <h1 className="serif-title text-3xl sm:text-4xl font-bold text-stone-900 dark:text-stone-100 mt-1.5 leading-tight">
          El espacio íntimo
          <br />
          <span className="italic font-normal text-rose-500">de su amor</span>
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-2.5 max-w-xs leading-relaxed">
          Guarda recuerdos, comparte pensamientos en vivo y envíense caricias en tiempo real.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="space-y-3 w-full my-8"
      >
        {/* Optional Name Field */}
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre o apodo (opcional, ej. Paulo)"
            className="w-full px-4 py-3.5 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
          />
        </div>

        {/* Google Auth */}
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleProviderClick('google')}
          className="w-full py-3.5 px-4 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 shadow-xs flex items-center justify-center gap-3 text-xs font-bold text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 active:scale-[0.98] transition-all"
        >
          {loadingProvider === 'google' ? (
            <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.4 7.5 23 12 23z"
              />
            </svg>
          )}
          <span>Continuar con Google</span>
        </button>

        {/* Apple Auth */}
        <button
          type="button"
          disabled={loadingProvider !== null}
          onClick={() => handleProviderClick('apple')}
          className="w-full py-3.5 px-4 rounded-2xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs flex items-center justify-center gap-3 text-xs font-bold hover:opacity-95 active:scale-[0.98] transition-all"
        >
          {loadingProvider === 'apple' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.39c.62-.75 1.04-1.8 0.93-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.07 1.72-.94 2.74 1.01.08 2.02-.49 2.64-1.24z" />
            </svg>
          )}
          <span>Continuar con Apple</span>
        </button>

        {/* Divider */}
        <div className="relative py-2 flex items-center justify-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-800" />
          <span className="absolute bg-[#FAF8F5] dark:bg-[#0F1015] px-3 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
            o con correo
          </span>
        </div>

        {/* Email Magic Link */}
        <div className="space-y-2.5">
          <div className="relative">
            <Mail className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-[#181A20] border border-stone-200/80 dark:border-stone-800 text-xs text-stone-800 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
            />
          </div>

          {errorMsg && (
            <p className="text-[11px] font-medium text-rose-500 px-1">{errorMsg}</p>
          )}

          <button
            type="button"
            disabled={loadingProvider !== null}
            onClick={() => handleProviderClick('email')}
            className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loadingProvider === 'email' && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Ingresar con Enlace Mágico</span>
          </button>
        </div>
      </motion.div>

      <p className="text-[10px] text-stone-400 text-center">
        Al entrar aceptas los Términos de Pareja y Privacidad Cifrada en la nube.
      </p>
    </div>
  );
};
