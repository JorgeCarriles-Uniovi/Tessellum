import React, { useState, useEffect, useRef } from 'react';

interface InputModalProps {
    isOpen: boolean;
    title: string;
    initialValue?: string;
    confirmLabel?: string;
    onClose: () => void;
    onConfirm: (value: string) => void;
}

export function InputModal({ isOpen, title, initialValue = "", confirmLabel = "Create", onClose, onConfirm }: InputModalProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opening
    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (value.trim()) {
            onConfirm(value.trim());
            onClose();
        }
    };

    return (
        // Backdrop
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit} className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>

                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Enter name..."
                    />

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}