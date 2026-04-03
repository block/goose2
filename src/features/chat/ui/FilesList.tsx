import { useEffect, useState } from "react";
import {
  File,
  FileCode,
  FileJson,
  FileText,
  FolderOpen,
  Search,
} from "lucide-react";
import {
  useArtifactPolicyContext,
  type SessionArtifact,
} from "../hooks/ArtifactPolicyContext";

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".css",
  ".scss",
  ".html",
  ".py",
  ".rs",
  ".go",
]);

function getFileIcon(artifact: SessionArtifact) {
  if (artifact.kind === "folder") {
    return (
      <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    );
  }

  const ext = artifact.filename.includes(".")
    ? `.${artifact.filename.split(".").pop()?.toLowerCase()}`
    : "";

  if (ext === ".json") {
    return <FileJson className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
  if (ext === ".md") {
    return <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
  }
  return <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
}

function FileRow({
  artifact,
  onOpenFile,
  onOpenDirectory,
}: {
  artifact: SessionArtifact;
  onOpenFile: (path: string) => void;
  onOpenDirectory: (path: string) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full min-w-0 cursor-pointer items-start gap-2 overflow-hidden border-b border-border px-3 py-2 text-left hover:bg-muted"
      onClick={() => onOpenFile(artifact.resolvedPath)}
    >
      <div className="mt-0.5">{getFileIcon(artifact)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {artifact.filename}
          </span>
          {artifact.versionCount > 1 ? (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              v{artifact.versionCount}
            </span>
          ) : null}
        </div>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: directory path opens containing folder */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive span inside button to handle separate click target */}
        <span
          className="mt-0.5 block cursor-pointer truncate text-xs text-muted-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDirectory(artifact.resolvedDirectoryPath);
          }}
          title={`Open folder: ${artifact.directoryPath}`}
        >
          {artifact.directoryPath}
        </span>
      </div>
    </button>
  );
}

export function FilesList() {
  const { getAllSessionArtifacts, openResolvedPath, pathExists } =
    useArtifactPolicyContext();
  const [filter, setFilter] = useState("");
  const [existingPaths, setExistingPaths] = useState<Set<string> | null>(null);

  const artifacts = getAllSessionArtifacts();

  useEffect(() => {
    if (artifacts.length === 0) {
      setExistingPaths(new Set());
      return;
    }

    let cancelled = false;
    const paths = artifacts.map((a) => a.resolvedPath);

    Promise.all(paths.map((p) => pathExists(p).catch(() => false))).then(
      (results) => {
        if (cancelled) return;
        const existing = new Set<string>();
        for (let i = 0; i < paths.length; i++) {
          if (results[i]) existing.add(paths[i]);
        }
        setExistingPaths(existing);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [artifacts, pathExists]);

  const verifiedArtifacts =
    existingPaths === null
      ? artifacts
      : artifacts.filter((a) => existingPaths.has(a.resolvedPath));

  const filteredArtifacts = filter
    ? verifiedArtifacts.filter((a) => {
        const query = filter.toLowerCase();
        return (
          a.filename.toLowerCase().includes(query) ||
          a.directoryPath.toLowerCase().includes(query)
        );
      })
    : verifiedArtifacts;

  const handleOpenFile = (path: string) => {
    void openResolvedPath(path);
  };

  const handleOpenDirectory = (path: string) => {
    void openResolvedPath(path);
  };

  if (verifiedArtifacts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center">
        <p className="text-sm text-muted-foreground">No files yet</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 overflow-hidden">
      <div className="px-3 pb-1 pt-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter files..."
            className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border"
          />
        </div>
      </div>
      {filteredArtifacts.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <p className="text-sm text-muted-foreground">No matching files</p>
        </div>
      ) : (
        filteredArtifacts.map((artifact) => (
          <FileRow
            key={artifact.resolvedPath}
            artifact={artifact}
            onOpenFile={handleOpenFile}
            onOpenDirectory={handleOpenDirectory}
          />
        ))
      )}
    </div>
  );
}
