import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  ChevronRight,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  GitBranch,
  ExternalLink,
  X,
  File,
  Code2,
  HardDrive,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { api } from '../../lib/api';

interface RepoFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sourceUrl?: string;
  branch?: string;
  itemType: 'pack' | 'skill';
  itemId: string;
  metadata?: any;
  onSync?: () => Promise<void>;
}

interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
}

export function RepoFilesModal({
  isOpen,
  onClose,
  title,
  sourceUrl,
  branch = 'main',
  itemType,
  itemId,
  metadata,
  onSync,
}: RepoFilesModalProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load directory tree whenever currentPath or itemId changes
  useEffect(() => {
    if (!isOpen || !itemId) return;
    loadFiles(currentPath);
  }, [isOpen, itemId, currentPath]);

  async function loadFiles(path: string) {
    setLoadingFiles(true);
    setError(null);
    try {
      const res =
        itemType === 'pack'
          ? await api.skills.getPackFiles(itemId, path)
          : await api.skills.getSkillFiles(itemId, path);

      setFiles(res.files);
      // Auto-preview README.md if at root and nothing selected yet
      if (!path && !selectedFile) {
        const readme = res.files.find(
          (f) => !f.isDirectory && f.name.toLowerCase().startsWith('readme')
        );
        if (readme) {
          loadFileContent(readme.path);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load repository files from VPS storage');
    } finally {
      setLoadingFiles(false);
    }
  }

  async function loadFileContent(filePath: string) {
    setSelectedFile(filePath);
    setLoadingContent(true);
    try {
      const res =
        itemType === 'pack'
          ? await api.skills.getPackFileContent(itemId, filePath)
          : await api.skills.getSkillFileContent(itemId, filePath);

      setFileContent(res.content);
    } catch (err: any) {
      setFileContent(`Error loading file: ${err?.message || 'Failed to read file'}`);
    } finally {
      setLoadingContent(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      if (onSync) {
        await onSync();
      } else if (itemType === 'pack') {
        await api.skills.syncPack(itemId);
      }
      await loadFiles(currentPath);
      if (selectedFile) await loadFileContent(selectedFile);
    } catch (err: any) {
      setError(err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  function handleCopy() {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function navigateToFolder(folderPath: string) {
    setCurrentPath(folderPath);
  }

  function navigateUp() {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  }

  if (!isOpen) return null;

  const pathParts = currentPath.split('/').filter(Boolean);
  const commitHash = metadata?.commitHash;
  const cloneStatus = metadata?.cloneStatus || (files.length > 0 ? 'SUCCESS' : 'PENDING');

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-3xl w-full max-w-5xl h-[85vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between gap-4 shrink-0 bg-surface-50/50">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-xl bg-brand-500/10 text-brand-500">
                <HardDrive size={18} />
              </span>
              <h2 className="text-sm font-bold text-ink truncate">{title}</h2>
              <Badge
                size="sm"
                tone={cloneStatus === 'SUCCESS' ? 'success' : cloneStatus === 'CLONING' ? 'info' : 'warning'}
              >
                {cloneStatus === 'SUCCESS' ? 'Stored on VPS' : cloneStatus === 'CLONING' ? 'Downloading...' : cloneStatus}
              </Badge>
              {commitHash && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-inset border border-line text-ink-muted">
                  commit: {commitHash}
                </span>
              )}
            </div>

            {sourceUrl && (
              <div className="flex items-center gap-2 mt-1 text-2xs text-ink-muted truncate font-mono">
                <GitBranch size={11} className="shrink-0" />
                <span>{branch}</span>
                <span>•</span>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-brand-500 flex items-center gap-1 truncate hover:underline"
                >
                  {sourceUrl}
                  <ExternalLink size={10} />
                </a>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="xs"
              variant="secondary"
              icon={RefreshCw}
              loading={syncing}
              onClick={handleSync}
              title="Pull latest commit from remote Git repository"
            >
              Pull Latest
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-inset text-ink-muted hover:text-ink transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center justify-between">
            <span>{error}</span>
            <Button size="xs" variant="ghost" onClick={handleSync}>
              Retry Download
            </Button>
          </div>
        )}

        {/* Breadcrumb Bar */}
        <div className="px-5 py-2.5 bg-inset border-b border-line flex items-center gap-1.5 text-xs text-ink-muted overflow-x-auto no-scrollbar shrink-0 font-mono">
          <button
            type="button"
            onClick={() => setCurrentPath('')}
            className={`hover:text-brand-500 cursor-pointer ${!currentPath ? 'text-ink font-semibold' : ''}`}
          >
            root
          </button>
          {pathParts.map((part, index) => {
            const partPath = pathParts.slice(0, index + 1).join('/');
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={partPath}>
                <ChevronRight size={12} className="text-ink-faint shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentPath(partPath)}
                  className={`hover:text-brand-500 cursor-pointer truncate max-w-[150px] ${
                    isLast ? 'text-ink font-semibold' : ''
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Content Explorer Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: File Tree */}
          <div className="w-1/3 min-w-[240px] max-w-[320px] border-r border-line flex flex-col bg-surface overflow-hidden">
            <div className="p-3 border-b border-line-subtle flex items-center justify-between text-2xs uppercase tracking-wider font-bold text-ink-muted">
              <span>Files & Folders</span>
              {currentPath && (
                <button
                  type="button"
                  onClick={navigateUp}
                  className="flex items-center gap-1 text-brand-500 hover:underline cursor-pointer"
                >
                  <ArrowLeft size={11} /> Up
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingFiles ? (
                <div className="p-4 text-center text-xs text-ink-muted">Loading files...</div>
              ) : files.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-muted">
                  No files found. Try clicking &quot;Pull Latest&quot; to clone.
                </div>
              ) : (
                files.map((file) => {
                  const isSelected = selectedFile === file.path;
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => {
                        if (file.isDirectory) {
                          navigateToFolder(file.path);
                        } else {
                          loadFileContent(file.path);
                        }
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold'
                          : 'hover:bg-inset text-ink'
                      }`}
                    >
                      {file.isDirectory ? (
                        <Folder size={14} className="text-amber-500 shrink-0" />
                      ) : file.name.endsWith('.md') ? (
                        <FileText size={14} className="text-sky-500 shrink-0" />
                      ) : (
                        <FileCode size={14} className="text-emerald-500 shrink-0" />
                      )}
                      <span className="truncate flex-1 font-mono text-[11px]">{file.name}</span>
                      {file.size !== undefined && (
                        <span className="text-[10px] text-ink-faint shrink-0 font-mono">
                          {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}k` : `${file.size}b`}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Code/File Viewer */}
          <div className="flex-1 flex flex-col bg-inset/40 overflow-hidden">
            {selectedFile ? (
              <>
                <div className="px-4 py-2 border-b border-line bg-surface flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 truncate font-mono text-xs text-ink">
                    <Code2 size={14} className="text-brand-500 shrink-0" />
                    <span className="truncate">{selectedFile}</span>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    icon={copied ? Check : Copy}
                    onClick={handleCopy}
                    className="text-xs"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-ink bg-surface/30">
                  {loadingContent ? (
                    <div className="text-ink-muted">Loading file content...</div>
                  ) : (
                    <pre className="whitespace-pre-wrap break-all leading-relaxed tab-4">
                      {fileContent}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-ink-muted">
                <File size={36} className="text-ink-faint mb-2 opacity-50" />
                <p className="text-xs font-semibold">Select a file from the explorer to preview</p>
                <p className="text-2xs text-ink-faint mt-1">
                  Code files, Markdown docs, and configurations stored on VPS can be inspected directly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
