import React from 'react';

export const Button = ({ onClick, children, className }) => {
    return (
        <button onClick={onClick} className={`btn ${className}`}>
            {children}
        </button>
    );
};

export const Input = ({ type, placeholder, value, onChange, className }) => {
    return (
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className={`input ${className}`}
        />
    );
};

export const Modal = ({ isOpen, onClose, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button onClick={onClose} className="modal-close">
                    &times;
                </button>
                {children}
            </div>
        </div>
    );
};