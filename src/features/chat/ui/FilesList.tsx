import { useEffect, useState } from "react";
import { File, FileCode, FileJson, FileText, FolderOpen } from "lucide-react";
import { SearchBar } from "@/shared/ui/SearchBar";
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
    return <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />;
  }

  const ext = artifact.filename.includes(".")
    ? `.${artifact.filename.split(".").pop()?.toLowerCase()}`
    : "";

  if (ext === ".json") {
    return <FileJson className="h-5 w-5 shrink-0 text-muted-foreground" />;
  }
  if (ext === ".md") {
    return <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />;
  }
  if (CODE_EXTENSIONS.has(ext)) {
    return <FileCode className="h-5 w-5 shrink-0 text-muted-foreground" />;
  }
  return <File className="h-5 w-5 shrink-0 text-muted-foreground" />;
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
      className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted"
      onClick={() => onOpenFile(artifact.resolvedPath)}
    >
      <div className="flex shrink-0 items-center">{getFileIcon(artifact)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {artifact.filename}
        </p>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: directory path opens containing folder */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: interactive span inside button to handle separate click target */}
        <span
          className="mt-0.5 block truncate text-xs text-muted-foreground hover:underline"
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
      <div className="px-3 pb-2 pt-3">
        <SearchBar value={filter} onChange={setFilter} placeholder="Search" />
      </div>
      {filteredArtifacts.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <p className="text-sm text-muted-foreground">No matching files</p>
        </div>
      ) : (
        <div className="space-y-2 px-3 pb-3">
          {filteredArtifacts.map((artifact) => (
            <FileRow
              key={artifact.resolvedPath}
              artifact={artifact}
              onOpenFile={handleOpenFile}
              onOpenDirectory={handleOpenDirectory}
            />
          ))}
        </div>
      )}
    </div>
  );
}
