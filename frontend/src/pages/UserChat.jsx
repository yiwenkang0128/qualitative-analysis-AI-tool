import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

import { 
  Upload, FileText, Sparkles, MessageSquare, Send, Loader2, 
  Menu, Plus, Trash2, X, MessageCircle 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function UserChat() {
  const [sessions, setSessions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentDocId, setCurrentDocId] = useState(null);
  
  const { user, logout } = useAuth(); 

  const [inputTitle, setInputTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle');

  const [chatData, setChatData] = useState({
    summary: '',
    topics: [],
    history: []
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
        fetchSessions();
    }
  }, [user]);

  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/sessions');
      setSessions(res.data);
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  const loadSession = async (id) => {
    try {
      setCurrentDocId(id);
      const res = await axios.get(`http://localhost:3001/api/sessions/${id}`);
      setChatData({
        summary: res.data.summary,
        topics: res.data.topics,
        history: res.data.chatHistory.map(chat => ({
          role: chat.role,
          content: chat.content
        }))
      });
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (e) {
      console.error("Failed to load details", e);
    }
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this session?")) return;
    
    try {
      await axios.delete(`http://localhost:3001/api/sessions/${id}`);
      fetchSessions();
      if (currentDocId === id) createNewSession();
    } catch (e) {
      alert("Deletion failed");
    }
  };

  const createNewSession = () => {
    setCurrentDocId(null);
    setInputTitle('');
    setUploadStatus('idle');
    setChatData({ summary: '', topics: [], history: [] });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const titleToSend = inputTitle.trim() || file.name;

    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', titleToSend);

    try {
      setUploadStatus('analyzing');
      const res = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: { 
            'Content-Type': 'multipart/form-data',
        },
      });

      await fetchSessions();
      loadSession(res.data.documentId);
      setUploadStatus('idle');

    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || "Analysis failed or session expired");
      setUploadStatus('idle');
    }
  };

  const sendMessage = async (msg) => {
    const text = msg || inputMessage;
    if (!text.trim() || !currentDocId) return;

    setChatData(prev => ({
      ...prev,
      history: [...prev.history, { role: 'user', content: text }]
    }));
    setInputMessage('');
    setIsSending(true);

    try {
      const res = await axios.post('http://localhost:3001/api/chat', {
        documentId: currentDocId,
        query: text
      });

      setChatData(prev => ({
        ...prev,
        history: [...prev.history, { role: 'ai', content: res.data.answer }]
      }));
    } catch (e) {
      setChatData(prev => ({
        ...prev,
        history: [...prev.history, { role: 'ai', content: "❌ Send failed, please retry." }]
      }));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      <aside 
        className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'} 
        bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col fixed md:relative z-20 h-full shadow-2xl overflow-hidden`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-800 w-72">
          <div className="font-bold text-lg flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>History</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-gray-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 w-72">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Analysis</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar w-72">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => loadSession(session.id)}
              className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                ${currentDocId === session.id ? 'bg-gray-800 text-indigo-300' : 'hover:bg-gray-800/50 text-gray-300'}
              `}
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 truncate text-sm">
                {session.title}
              </div>
              <button 
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-between items-end text-xs text-gray-400 w-72">
          <div className="flex flex-col">
            <span className="text-white font-medium truncate max-w-[120px]">
              {user?.email.split('@')[0] || 'User'}
            </span>
            <span className="mt-1">© 2024 Project. All rights reserved.</span>
            <span className="mt-0.5 text-gray-500">Version 1.2.0</span>
          </div>
          <button onClick={logout} className="hover:text-white underline cursor-pointer">Logout</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full w-full relative">
        <header className="h-16 border-b border-gray-200 bg-white flex items-center px-4 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 cursor-pointer"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-serif text-xl font-bold text-indigo-800 tracking-wide hidden sm:block">
              Anti-Displacement Reader
            </h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50 relative">
          {!currentDocId ? (
            <div className="flex flex-col items-center justify-center min-h-full p-6 animate-in fade-in duration-500">
              <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Start New Analysis</h2>
                <p className="text-gray-500 mb-8">Upload a PDF, AI will extract core topics and answer your questions.</p>
                
                <div className="mb-6 text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">Session Name (Optional)</label>
                  <input 
                    type="text" 
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="e.g., 2025 City Plan Draft..." 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {uploadStatus === 'idle' ? (
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept=".pdf" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                    />
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg group-hover:shadow-xl flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-5 h-5" />
                      Select PDF
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 text-indigo-600">
                    <Loader2 className="w-10 h-10 animate-spin mb-3" />
                    <span className="font-medium">
                      {uploadStatus === 'uploading' ? 'Uploading...' : 'AI is analyzing...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
              {chatData.summary && (
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-white">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 leading-relaxed mb-4">{chatData.summary}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        {chatData.topics.map((t, i) => (
                          <button 
                            key={i}
                            onClick={() => sendMessage(`Please explain more about "${t.title}".`)}
                            className="text-left p-3 bg-indigo-50/50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all flex items-center gap-3 group cursor-pointer"
                          >
                            <span className="text-xl">{t.emoji}</span>
                            <div>
                              <div className="font-bold text-indigo-900 text-sm group-hover:text-indigo-700">{t.title}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{t.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {chatData.history.map((msg, i) => (
                <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role !== 'user' && (
                    <div className="w-8 h-8 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-white mt-1">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  )}
                  <div className={`p-4 rounded-2xl max-w-[80%] leading-relaxed shadow-sm text-sm md:text-base 
                    ${msg.role === 'user' ? 'bg-gray-900 text-white rounded-tr-none' : 'bg-white border border-gray-100 rounded-tl-none'}`}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              
              {isSending && (
                 <div className="flex gap-4">
                   <div className="w-8 h-8 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-white">
                     <Loader2 className="w-4 h-4 animate-spin" />
                   </div>
                   <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-gray-100 text-gray-500 text-sm">
                     Thinking...
                   </div>
                 </div>
              )}
              <div className="h-4"></div>
            </div>
          )}
        </div>

        {currentDocId && (
          <div className="absolute bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto relative">
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about the document..." 
                className="w-full bg-gray-100 border-0 rounded-full py-4 pl-6 pr-14 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
              />
              <button 
                onClick={() => sendMessage()}
                disabled={isSending || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default UserChat;