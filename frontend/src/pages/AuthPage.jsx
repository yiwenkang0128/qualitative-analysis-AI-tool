import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Lock, Mail, AlertTriangle, Repeat } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login } = useAuth();
  const [error, setError] = useState('');

  const validatePassword = () => {
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!isLogin && password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin) {
      const validationError = validatePassword();
      if (validationError) {
        setError(validationError);
        return;
      }
    }
    
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await axios.post(`http://localhost:3001${endpoint}`, { 
        email, password 
      });

      if (isLogin) {
        login(res.data.role, res.data.email);
      } else {
        setIsLogin(true);
        alert("Registration successful, please login.");
        setPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.error || "Operation failed, check network or credentials");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-2xl border border-gray-100">
        <div className="flex justify-center mb-6 text-indigo-600">
          <Sparkles className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-center mb-2 text-gray-900">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        <p className="text-center text-gray-500 mb-8">Anti-Displacement Reader</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required 
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required 
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
            </div>
            {!isLogin && <p className="text-xs text-gray-400 mt-1">Password must be at least 8 chars.</p>}
          </div>

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <div className="relative">
                <Repeat className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required 
                  className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg flex items-center gap-2 justify-center">
                <AlertTriangle className="w-4 h-4" />
                {error}
            </div>
          )}

          <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg cursor-pointer hover:scale-[1.02]">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {isLogin ? "No account?" : "Have an account?"}
          <button onClick={() => {setIsLogin(!isLogin); setError('')}} className="text-indigo-600 font-bold ml-2 hover:underline cursor-pointer">
            {isLogin ? "Register" : "Login"}
          </button>
        </div>
      </div>
    </div>
  );
}