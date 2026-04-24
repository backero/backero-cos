"use client";

import { useRef, useState } from "react";
import { Download, FileDown, FileUp, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImportExportMenuProps {
  onExport: () => Promise<void> | void;
  onImport: (file: File) => Promise<unknown> | void;
  onSampleDownload: () => Promise<void> | void;
  exportLabel?: string;
  importLabel?: string;
  accept?: string;
  isExporting?: boolean;
  isImporting?: boolean;
  className?: string;
}

export function ImportExportMenu({
  onExport,
  onImport,
  onSampleDownload,
  exportLabel = "Export Excel",
  importLabel = "Import Excel",
  accept = ".xlsx,.xls",
  isExporting = false,
  isImporting = false,
  className,
}: ImportExportMenuProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = "";
    }
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setOpen((v) => !v)}
      >
        <FileDown className="w-3.5 h-3.5" />
        Import / Export
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
            <button
              onClick={async () => { await onExport(); setOpen(false); }}
              disabled={isExporting}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-green-600" />}
              {exportLabel}
            </button>

            <div className="border-t border-slate-100 dark:border-slate-800" />

            <button
              onClick={() => { fileInputRef.current?.click(); }}
              disabled={isImporting}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-blue-600" />}
              {importLabel}
            </button>

            <div className="border-t border-slate-100 dark:border-slate-800" />

            <button
              onClick={async () => { await onSampleDownload(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <FileDown className="w-4 h-4 text-slate-400" />
              Download Sample File
            </button>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
