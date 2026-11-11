import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'customer' });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await axios.post(`${API}${endpoint}`, formData);
      
      if (isLogin) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/chat');
        window.location.reload(); // Refresh to load socket
      } else {
        alert('Registered successfully! Please log in.');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-slate-900 text-white p-4">
      <form onSubmit={handleSubmit} className="bg-slate-800 p-8 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-400">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>
        
        {!isLogin && (
          <input type="text" placeholder="Full Name" required className="w-full p-3 mb-4 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
            onChange={e => setFormData({...formData, name: e.target.value})} />
        )}
        
        <input type="email" placeholder="Email Address" required className="w-full p-3 mb-4 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
          onChange={e => setFormData({...formData, email: e.target.value})} />
        
        <input type="password" placeholder="Password" required className="w-full p-3 mb-4 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
          onChange={e => setFormData({...formData, password: e.target.value})} />

        {!isLogin && (
          <select className="w-full p-3 mb-6 bg-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" 
            onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="customer">Customer</option>
            <option value="admin">Admin / Support</option>
          </select>
        )}

        <button className="w-full bg-blue-600 hover:bg-blue-500 p-3 rounded-lg font-bold text-lg transition-colors">
          {isLogin ? 'Sign In' : 'Sign Up'}
        </button>

        <p className="mt-6 text-center text-slate-400 cursor-pointer hover:text-white transition-colors" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? "Don't have an account? Register here" : "Already have an account? Login here"}
        </p>
      </form>
    </div>
  );
}