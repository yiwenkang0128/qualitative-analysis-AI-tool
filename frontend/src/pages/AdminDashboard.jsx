import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, LayoutDashboard, Users, FileText, Search, 
  Trash2, ChevronDown, ChevronUp, UserPlus, ShieldAlert 
} from 'lucide-react';

const ROOT_ADMIN_EMAIL = 'admin@test.com';

function UserDocuments({ userId, onDocumentDelete }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`http://localhost:3001/api/admin/users/${userId}/docs`)
    .then(res => setDocs(res.data))
    .catch(e => alert("Failed to load user documents"))
    .finally(() => setLoading(false));
  }, [userId]);

  const handleDeleteDoc = async (docId) => {
    if (!confirm("Are you sure you want to delete this document? User chat history will also be deleted.")) return;
    try {
      await axios.delete(`http://localhost:3001/api/admin/documents/${docId}`);
      setDocs(prev => prev.filter(d => d.id !== docId));
      onDocumentDelete();
    } catch (e) {
      alert("Failed to delete document");
    }
  };

  if (loading) return <div className="p-4 text-gray-500">Loading...</div>;

  return (
    <div className="p-4 bg-gray-50 border-t border-gray-100 animate-in slide-in-from-top-2">
      <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
        <FileText className="w-4 h-4"/>
        Documents ({docs.length})
      </h4>
      {docs.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li key={doc.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 transition-colors">
              <div className="text-sm">
                <p className="font-medium text-gray-900">{doc.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(doc.createdAt).toLocaleDateString()} • {doc.originalName}
                </p>
              </div>
              <button 
                onClick={() => handleDeleteDoc(doc.id)} 
                className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all"
                title="Delete Document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  
  const [refreshKey, setRefreshKey] = useState(0); 
  
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:3001/api/admin/users`, {
        params: { search: searchQuery }
      });
      setUsers(res.data);
    } catch (e) {
      console.error(e);
      if (e.response?.status !== 401 && e.response?.status !== 403) {
          alert("Load failed, please check network");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, refreshKey]);

  const handleDeleteUser = async (targetUser) => {
    const warningText = targetUser.role === 'admin' 
        ? "⚠️ CRITICAL WARNING: You are deleting an ADMIN account! This will permanently delete the admin and all their data." 
        : "Are you sure you want to delete this user? All documents and chat history will be permanently deleted!";

    if (!confirm(warningText)) return;

    try {
      await axios.delete(`http://localhost:3001/api/admin/users/${targetUser.id}`);
      alert("Deleted successfully.");
      setRefreshKey(prev => prev + 1);
      if (expandedUser === targetUser.id) setExpandedUser(null);
    } catch (e) {
      alert(e.response?.data?.error || "Deletion failed");
    }
  };

  const handleRegisterAdmin = async (email, password) => {
    try {
      await axios.post('http://localhost:3001/api/admin/register-admin', { email, password });
      alert(`New admin ${email} created successfully!`);
      setRefreshKey(prev => prev + 1);
      setExpandedUser(null);
    } catch (e) {
      alert(e.response?.data?.error || "Registration failed, email might already exist.");
    }
  };

  const totalDocs = users.reduce((sum, u) => sum + u._count.documents, 0);
  const adminCount = users.filter(u => u.role === 'admin').length;
  const isRootAdmin = user?.email === ROOT_ADMIN_EMAIL;

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans text-gray-800">
      
      <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
            <LayoutDashboard className="w-6 h-6"/>
          </div>
          Admin Dashboard
        </h1>
        
        <div className="flex items-center gap-4">
          {isRootAdmin && (
            <button 
                onClick={() => setExpandedUser('admin-register')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
                <UserPlus className="w-4 h-4" /> Add Admin
            </button>
          )}
          
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-700">{user?.email}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">
                {isRootAdmin ? 'Super Admin' : 'Admin'}
            </div>
          </div>
          
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm">
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {expandedUser === 'admin-register' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white p-8 rounded-2xl w-full max-w-sm shadow-2xl transform transition-all scale-100">
                <div className="flex items-center gap-3 mb-6 text-indigo-600">
                    <ShieldAlert className="w-8 h-8" />
                    <h3 className="text-xl font-bold text-gray-900">Add New Admin</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                        <input id="admin-email" type="email" placeholder="admin@example.com" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Initial Password</label>
                        <input id="admin-password" type="password" placeholder="At least 8 chars" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <button onClick={() => setExpandedUser(null)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => {
                        const email = document.getElementById('admin-email').value;
                        const password = document.getElementById('admin-password').value;
                        if(!email || !password) return alert("Please fill in all fields");
                        handleRegisterAdmin(email, password);
                    }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg transition-all active:scale-95">Create</button>
                </div>
            </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-5">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="w-8 h-8" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{users.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-5">
            <div className="p-4 bg-green-50 text-green-600 rounded-xl">
                <FileText className="w-8 h-8" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Total Docs</p>
                <p className="text-3xl font-bold text-gray-900">{totalDocs}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center gap-5">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-xl">
                <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium uppercase">Admins</p>
                <p className="text-3xl font-bold text-gray-900">{adminCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-xl text-gray-800">User Database</h3>
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search user email..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/50 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                <tr>
                  <th className="p-4 w-12"></th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Docs</th>
                  <th className="p-4">Joined</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" className="text-center p-8 text-gray-400">Loading...</td></tr>
                ) : (
                  users.map(u => (
                    <React.Fragment key={u.id}>
                      <tr className={`border-b border-gray-50 hover:bg-gray-50/80 transition-colors ${expandedUser === u.id ? 'bg-gray-50' : ''}`}>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                            className={`p-1.5 rounded-lg transition-colors ${expandedUser === u.id ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                          >
                            {expandedUser === u.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                          </button>
                        </td>
                        <td className="p-4 font-medium text-gray-900">{u.email}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                            u.role === 'admin' 
                                ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}>
                            {u.role === 'admin' ? 'ADMIN' : 'USER'}
                          </span>
                        </td>
                        <td className="p-4 font-mono">{u._count.documents}</td>
                        <td className="p-4">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                          {(u.role !== 'admin' || (isRootAdmin && u.email !== ROOT_ADMIN_EMAIL)) ? (
                            <button 
                              onClick={() => handleDeleteUser(u)}
                              className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-all group relative"
                            >
                              <Trash2 className="w-5 h-5" />
                              {u.role === 'admin' && (
                                <span className="absolute bottom-full right-0 mb-2 w-max bg-gray-900 text-white text-xs py-1 px-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                  Delete Admin
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs italic select-none px-2">
                              {u.email === ROOT_ADMIN_EMAIL ? 'ROOT' : 'NO PERM'}
                            </span>
                          )}
                        </td>
                      </tr>
                      
                      {expandedUser === u.id && (
                        <tr>
                          <td colSpan="6" className="p-0 border-b border-gray-100">
                            <UserDocuments 
                              userId={u.id} 
                              onDocumentDelete={() => setRefreshKey(prev => prev + 1)} 
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}