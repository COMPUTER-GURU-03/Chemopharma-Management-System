import { IconX } from "./Icons.jsx";

export default function Modal({ title, onClose, children, width }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><IconX width={16} height={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
