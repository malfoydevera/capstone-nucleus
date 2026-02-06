import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Sparkles, ChevronRight, Paperclip } from 'lucide-react';

const TypingMessage = ({ content, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (index < content.length) {
      // Increased speed: revealing 2-3 characters at a time for a snappier feel
      const timeout = setTimeout(() => {
        setDisplayedText(content.slice(0, index + 3));
        setIndex((prev) => prev + 3);
      }, 10); 
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [index, content, onComplete]);

  return <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayedText}</p>;
};

const ResearchChat = ({ paperId, fileUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (text = input) => {
    const messageContent = text.trim();
    if (!messageContent || isLoading) return;

    const userMessage = { id: Date.now(), type: 'user', content: messageContent };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5001/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId, fileUrl, message: messageContent })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: data.response,
        isNew: true 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'error',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-8 right-8 bg-white border border-slate-200 text-slate-700 rounded-full px-6 py-3 shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center gap-3 z-40 group hover:scale-105 animate-fadeIn"
        >
          <div className="w-8 h-8 rounded-full gemini-gradient flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <span className="font-semibold text-sm">Analyze with AI</span>
        </button>
      )}

      {/* Backdrop with smooth Fade */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 transition-opacity duration-500 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer with smooth Slide Out */}
      <div
        className={`fixed top-0 right-0 h-full bg-white shadow-2xl z-50 transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform flex flex-col ${
          isOpen ? 'translate-x-0 w-full md:w-[450px]' : 'translate-x-full w-full md:w-[450px]'
        }`}
      >
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gemini-gradient flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Research Assistant</h3>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Powered by Gemini AI</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {/* Suggestions remain visible at the top */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-4">
            <p className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Suggested Actions</p>
            <div className="flex flex-wrap gap-2">
              {["Summarize Findings", "Explain Methodology", "Key Contributions"].map((suggestion) => (
                <button 
                  key={suggestion}
                  onClick={() => handleSendMessage(suggestion)}
                  className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-all shadow-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.type === 'user'
                  ? 'bg-slate-900 text-white rounded-tr-none shadow-md'
                  : msg.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-100 text-xs'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'
              }`}>
                {msg.type === 'ai' && msg.isNew ? (
                  <TypingMessage 
                    content={msg.content} 
                    onComplete={() => {
                      msg.isNew = false;
                      scrollToBottom();
                    }} 
                  />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start animate-fadeIn">
              <div className="w-full max-w-[85%] rounded-2xl p-4 animate-shimmer border border-blue-100 rounded-tl-none">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-xs font-medium text-slate-500 italic">Analyzing context...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-6 border-t border-slate-100 bg-white">
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
               <Paperclip className="w-4 h-4" />
            </div>
            <textarea
              rows="1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Message your assistant..."
              className="w-full pl-11 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl gemini-gradient text-white shadow-md disabled:opacity-30 transition-all hover:scale-105"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResearchChat;