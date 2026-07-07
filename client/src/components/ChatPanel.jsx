import { useState, useRef, useEffect } from 'react';
import { FiSend, FiMenu } from 'react-icons/fi';
import { HiOutlineDocumentText, HiOutlineChatAlt2 } from 'react-icons/hi';
import MessageBubble from './MessageBubble';

export default function ChatPanel({ messages, loading, onSend, hasDocuments, sidebarOpen, onToggleSidebar }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    setInput('');
    onSend(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <main className={`chat-panel ${sidebarOpen ? '' : 'expanded'}`}>
      <div className="chat-header">
        {!sidebarOpen && (
          <button className="menu-btn" onClick={onToggleSidebar} aria-label="Open sidebar">
            <FiMenu />
          </button>
        )}
        <h2 className="chat-title">Chat</h2>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              {hasDocuments ? (
                <HiOutlineChatAlt2 className="empty-icon" />
              ) : (
                <HiOutlineDocumentText className="empty-icon" />
              )}
            </div>
            <h3 className="empty-title">
              {hasDocuments ? 'Ask a question' : 'Upload a PDF to get started'}
            </h3>
            <p className="empty-description">
              {hasDocuments
                ? 'Your documents are ready. Ask anything about their content.'
                : 'Drop a PDF in the sidebar and start chatting with your documents.'}
            </p>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && (
              <div className="message assistant">
                <div className="bubble assistant-bubble">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasDocuments ? 'Ask a question about your documents...' : 'Upload a document first...'}
            disabled={!hasDocuments}
            rows={1}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || loading || !hasDocuments}
            aria-label="Send message"
          >
            <FiSend />
          </button>
        </div>
      </div>
    </main>
  );
}
