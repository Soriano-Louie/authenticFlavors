import React, { useState, useRef, useEffect } from "react";
import { Download, FileSpreadsheet, FileCode, ChevronDown, Check } from "lucide-react";

interface ExportDropdownProps {
  label?: string;
  count?: number;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md";
  onExportCSV: () => void | Promise<void>;
  onExportJSON?: () => void | Promise<void>;
  className?: string;
}

export function ExportDropdown({
  label = "Export",
  count,
  disabled = false,
  variant = "secondary",
  size = "md",
  onExportCSV,
  onExportJSON,
  className = "",
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleCSV = async () => {
    try {
      setExporting("csv");
      await onExportCSV();
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  const handleJSON = async () => {
    if (!onExportJSON) return;
    try {
      setExporting("json");
      await onExportJSON();
    } finally {
      setExporting(null);
      setOpen(false);
    }
  };

  const sizeCls =
    size === "sm"
      ? "px-3 py-1.5 text-xs rounded-lg gap-1.5"
      : "px-4 py-2.5 text-sm rounded-xl gap-2";

  let variantCls = "";
  if (variant === "primary") {
    variantCls =
      "bg-gradient-to-r from-[#C8922A] to-[#C4541A] text-[#F5F0E8] hover:opacity-90 shadow-sm border-transparent";
  } else if (variant === "outline") {
    variantCls =
      "bg-transparent text-[#2C1810] border border-[#C8922A]/30 hover:border-[#C8922A] hover:bg-[#C8922A]/5";
  } else {
    variantCls =
      "bg-white text-[#2C1810] border border-[#C8922A]/30 hover:border-[#C8922A] hover:bg-[#F5F0E8]/50 shadow-xs";
  }

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled || exporting !== null}
        className={`flex items-center justify-center font-['Lato'] font-medium transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variantCls}`}
        aria-expanded={open}
        aria-haspopup="true"
        title={count !== undefined ? `${label} (${count} items)` : label}
      >
        <Download size={size === "sm" ? 14 : 16} className="shrink-0" />
        <span>{label}</span>
        {count !== undefined && (
          <span
            className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
              variant === "primary"
                ? "bg-white/20 text-white"
                : "bg-[#C8922A]/15 text-[#C8922A]"
            }`}
          >
            {count}
          </span>
        )}
        <ChevronDown
          size={size === "sm" ? 13 : 15}
          className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-56 rounded-xl bg-white border border-[#C8922A]/20 shadow-xl z-50 py-1.5 text-xs font-['Lato'] animate-in fade-in-0 zoom-in-95 duration-100"
          role="menu"
        >
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[#2C1810]/40 uppercase border-b border-[#C8922A]/10 mb-1">
            Export Format {count !== undefined && `(${count} records)`}
          </div>

          <button
            type="button"
            onClick={handleCSV}
            disabled={exporting !== null}
            className="w-full flex items-center justify-between px-3.5 py-2 text-left text-[#2C1810] hover:bg-[#C8922A]/10 hover:text-[#C4541A] transition-colors cursor-pointer group disabled:opacity-50"
            role="menuitem"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-md bg-[#7A8C5C]/15 text-[#7A8C5C] flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet size={14} />
              </div>
              <div>
                <p className="font-semibold text-xs leading-tight">CSV (Excel)</p>
                <p className="text-[10px] text-[#2C1810]/50">Compatible with Excel & Sheets</p>
              </div>
            </div>
            {exporting === "csv" && <Check size={14} className="text-[#7A8C5C] animate-pulse" />}
          </button>

          {onExportJSON && (
            <button
              type="button"
              onClick={handleJSON}
              disabled={exporting !== null}
              className="w-full flex items-center justify-between px-3.5 py-2 text-left text-[#2C1810] hover:bg-[#C8922A]/10 hover:text-[#C4541A] transition-colors cursor-pointer group disabled:opacity-50"
              role="menuitem"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-[#C8922A]/15 text-[#C8922A] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileCode size={14} />
                </div>
                <div>
                  <p className="font-semibold text-xs leading-tight">JSON Data</p>
                  <p className="text-[10px] text-[#2C1810]/50">Structured raw backup</p>
                </div>
              </div>
              {exporting === "json" && <Check size={14} className="text-[#C8922A] animate-pulse" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
