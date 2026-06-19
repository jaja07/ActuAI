import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  FileText,
  Bot,
  User,
  Check,
  Sparkles,
} from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  sources?: string[];
}

interface RagSynthesisViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function RagSynthesisView({ onStatusChange, activeTask }: RagSynthesisViewProps) {
  // Seed the conversation with the real answer the Investigative agent
  // drafted for this task, instead of a canned demo message.
  const buildSeedMessages = (): ChatMessage[] => {
    if (!activeTask) return [];
    const payload = activeTask.payload || {};
    return [{
      id: `seed-${activeTask.id}`,
      sender: 'ai',
      text: payload.answer || activeTask.summary || 'No answer drafted.',
      sources: payload.sources || [],
    }];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(buildSeedMessages());
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  // Re-seed whenever the user switches to a different task.
  useEffect(() => {
    setMessages(buildSeedMessages());
    setIsPublished(activeTask?.status === 'EXECUTED');
  }, [activeTask?.id]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = { id: `usr-${Date.now()}`, sender: 'user', text: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    const question = inputText.trim();
    setInputText('');
    setIsTyping(true);

    try {
      // Runs a brand-new Supervisor -> Investigative cycle for this question
      // (a fresh RAG search against Qdrant), instead of a simulated reply.
      const response = await fetchWithAuth('/ingest/email', {
        method: 'POST',
        body: JSON.stringify({ sender: 'frontend-chat', subject: 'RAG query', body: question }),
      });
      const result = await response.json();
      const answer = result.payload?.answer || result.summary || 'No answer found.';
      const sources: string[] = result.payload?.sources || [];

      setMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: answer, sources }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`, sender: 'ai',
        text: `Query failed: ${err.message}`,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePublish = async () => {
    if (!activeTask) {
      onStatusChange?.('No active task selected.', false);
      return;
    }

    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      setIsPublished(true);
      onStatusChange?.('Synthesis reviewed and signed off — recorded in the audit trail.', true);
    } catch (err: any) {
      onStatusChange?.(`Publish failed: ${err.message}`, false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header section */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-primary bg-primary/10 px-2.5 py-1 rounded font-bold font-mono">
              {activeTask ? `TASK #${activeTask.id}` : 'RAG'}
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-semibold">
              Investigative Agent — Documentation Search
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            Retrieval-Augmented Synthesis
          </h2>
        </div>

        <div>
          <button
            onClick={handlePublish}
            disabled={isPublished || !activeTask}
            className={`px-4 py-2 text-on-primary rounded-DEFAULT font-label-md text-label-md transition-all flex items-center gap-2 shadow-sm font-semibold cursor-pointer disabled:opacity-60 ${
              isPublished ? 'bg-emerald-600' : 'bg-primary hover:bg-primary/95 hover:scale-[1.01]'
            }`}
          >
            {isPublished ? (
              <>
                <Check className="w-4 h-4" /> Validated
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-inverse-primary" /> Validate Answer
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable chat feedback canvas */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-surface-bright">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <p className="text-center text-on-surface-variant text-sm">
              Select a task from the inbox, or ask a question below to run a live search.
            </p>
          )}
          {messages.map((message) => {
            const isAI = message.sender === 'ai';
            return (
              <div
                key={message.id}
                className={`flex gap-4 animate-fade-in ${isAI ? 'justify-start' : 'justify-end flex-row-reverse'}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 font-semibold ${
                  isAI ? 'bg-primary text-on-primary border border-outline' : 'bg-secondary text-white'
                }`}>
                  {isAI ? <Bot className="w-4 h-4 text-inverse-primary" /> : <User className="w-4 h-4" />}
                </div>

                <div className={`max-w-[85%] rounded-lg p-5 shadow-xs border ${
                  isAI
                    ? 'bg-surface-container-lowest border-outline-variant text-on-surface'
                    : 'bg-primary text-white border-primary border-r-4'
                }`}>
                  <p className="text-body-md leading-relaxed whitespace-pre-wrap">{message.text}</p>

                  {isAI && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.sources.map((src, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container text-on-surface-variant text-[11px] font-code-md rounded-full border border-outline-variant"
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" />
                          <span>Source: {src}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center mt-1 border border-outline">
                <Bot className="w-4 h-4 text-inverse-primary animate-spin" />
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-5 py-3 shadow-xs">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant/40 animate-bounce delay-75"></span>
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant/60 animate-bounce delay-150"></span>
                  <span className="w-2 h-2 rounded-full bg-on-surface-variant/80 animate-bounce delay-300"></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Inquiry Input Area */}
      <div className="p-6 bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative">
          <input
            className="w-full bg-surface border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none rounded-lg py-4 pl-4 pr-12 text-body-md text-on-surface placeholder:text-on-surface-variant/50 shadow-xs"
            placeholder="Ask ActuAI about a document, certificate, or traceability record..."
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            title="Send inquiry"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary/70 transition-colors p-1.5 rounded-full cursor-pointer hover:bg-surface-container"
          >
            <Send className="w-5 h-5 text-primary" />
          </button>
        </form>
      </div>
    </div>
  );
}
