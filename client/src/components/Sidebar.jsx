import { useRef } from 'react';
import { HiOutlineDocumentText, HiOutlineTrash, HiOutlineUpload } from 'react-icons/hi';
import { FiCpu, FiX } from 'react-icons/fi';

export default function Sidebar({ documents, uploading, onUpload, onDelete, isOpen, onToggle }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onUpload(file);
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <FiCpu className="logo-icon" />
          <span className="logo-text">DocChat</span>
        </div>
        <button className="sidebar-close-btn" onClick={onToggle} aria-label="Close sidebar">
          <FiX />
        </button>
      </div>

      <div
        className="upload-zone"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          hidden
        />
        {uploading ? (
          <div className="upload-loading">
            <div className="spinner" />
            <span>Processing PDF...</span>
          </div>
        ) : (
          <>
            <HiOutlineUpload className="upload-icon" />
            <span className="upload-text">Upload PDF</span>
            <span className="upload-hint">or drag & drop</span>
          </>
        )}
      </div>

      <div className="documents-section">
        <h3 className="section-title">Documents</h3>
        {documents.length === 0 ? (
          <p className="empty-docs">No documents yet</p>
        ) : (
          <ul className="document-list">
            {documents.map((doc) => (
              <li key={doc.id || doc.filename} className="document-item">
                <HiOutlineDocumentText className="doc-icon" />
                <div className="doc-info">
                  <span className="doc-name" title={doc.filename || doc.name}>
                    {doc.filename || doc.name}
                  </span>
                  {doc.chunks != null && (
                    <span className="doc-chunks">{doc.chunks} chunks</span>
                  )}
                </div>
                <button
                  className="delete-btn"
                  onClick={() => onDelete(doc.id)}
                  aria-label={`Delete ${doc.filename || doc.name}`}
                >
                  <HiOutlineTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
