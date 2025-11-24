import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Upload, FileText, Sparkles, MessageSquare, Send, Loader2, 
  Menu, Plus, Trash2, X, MessageCircle 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

function App() {
  // === 全局状态 ===
  const [sessions, setSessions] = useState([]); // 侧边栏列表
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // 侧边栏开关
  const [currentDocId, setCurrentDocId] = useState(null); // 当前选中的会话ID (null代表新对话页面)

  // === 上传/新建对话相关状态 ===
  const [inputTitle, setInputTitle] = useState(''); // 新建对话时的命名
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, analyzing

  // === 当前聊天窗口状态 ===
  const [chatData, setChatData] = useState({
    summary: '',
    topics: [],
    history: []
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);

  // 1. 初始化加载会话列表
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/sessions');
      setSessions(res.data);
    } catch (e) {
      console.error("加载列表失败", e);
    }
  };

  // 2. 切换会话 (加载历史)
  const loadSession = async (id) => {
    try {
      setCurrentDocId(id);
      // 清空当前视图，显示加载中（可选）
      const res = await axios.get(`http://localhost:3001/api/sessions/${id}`);
      setChatData({
        summary: res.data.summary,
        topics: res.data.topics,
        history: res.data.chatHistory.map(chat => ({
          role: chat.role,
          content: chat.content
        }))
      });
      // 在移动端自动收起侧边栏
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (e) {
      console.error("加载详情失败", e);
    }
  };

  // 3. 删除会话
  const deleteSession = async (e, id) => {
    e.stopPropagation(); // 防止触发点击事件
    if (!confirm("确定要删除这个对话吗？")) return;
    
    try {
      await axios.delete(`http://localhost:3001/api/sessions/${id}`);
      fetchSessions(); // 刷新列表
      if (currentDocId === id) createNewSession(); // 如果删的是当前选中的，回到新建页
    } catch (e) {
      alert("删除失败");
    }
  };

  // 4. 进入“新建对话”模式
  const createNewSession = () => {
    setCurrentDocId(null);
    setInputTitle('');
    setUploadStatus('idle');
    setChatData({ summary: '', topics: [], history: [] });
  };

  // 5. 处理文件上传
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 如果用户没填标题，默认用文件名
    const titleToSend = inputTitle.trim() || file.name;

    setUploadStatus('uploading');
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', titleToSend); // ✨ 发送标题

    try {
      setUploadStatus('analyzing');
      const res = await axios.post('http://localhost:3001/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // 上传成功后
      await fetchSessions(); // 刷新侧边栏
      loadSession(res.data.documentId); // 直接进入该会话
      setUploadStatus('idle');

    } catch (e) {
      console.error(e);
      alert("分析失败");
      setUploadStatus('idle');
    }
  };

  // 6. 发送消息
  const sendMessage = async (msg) => {
    const text = msg || inputMessage;
    if (!text.trim() || !currentDocId) return;

    // 乐观更新 UI
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
        history: [...prev.history, { role: 'ai', content: "❌ 发送失败，请重试。" }]
      }));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800 overflow-hidden">
      
      {/* === 左侧侧边栏 === */}
      <aside 
        className={`${isSidebarOpen ? 'w-72 translate-x-0' : 'w-0 -translate-x-full'} 
        bg-gray-900 text-white transition-all duration-300 ease-in-out flex flex-col fixed md:relative z-20 h-full shadow-2xl`}
      >
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-gray-800">
          <div className="font-bold text-lg flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span className={`${!isSidebarOpen && 'opacity-0'}`}>History</span>
          </div>
          {/* 移动端关闭按钮 */}
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-gray-800 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 新建对话按钮 */}
        <div className="p-4">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">New Analysis</span>
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
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

        {/* 底部用户信息区域 (占位) */}
        <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
          Anti-Displacement Reader v1.0
        </div>
      </aside>

      {/* === 右侧主内容区 === */}
      <main className="flex-1 flex flex-col h-full w-full relative">
        
        {/* 顶部导航栏 */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center px-4 justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-serif text-xl font-bold text-indigo-800 tracking-wide hidden sm:block">
              Anti-Displacement Reader
            </h1>
          </div>
        </header>

        {/* 内容滚动区 */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative">
          
          {/* 情况 A: 新建对话页面 */}
          {!currentDocId ? (
            <div className="flex flex-col items-center justify-center min-h-full p-6 animate-in fade-in duration-500">
              <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-600">
                  <Upload className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">开始新的分析</h2>
                <p className="text-gray-500 mb-8">上传 PDF 文档，AI 将为您提取核心主题并回答问题。</p>
                
                {/* 1. 命名输入框 */}
                <div className="mb-6 text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1 ml-1">对话名称 (可选)</label>
                  <input 
                    type="text" 
                    value={inputTitle}
                    onChange={(e) => setInputTitle(e.target.value)}
                    placeholder="例如：2025城市规划草案..." 
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>

                {/* 2. 上传按钮 */}
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
                      className="w-full py-4 bg-gray-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg group-hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <FileText className="w-5 h-5" />
                      选择 PDF 文件
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 text-indigo-600">
                    <Loader2 className="w-10 h-10 animate-spin mb-3" />
                    <span className="font-medium">
                      {uploadStatus === 'uploading' ? '正在上传...' : 'AI 正在深入分析...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            
            /* 情况 B: 聊天界面 */
            <div className="max-w-4xl mx-auto p-6 space-y-8 pb-32">
              
              {/* 综述卡片 */}
              {chatData.summary && (
                <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm animate-in slide-in-from-bottom-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex-shrink-0 flex items-center justify-center text-white">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 leading-relaxed mb-4">{chatData.summary}</p>
                      
                      {/* 主题按钮 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                        {chatData.topics.map((t, i) => (
                          <button 
                            key={i}
                            onClick={() => sendMessage(`请详细介绍关于“${t.title}”的内容。`)}
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

              {/* 历史消息 */}
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
                     思考中...
                   </div>
                 </div>
              )}
              
              {/* 底部占位，防止被输入框遮挡 */}
              <div className="h-4"></div>
            </div>
          )}
        </div>

        {/* 底部输入框 (仅在聊天模式显示) */}
        {currentDocId && (
          <div className="absolute bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto relative">
              <input 
                type="text" 
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="询问文档内容..." 
                className="w-full bg-gray-100 border-0 rounded-full py-4 pl-6 pr-14 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
              />
              <button 
                onClick={() => sendMessage()}
                disabled={isSending || !inputMessage.trim()}
                className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
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

export default App;