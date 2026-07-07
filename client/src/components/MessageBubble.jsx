import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiChevronDown, FiChevronRight, FiFileText } from 'react-icons/fi';

export default function MessageBubble({ message }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isUser = message.role === 'user';

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className={`bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {isUser ? (
          <p className="message-text">{message.content}</p>
        ) : (
          <div className="markdown-content">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="sources-section">
            <button
              className="sources-toggle"
              onClick={() => setSourcesOpen(!sourcesOpen)}
            >
              {sourcesOpen ? <FiChevronDown /> : <FiChevronRight />}
              <span>View Sources ({message.sources.length})</span>
            </button>
            {sourcesOpen && (
              <ul className="sources-list">
                {message.sources.map((src, i) => (
                  <li key={i} className="source-item">
                    <FiFileText className="source-icon" />
                    <div className="source-content">
                      {src.filename && (
                        <span className="source-filename">{src.filename}</span>
                      )}
                      <p className="source-text">
                        {src.text || src.content || JSON.stringify(src)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <span className="message-time">{formatTime(message.timestamp)}</span>
    </div>
  );
}
