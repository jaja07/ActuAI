import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  FileText, 
  Thermometer, 
  Bot, 
  User, 
  Check, 
  Sparkles, 
  Download, 
  Share2, 
  Cpu 
} from 'lucide-react';
import { ValidationTask } from '../types';
import { fetchWithAuth } from '../api';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  sources?: Array<{ label: string; icon: 'file' | 'temp' }>;
}

interface RagSynthesisViewProps {
  onStatusChange?: (statusMessage: string, success: boolean) => void;
  activeTask?: ValidationTask;
}

export default function RagSynthesisView({ onStatusChange, activeTask }: RagSynthesisViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'ai',
      text: "Based on the uploaded documents for Project Skyward, here is the synthesis of the root cause regarding the micro-fractures in component X-99:\n\nThe primary root cause identified in the 8D report is an improper thermal cycling process during the curing phase at the supplier's secondary facility. The temperature dropped 15°C below the specified threshold for a period of 45 minutes during curing.",
      sources: [
        { label: '8D_Report_PO-456.pdf (Pg 3)', icon: 'file' },
        { label: 'Thermal_Log_Batch_A.csv', icon: 'temp' }
      ]
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputText.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    const requestedQuery = inputText.trim().toLowerCase();
    setInputText('');
    setIsTyping(true);

    // Simulate smart agent responses
    setTimeout(() => {
      let aiResponseText = "Analyzing specified flight telemetry and manufacturing tolerances... ";
      let citedSources: Array<{ label: string; icon: 'file' | 'temp' }> = [];

      if (requestedQuery.includes('fracture') || requestedQuery.includes('cause')) {
        aiResponseText = "Correct, metallurgical stress testing reinforces that the 45-minute temperature dip led to tensile weakness in the titanium-alloy lattices of X-99. Stress cracking became evident at load thresholds above 120% nominal design weight.";
        citedSources = [{ label: 'Structural_Load_Specs_V4.pdf (Pg 12)', icon: 'file' }];
      } else if (requestedQuery.includes('batch') || requestedQuery.includes('supplier')) {
        aiResponseText = "Batch records indicate the curing anomaly occurred only in Batch #A-204 manufactured at the Dresden secondary plant. Standard operating procedures have been modified to enforce dual thermal probe redundant sensors.";
        citedSources = [{ label: 'QAC_Audit_Dresden_AppV.xlsx', icon: 'file' }];
      } else {
        aiResponseText = "ActuAI synthesis confirmed. The engineering specs for component X-99 indicate high resilience, meaning the anomaly is confined entirely to the thermal deviation cited in Dresden batch logs. No fleet-wide safety bulletins are recommended at this point.";
        citedSources = [{ label: 'Aero_Design_Standard_T9.pdf (Pg 88)', icon: 'file' }];
      }

      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        sources: citedSources
      }]);
    }, 1200);
  };

  const handlePublish = async () => {
    if (!activeTask) {
      alert("No active task selected.");
      return;
    }
    
    setIsPublished(true);
    try {
      await fetchWithAuth(`/tasks/${activeTask.id}/approve`, { method: 'POST' });
      if (onStatusChange) {
        onStatusChange("Successfully published synthesis output to team workspace and archived under operations log!", true);
      }
    } catch (err: any) {
      if (onStatusChange) {
        onStatusChange(`Publish failed: ${err.message}`, false);
      }
      setIsPublished(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header section */}
      <div className="p-6 border-b border-outline-variant bg-surface-container-lowest flex justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-label-md font-label-md text-primary bg-primary/10 px-2.5 py-1 rounded font-bold font-mono">
              Project 'Skyward'
            </span>
            <span className="text-label-md font-label-md text-on-surface-variant font-semibold">
              Aerospace Traceability
            </span>
          </div>
          <h2 className="text-headline-md font-headline-md text-on-surface">
            8D Report Analysis
          </h2>
        </div>

        <div>
          <button 
            onClick={handlePublish}
            disabled={isPublished}
            className={`px-4 py-2 text-on-primary rounded-DEFAULT font-label-md text-label-md transition-all flex items-center gap-2 shadow-sm font-semibold cursor-pointer ${
              isPublished ? 'bg-emerald-600' : 'bg-primary hover:bg-primary/95 hover:scale-[1.01]'
            }`}
          >
            {isPublished ? (
              <>
                <Check className="w-4 h-4 animate-ping" /> Publishing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-inverse-primary" /> Publish Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable chat feedback canvas */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-surface-bright">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.map((message) => {
            const isAI = message.sender === 'ai';
            return (
              <div 
                key={message.id} 
                className={`flex gap-4 animate-fade-in ${
                  isAI ? 'justify-start' : 'justify-end flex-row-reverse'
                }`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 font-semibold ${
                  isAI 
                    ? 'bg-primary text-on-primary border border-outline' 
                    : 'bg-secondary text-white'
                }`}>
                  {isAI ? (
                    <Bot className="w-4 h-4 text-inverse-primary" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble dialog border */}
                <div className={`max-w-[85%] rounded-lg p-5 shadow-xs border ${
                  isAI 
                    ? 'bg-surface-container-lowest border-outline-variant text-on-surface' 
                    : 'bg-primary text-white border-primary border-r-4'
                }`}>
                  <p className="text-body-md leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>

                  {/* Citation chips section */}
                  {isAI && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.sources.map((src, i) => (
                        <span 
                          key={i}
                          onClick={() => alert(`Reviewing source document specifications for file: ${src.label}`)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-surface-container text-on-surface-variant text-[11px] font-code-md rounded-full border border-outline-variant hover:bg-surface-container-high cursor-pointer transition-colors"
                        >
                          {src.icon === 'file' ? (
                            <FileText className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Thermometer className="w-3.5 h-3.5 text-error" />
                          )}
                          <span>Source: {src.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* AI typing simulation loop */}
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
            placeholder="Ask ActuAI for more details, telemetry stats, or report exports..."
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
