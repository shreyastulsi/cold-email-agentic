"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Loader as LoaderIcon,
  Plus,
  Send as SendIcon,
  X as XIcon,
} from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { JollyDateRangePicker } from "./jolly-date-range-picker";

const BACKEND_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:8000";

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface Integration {
    name: string;
    description: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    
    return (
      <div className={cn(
        "relative",
        containerClassName
      )}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {showRing && isFocused && (
          <motion.span 
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-blue-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div 
            className="absolute bottom-2 right-2 opacity-0 w-2 h-2 bg-blue-500 rounded-full"
            style={{
              animation: 'none',
            }}
            id="textarea-ripple"
          />
        )}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export function AnimatedAIChat() {
    const [value, setValue] = useState("");
    const [attachments, setAttachments] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [showIntegrations, setShowIntegrations] = useState(false);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 150,
        maxHeight: 400,
    });
    const [inputFocused, setInputFocused] = useState(false);
    const integrationsRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<'chat' | 'report'>("chat");
    const [reportDetails, setReportDetails] = useState("");
    const [reportDateRange, setReportDateRange] = useState<any>(null);
    const [apiMessage, setApiMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
    const integrations: Integration[] = [
        { name: "Google Drive", description: "Connect to your Google Drive files" },
        { name: "Gmail", description: "Integrate with your Gmail account" },
        { name: "Google Sheets", description: "Access your Google Sheets" },
        { name: "Google Docs", description: "Connect to Google Docs" },
    ];

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({ x: e.clientX, y: e.clientY });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const integrationsButton = document.querySelector('[data-integrations-button]');
            
            if (integrationsRef.current && 
                !integrationsRef.current.contains(target) && 
                !integrationsButton?.contains(target)) {
                setShowIntegrations(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (mode === "chat") {
                if (value.trim()) {
                    handleSendMessage();
                }
            } else if (mode === "report") {
                if (reportDetails.trim() && reportDateRange?.start && reportDateRange?.end) {
                    handleSendMessage();
                }
            }
        }
    };

    const handleSendMessage = async () => {
        setApiMessage(null);
        if (mode === "chat") {
            if (!reportDateRange?.start || !reportDateRange?.end) {
                setApiMessage({ type: 'error', text: 'Please select a valid date range.' });
                return;
            }

            let startDate, endDate;
            try {
                startDate = new Date(reportDateRange.start);
                endDate = new Date(reportDateRange.end);
                if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                    throw new Error("Invalid date from picker");
                }
            } catch (e) {
                setApiMessage({ type: 'error', text: 'The selected date range is invalid. Please try selecting it again.' });
                return;
            }

            startTransition(async () => {
                setIsTyping(true);
                try {
                    const payload = {
                        start_date: formatDate(startDate),
                        end_date: formatDate(endDate),
                        additional_context: value.trim() || null,
                    };
                    const response = await axios.post(
                        `${BACKEND_URL}/generate-overall-report`,
                        payload,
                        { withCredentials: true }
                    );
                    setApiMessage({ type: 'success', text: response.data.message });
                    setValue("");
                    setReportDateRange(null);
                    adjustHeight(true);
                } catch (error: any) {
                    setApiMessage({ type: 'error', text: error.response?.data?.detail || 'An unknown error occurred.' });
                } finally {
                    setIsTyping(false);
                }
            });
        } else if (mode === "report") {
            if (reportDetails.trim() && reportDateRange?.start && reportDateRange?.end) {
                startTransition(() => {
                    setIsTyping(true);
                    setTimeout(() => {
                        setIsTyping(false);
                        setReportDetails("");
                        setReportDateRange(null);
                    }, 3000);
                });
            }
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };
    
    const selectIntegration = (integration: Integration) => {
        setAttachments(prev => [...prev, integration.name]);
        setShowIntegrations(false);
    };

    return (
        <Card className="flex flex-col bg-zinc-900 text-white border-4 border-black w-full h-full">
      <CardHeader className="flex flex-col pb-0 space-y-1">
        <div className="text-left w-full">
          <CardTitle>AI Assistant</CardTitle>
          {/* <CardDescription className="text-sm text-white/60">Ask anything or get help instantly</CardDescription> */}
        </div>
            <div className="mt-2 w-full flex justify-center">
              <div className="relative flex items-center w-80 h-10 bg-gray-800 rounded-full select-none">
                <span
                  className={
                    'flex-1 text-center z-10 cursor-pointer font-medium text-sm transition-colors ' +
                    (mode === 'chat' ? 'text-[#0A0A0B] font-bold' : 'text-white/60')
                  }
                  onClick={() => setMode('chat')}
                >
                  Report Generation
                </span>
                <span
                  className={
                    'flex-1 text-center z-10 cursor-pointer font-medium text-sm transition-colors ' +
                    (mode === 'report' ? 'text-[#0A0A0B] font-bold' : 'text-white/60')
                  }
                  onClick={() => setMode('report')}
                >
                  Specific Inquiries
                </span>
                <span
                  className="absolute top-1 left-1 w-[calc(50%-0.25rem)] h-8 bg-white rounded-full shadow transition-all duration-300"
                  style={{
                    transform: mode === 'report' ? 'translateX(100%)' : 'translateX(0%)',
                    transition: 'transform 0.3s cubic-bezier(.4,2,.6,1)',
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center px-2 pt-2 sm:px-4 sm:pt-4 border-t border-gray-800">
            <div className="w-full max-w-full mx-auto relative">
              <motion.div 
                className="relative z-10 space-y-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <AnimatePresence>
                    {apiMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className={`mb-2 text-center text-xs p-2 rounded-md ${
                                apiMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}
                        >
                            {apiMessage.text}
                        </motion.div>
                    )}
                </AnimatePresence>
                {mode === 'chat' && (
                  <div className="text-center space-y-1">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="inline-block"
                    >
                      <h1 
                        style={{ fontSize: "26px" }}
                        className="font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1"
                      >
                        Generate a Custom Report
                      </h1>
                      <motion.div 
                        className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "100%", opacity: 1 }}
                        transition={{ delay: 0.5, duration: 0.8 }}
                      />
                    </motion.div>
                    <motion.p 
                      className="text-xs text-white/40 mb-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      Select a date range and if you want, provide optional specificities for your report.
                    </motion.p>
                    <div className="flex flex-col gap-2 items-center">
                      <JollyDateRangePicker
                        value={reportDateRange}
                        onChange={setReportDateRange}
                        label="Date Range"
                      />
                    </div>
                  </div>
                  
                )}
                {mode === 'report' && (
                  <div className="space-y-4">
                    <div className="text-center space-y-1">
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                        className="inline-block"
                      >
                        <h1
                          style={{ fontSize: "26px" }}
                          className="font-medium tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white/90 to-white/40 pb-1"
                        >
                          How Can I Help You?
                        </h1>
                        <motion.div
                          className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: "100%", opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.8 }}
                        />
                      </motion.div>
                      <motion.p
                        className="text-xs text-white/40 mb-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                      >
                        Type a command or ask a question
                      </motion.p>
                    </div>
                    <div className="flex flex-col gap-2 items-center">
                      <JollyDateRangePicker
                        value={reportDateRange}
                        onChange={setReportDateRange}
                        label="Date Range"
                      />
                      <input
                        type="text"
                        className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none"
                        placeholder="e.g. Defect breakdown, pass/fail rate, etc."
                        value={reportDetails}
                        onChange={e => setReportDetails(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <motion.div 
                  className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl"
                  initial={{ scale: 0.98 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <AnimatePresence>
                    {showIntegrations && (
                      <motion.div 
                        ref={integrationsRef}
                        className="absolute left-4 right-4 bottom-full mb-2 backdrop-blur-xl bg-black/90 rounded-lg z-50 shadow-lg border border-white/10 overflow-hidden"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="py-1 bg-black/95">
                          {integrations.map((integration, index) => (
                            <motion.div
                              key={integration.name}
                              className="flex flex-col gap-1 px-3 py-2 text-xs transition-colors cursor-pointer hover:bg-white/5 text-white/70 hover:text-white"
                              onClick={() => selectIntegration(integration)}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.03 }}
                            >
                              <div className="font-medium">{integration.name}</div>
                              <div className="text-white/40 text-xs">
                                {integration.description}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="p-2">
                    {mode === 'chat' && (
                      <Textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value);
                          adjustHeight();
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                        placeholder="OPTIONAL: Ask about metrics, filter based on fractures, etc."
                        containerClassName="w-full"
                        className={cn(
                          "w-full px-2 py-2",
                          "resize-none",
                          "bg-transparent",
                          "border-none",
                          "text-white/90 text-xs",
                          "focus:outline-none",
                          "placeholder:text-white/20",
                          "min-h-[180px]"
                        )}
                        style={{
                          overflow: "hidden",
                        }}
                        showRing={false}
                      />
                    )}
                  </div>
                  <AnimatePresence>
                    {attachments.length > 0 && (
                      <motion.div 
                        className="px-2 pb-2 flex gap-2 flex-wrap"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {attachments.map((integration, index) => (
                          <motion.div
                            key={index}
                            className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <span>{integration}</span>
                            <button 
                              onClick={() => removeAttachment(index)}
                              className="text-white/40 hover:text-white transition-colors"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="p-2 border-t border-white/[0.05] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <motion.button
                        type="button"
                        data-integrations-button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowIntegrations(prev => !prev);
                        }}
                        whileTap={{ scale: 0.94 }}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 text-white/60 hover:text-white/90 rounded-lg transition-colors relative group",
                          showIntegrations && "bg-white/10 text-white/90"
                        )}
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-xs">Add Integrations</span>
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform",
                          showIntegrations && "rotate-180"
                        )} />
                        <motion.span
                          className="absolute inset-0 bg-white/[0.05] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          layoutId="button-highlight"
                        />
                      </motion.button>
                    </div>
                    <motion.button
                      type="button"
                      onClick={handleSendMessage}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={isTyping || (mode === 'chat' ? !(reportDateRange?.start && reportDateRange?.end) : !(reportDetails.trim() && reportDateRange?.start && reportDateRange?.end))}
                      className={cn(
                        "px-2 py-1 rounded-lg text-xs font-medium transition-all",
                        "flex items-center gap-2",
                        mode === 'chat'
                          ? (value.trim() ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10" : "bg-white/[0.05] text-white/40")
                          : (reportDetails.trim() && reportDateRange?.start && reportDateRange?.end ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10" : "bg-white/[0.05] text-white/40")
                      )}
                    >
                      {isTyping ? (
                        <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                      ) : (
                        <SendIcon className="w-4 h-4" />
                      )}
                      <span className="text-[14px]">Send</span>
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      );
}

function TypingDots() {
    return (
        <div className="flex items-center ml-1">
            {[1, 2, 3].map((dot) => (
                <motion.div
                    key={dot}
                    className="w-1.5 h-1.5 bg-white/90 rounded-full mx-0.5"
                    initial={{ opacity: 0.3 }}
                    animate={{ 
                        opacity: [0.3, 0.9, 0.3],
                        scale: [0.85, 1.1, 0.85]
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.15,
                        ease: "easeInOut",
                    }}
                    style={{
                        boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)"
                    }}
                />
            ))}
        </div>
    );
} 