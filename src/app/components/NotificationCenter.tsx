import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "../api/notificationApi";
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  MessageSquare,
  AlertCircle,
  Clock,
  Sparkles,
  X,
  Loader2,
  FileText,
  ArrowRight,
} from "lucide-react";

interface NotificationCenterProps {
  onSelectTab?: (tab: string, bookingId?: number) => void;
  isLightHeader?: boolean;
}

export function NotificationCenter({
  onSelectTab,
  isLightHeader = false,
}: NotificationCenterProps) {
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<AppNotification | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async (showLoading = false) => {
    if (!accessToken) return;
    if (showLoading) setLoading(true);
    try {
      const data = await fetchNotifications(accessToken);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Initial load + periodic polling every 15s
  useEffect(() => {
    if (!user || !accessToken) return;

    loadNotifications(true);

    const interval = setInterval(() => {
      loadNotifications(false);
    }, 15000);

    return () => clearInterval(interval);
  }, [user, accessToken]);

  // Close the popover when the user scrolls on mobile to keep it in view.
  useEffect(() => {
    if (!isOpen) return;

    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    if (!isMobile) return;

    const handleScroll = () => {
      setIsOpen(false);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (
    notification: AppNotification,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!accessToken || notification.is_read) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) =>
        n.notification_id === notification.notification_id
          ? { ...n, is_read: true }
          : n,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await markNotificationRead(accessToken, notification.notification_id);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
      loadNotifications(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!accessToken || unreadCount === 0) return;
    setMarkingAll(true);

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsRead(accessToken);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      loadNotifications(false);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    // Always close the popover when a notification is clicked
    setIsOpen(false);

    // Show the detail modal instead of navigating immediately
    setSelectedNotification(notification);
    setShowDetailModal(true);

    // Mark as read if not already read and user has token (optimistic UI)
    if (!notification.is_read && accessToken) {
      markNotificationRead(accessToken, notification.notification_id).catch(
        console.error,
      );
      setNotifications((prev) =>
        prev.map((n) =>
          n.notification_id === notification.notification_id
            ? { ...n, is_read: true }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes("booking_confirmed"))
      return <Sparkles className="w-4 h-4 text-[#7A8C5C]" />;
    if (type.includes("booking_rejected") || type.includes("cancelled"))
      return <AlertCircle className="w-4 h-4 text-[#C4541A]" />;
    if (type.includes("payment"))
      return <CreditCard className="w-4 h-4 text-[#C8922A]" />;
    if (type.includes("event_reminder"))
      return <Calendar className="w-4 h-4 text-[#C8922A]" />;
    if (type.includes("feedback"))
      return <MessageSquare className="w-4 h-4 text-[#7A8C5C]" />;
    if (type.includes("venue_setup"))
      return <FileText className="w-4 h-4 text-[#C8922A]" />;
    return <Bell className="w-4 h-4 text-[#C8922A]" />;
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications(false);
        }}
        className={`relative p-2.5 rounded-full transition-all duration-200 cursor-pointer ${
          isLightHeader
            ? "hover:bg-[#2C1810]/5 text-[#2C1810]"
            : "hover:bg-[#F5F0E8]/10 text-[#F5F0E8]"
        }`}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-[#F5F0E8] bg-gradient-to-r from-[#C4541A] to-[#C8922A] rounded-full shadow-md animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className="fixed left-2 right-2 top-[4.75rem] max-h-[calc(100vh-5.5rem)] overflow-hidden bg-white rounded-2xl shadow-2xl border border-[#C8922A]/20 z-50 animate-in fade-in slide-in-from-top-2 duration-200 sm:absolute sm:right-0 sm:left-auto sm:top-full sm:mt-3 sm:w-96 sm:max-h-[32rem]">
          {/* Header */}
          <div className="bg-[#2C1810] px-4 py-3.5 flex items-center justify-between border-b border-[#C8922A]/20">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#C8922A]" />
              <h3 className="font-['Playfair_Display'] text-[#F5F0E8] text-base font-medium">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#C8922A]/20 text-[#C8922A] rounded-full border border-[#C8922A]/30">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="text-[11px] text-[#C8922A] hover:text-[#F5F0E8] flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[calc(100vh-10rem)] overflow-y-auto divide-y divide-[#C8922A]/10 sm:max-h-[380px]">
            {loading ? (
              <div className="py-12 text-center text-[#2C1810]/50 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#C8922A]" />
                <span className="text-xs font-['Lato']">
                  Loading notifications...
                </span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F5F0E8] text-[#2C1810]/40 flex items-center justify-center mx-auto mb-3">
                  <Bell size={22} />
                </div>
                <p className="font-['Playfair_Display'] text-[#2C1810] text-sm font-semibold">
                  No notifications yet
                </p>
                <p className="text-xs text-[#2C1810]/60 font-['Lato'] mt-1">
                  Updates on your bookings and payments will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition-colors duration-150 cursor-pointer flex gap-3 group relative ${
                    !n.is_read
                      ? "bg-[#F5F0E8]/70 hover:bg-[#F5F0E8]"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  {/* Unread accent pill indicator */}
                  {!n.is_read && (
                    <span className="absolute left-1 top-4 w-1.5 h-6 bg-[#C8922A] rounded-r-full" />
                  )}

                  {/* Icon */}
                  <div className="shrink-0 w-9 h-9 rounded-full bg-[#F5F0E8] border border-[#C8922A]/20 flex items-center justify-center mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p
                        className={`text-xs font-['Playfair_Display'] truncate ${
                          !n.is_read
                            ? "font-bold text-[#2C1810]"
                            : "font-medium text-[#2C1810]/80"
                        }`}
                      >
                        {n.title}
                      </p>
                      <span className="text-[10px] text-[#2C1810]/40 font-['Lato'] shrink-0 flex items-center gap-0.5">
                        <Clock size={10} />
                        {formatTimestamp(n.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-[#2C1810]/70 font-['Lato'] mt-1 leading-snug break-words line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  {/* Individual Mark Read action button */}
                  {!n.is_read && (
                    <button
                      onClick={(e) => handleMarkAsRead(n, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#2C1810]/40 hover:text-[#C8922A] transition-all self-center"
                      title="Mark read"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="bg-[#EDE8DF] px-4 py-2.5 text-center border-t border-[#C8922A]/15">
              <span className="text-[11px] font-['Lato'] text-[#2C1810]/60">
                Displaying newest notifications first
              </span>
            </div>
          )}
        </div>
      )}

      {/* Notification Detail Modal — rendered via fixed overlay so it always clears the navbar */}
      {showDetailModal && selectedNotification && (
        <div
          className="fixed inset-0 z-[99999] overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop — separate from scroll container so it fills the whole screen */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          />

          {/* Scroll container: padding-top clears the navbar height on any screen */}
          <div className="relative flex min-h-full items-start justify-center p-4 pt-24 pb-10">

            {/* Modal Card */}
            <div
              className="relative bg-white rounded-2xl shadow-2xl border border-[#C8922A]/20 w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-[#2C1810] px-5 py-4 rounded-t-2xl flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-9 h-9 rounded-full bg-[#F5F0E8]/10 border border-[#C8922A]/30 flex items-center justify-center">
                    {getNotificationIcon(selectedNotification.type)}
                  </div>
                  <h3 className="font-['Playfair_Display'] text-[#F5F0E8] text-base font-medium leading-snug">
                    {selectedNotification.title}
                  </h3>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="shrink-0 text-[#F5F0E8]/50 hover:text-[#F5F0E8] transition-colors p-1 mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5 space-y-4">
                <p className="text-sm text-[#2C1810]/80 font-['Lato'] leading-relaxed">
                  {selectedNotification.message}
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-[#2C1810]/40 font-['Lato']">
                  <Clock size={11} />
                  <span>{formatTimestamp(selectedNotification.created_at)}</span>
                </div>
              </div>

              {/* Footer with Redirection Action Button */}
              <div className="px-5 pb-5 pt-2 border-t border-[#C8922A]/10 flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-['Lato'] text-[#2C1810]/60 hover:text-[#2C1810] hover:bg-[#F5F0E8] transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    const type = selectedNotification.type;
                    // Determine which dashboard tab to open
                    let targetTab = "bookings";
                    if (type.includes("payment")) targetTab = "payments";
                    else if (type.includes("venue_setup")) targetTab = "venue";
                    else if (type.includes("menu")) targetTab = "menu-changes";
                    else if (type.includes("feedback")) targetTab = "feedback";

                    const isAdmin = user?.role === "Admin";

                    if (onSelectTab) {
                      // Already inside the dashboard — just switch tabs
                      onSelectTab(targetTab, selectedNotification.booking_id);
                    } else {
                      // Coming from homepage/navbar — navigate with state so the
                      // destination dashboard picks up the right tab on mount
                      navigate(isAdmin ? "/admin" : "/dashboard", {
                        state: { targetTab },
                      });
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] text-xs font-['Lato'] font-semibold hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <span>
                    {selectedNotification.type.includes("menu")
                      ? "View Menu Requests"
                      : selectedNotification.type.includes("feedback")
                        ? "View Feedback"
                        : selectedNotification.type.includes("payment")
                          ? "View Payment Details"
                          : selectedNotification.type.includes("venue_setup")
                            ? "View Venue Request"
                            : "View Booking"}
                  </span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
