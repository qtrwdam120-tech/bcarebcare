import React, { useState, memo, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

interface NafadInputProps {
  onSend: (code: string) => void;
  isLoading: boolean;
  placeholder?: string;
  isOtp?: boolean;
  variant?: 'full' | 'compact';
  buttonText?: string;
  buttonIcon?: string;
}

// Stable key that doesn't change on parent re-renders
let inputCounter = 0;
const getStableKey = () => `nafad-input-${++inputCounter}`;

export interface NafadInputRef {
  focus: () => void;
  clear: () => void;
}

const NafadInput = forwardRef<NafadInputRef, NafadInputProps>(function NafadInput({ 
  onSend, 
  isLoading, 
  placeholder = "أدخل رمز النفاذ...",
  isOtp = false,
  variant = 'full',
  buttonText = "إرسال رمز النفاذ",
  buttonIcon = "📤"
}, ref) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const stableKey = useRef(getStableKey());

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => setCode(''),
  }));

  // Prevent re-renders from resetting input state
  const handleSend = () => {
    if (code.trim()) {
      onSend(code);
      setCode('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim()) {
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    if (isOtp) {
      value = value.replace(/\D/g, "").slice(0, 2);
    }
    setCode(value);
  };

  if (variant === 'compact') {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          key={stableKey.current} // Force new element on remount
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={code}
          onChange={handleChange}
          onKeyPress={handleKeyPress}
          style={{ 
            flex: 1, 
            padding: "10px 12px", 
            border: "1px solid #d1d5db", 
            borderRadius: 8, 
            fontSize: "0.875rem",
            textAlign: "center",
            letterSpacing: isOtp ? "0.2em" : "normal",
            direction: "ltr"
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !code}
          style={{ 
            padding: "10px 16px", 
            background: code ? "#2563eb" : "#9ca3af", 
            color: code ? "#ffffff" : "#f3f4f6", 
            borderRadius: 8, 
            fontSize: "0.875rem", 
            fontWeight: 700, 
            cursor: isLoading || !code ? "wait" : "pointer", 
            border: "none" 
          }}
        >
          {buttonText}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* حقل إدخال رمز النفاذ */}
      <input
        key={stableKey.current} // Force new element on remount
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={code}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        style={{ 
          width: "100%", 
          padding: "10px 12px", 
          border: "1px solid #d1d5db", 
          borderRadius: 8, 
          fontSize: "14px",
          textAlign: "center",
          letterSpacing: isOtp ? "0.2em" : "normal",
          direction: "ltr",
          marginBottom: 8
        }}
      />
      {/* زر إرسال رمز النفاذ */}
      <button 
        onClick={handleSend}
        disabled={isLoading || !code.trim()}
        style={{ 
          width: "100%", 
          padding: "10px 16px", 
          border: "none",
          borderRadius: 8, 
          background: code.trim() ? "#111827" : "#9ca3af", 
          color: "#ffffff", 
          fontWeight: 600, 
          cursor: isLoading || !code.trim() ? "wait" : "pointer"
        }}
      >
        {buttonIcon} {isLoading ? "جارٍ الإرسال..." : buttonText}
      </button>
    </>
  );
});

export default NafadInput;
