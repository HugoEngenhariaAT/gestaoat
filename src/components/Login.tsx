import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, UserCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      const internalEmail = email.includes('@') ? email : `${email.toLowerCase().replace(/\s+/g, '').trim()}@hugo.com`;
      const { error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Usuário ou senha incorretos.');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('E-mail ainda não confirmado. Verifique sua caixa de entrada.');
        }
        throw error;
      }
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabase();
      
      const internalEmail = email.includes('@') ? email : `${email.toLowerCase().trim()}@hugo.com`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: internalEmail,
        password,
        options: {
          data: {
            full_name: email.split('@')[0].toUpperCase(),
          }
        }
      });

      if (authError) {
        if (authError.message.includes('User already registered')) {
          throw new Error('Este e-mail já está cadastrado. Tente fazer login.');
        }
        throw authError;
      }

      // 2. Handle profile creation/update
      if (authData.user) {
        // We use upsert to ensure the profile exists and has the password record
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: authData.user.id,
            email: internalEmail,
            password_record: password,
            full_name: email.split('@')[0].toUpperCase(),
            role: 'USER',
            is_active: true
          });

        if (profileError) {
          console.warn('Profile creation handled by trigger or delayed:', profileError.message);
          // If it's a permission error, it's likely because email confirmation is required
          if (profileError.code === '42501' || profileError.message.includes('permission denied')) {
            toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
          } else {
            toast.warning('Conta criada, mas houve um erro ao salvar dados adicionais.');
          }
        } else {
          toast.success('Conta criada com sucesso! Você já pode entrar.');
        }
      } else {
        toast.success('Conta criada! Verifique seu e-mail se necessário.');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      toast.error(error.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-xl w-full max-w-md"
      >
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 flex shrink-0 shadow-md">
              <div className="w-1/2 h-full bg-brand-light rounded-l-lg"></div>
              <div className="w-1/2 h-full bg-brand-dark rounded-r-lg"></div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-black text-brand-dark tracking-tighter leading-none">HUGO</h1>
              <h1 className="text-lg font-light text-neutral-900 tracking-[0.2em] leading-none mt-1 uppercase">Engenharia</h1>
            </div>
          </div>
          <p className="text-neutral-500">Gestão de Obras e Almoxarifado</p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-neutral-400 font-bold tracking-widest">Faça login</span>
          </div>
        </div>

        <form className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Usuário</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input 
                type="text" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-dark outline-none transition-all"
                placeholder="Seu nome de usuário"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-brand-dark outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-dark/20"
            >
              <LogIn size={18} />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button 
              onClick={handleSignUp}
              disabled={loading}
              className="w-full py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold hover:bg-neutral-50 transition-all disabled:opacity-50"
            >
              Criar Conta
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-neutral-400 mt-8">
          Acesso restrito a usuários autorizados.
        </p>
      </motion.div>
    </div>
  );
}
