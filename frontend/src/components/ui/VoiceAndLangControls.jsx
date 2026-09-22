import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Mic, MicOff, Globe, Sparkles } from 'lucide-react';
import { LANGUAGES, speakText, stopSpeech, startVoiceRecognition, t } from '../../utils/i18n';
import toast from 'react-hot-toast';

/** Animated 3-dots thinking indicator (...) */
export function ThinkingDots({ label, color = '#a78bfa' }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 14px',
      background: 'rgba(99, 102, 241, 0.12)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: 20,
      fontSize: 12.5,
      fontWeight: 600,
      color: color,
    }}>
      <Sparkles size={14} className="spin" color={color} />
      <span>{label || 'AI is thinking'}</span>
      <span className="thinking-dots" style={{ marginLeft: 2 }}>
        <span className="thinking-dot" style={{ backgroundColor: color }} />
        <span className="thinking-dot" style={{ backgroundColor: color }} />
        <span className="thinking-dot" style={{ backgroundColor: color }} />
      </span>
    </div>
  );
}

/** Language selector component (English, Hindi, Telugu) */
export function LanguageSelector({ selectedLang, onChange }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 8,
      padding: 3,
    }}>
      <Globe size={14} color="#94a3b8" style={{ margin: '0 4px' }} />
      {LANGUAGES.map((l) => {
        const active = selectedLang === l.code;
        return (
          <button
            key={l.code}
            onClick={() => onChange(l.code)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 9px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: active ? 700 : 500,
              background: active ? '#6366f1' : 'transparent',
              color: active ? '#ffffff' : '#cbd5e1',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={`Switch to ${l.label}`}
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Voice Speaker (Text-To-Speech) Button */
export function VoiceSpeaker({ text, lang = 'en' }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handleToggle = () => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
    } else {
      if (!text) {
        toast.error('No text available to speak');
        return;
      }
      setIsSpeaking(true);
      speakText(
        text,
        lang,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false),
        (err) => {
          setIsSpeaking(false);
          toast.error('Voice playback error');
        }
      );
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
        color: isSpeaking ? '#f87171' : '#818cf8',
        border: `1px solid ${isSpeaking ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      title={isSpeaking ? t('stopVoice', lang) : t('listenVoice', lang)}
    >
      {isSpeaking ? (
        <>
          <VolumeX size={14} className="pulse-mic" />
          <span>{t('stopVoice', lang)}</span>
        </>
      ) : (
        <>
          <Volume2 size={14} />
          <span>{t('listenVoice', lang)}</span>
        </>
      )}
    </button>
  );
}

/** Voice Dictation (Microphone) Button */
export function MicDictation({ onTranscript, lang = 'en' }) {
  const [isListening, setIsListening] = useState(false);

  const handleListen = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    toast(t('listening', lang), { icon: '🎙️' });

    startVoiceRecognition(
      lang,
      (transcript) => {
        setIsListening(false);
        if (transcript && onTranscript) {
          onTranscript(transcript);
          toast.success(`Voice captured: "${transcript}"`);
        }
      },
      (err) => {
        setIsListening(false);
        toast.error(`Mic error: ${err}`);
      },
      () => {
        setIsListening(false);
      }
    );
  };

  return (
    <button
      type="button"
      onClick={handleListen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        padding: '6px 10px',
        borderRadius: 6,
        background: isListening ? '#ef4444' : '#334155',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      title={isListening ? t('listening', lang) : t('micSpeak', lang)}
    >
      {isListening ? <MicOff size={14} className="pulse-mic" /> : <Mic size={14} />}
    </button>
  );
}
