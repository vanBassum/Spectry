import { useEffect, useRef, useState } from "react"
import {
  ArrowUpCircleIcon,
  DownloadIcon,
  ExternalLinkIcon,
  UploadIcon,
} from "lucide-react"

import { backend, type Partition } from "@/lib/backend"
import { useConnectionStatus } from "@/hooks/use-connection-status"
import { useLatestRelease, type ReleaseInfo } from "@/hooks/use-latest-release"
import { useDeviceInfo } from "@/hooks/use-device-info"
import { isNewerVersion } from "@/lib/version"
import { Button } from "@/components/ui/button"

export default function FirmwarePage() {
  const connection = useConnectionStatus()
  const info = useDeviceInfo()
  const release = useLatestRelease()

  const [partitions, setPartitions] = useState<Partition[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = async () => {
    try {
      const r = await backend.getPartitions()
      setPartitions(r.partitions)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load partitions")
    }
  }

  useEffect(() => {
    if (connection !== "connected") return
    refresh()
    const iv = setInterval(refresh, 10_000)
    return () => clearInterval(iv)
  }, [connection])

  const updateAvailable =
    info && release && isNewerVersion(info.firmware, release.version)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Firmware</h1>

      {updateAvailable && release && (
        <UpdateAvailableCard current={info!.firmware} release={release} />
      )}

      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-b p-4">
          <h2 className="text-lg font-semibold">Partitions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Upload targets non-running OTA slot and the www FAT image. Download
            is always available.
          </p>
        </div>

        {partitions ? (
          <ul className="divide-y">
            {partitions.map((p) => (
              <PartitionRow key={p.label} partition={p} onAfterUpload={refresh} />
            ))}
          </ul>
        ) : loadError ? (
          <p className="p-6 text-sm text-red-500">
            Failed to load partitions: {loadError}
            <span className="mt-1 block text-xs text-muted-foreground">
              If you just updated the UI but not the firmware, flash the new .bin — the{" "}
              <code className="font-mono">partitions</code> command was added in the same release.
            </span>
          </p>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Loading...</p>
        )}
      </div>
    </div>
  )
}

// ── Row ──────────────────────────────────────────────────────────

function PartitionRow({
  partition,
  onAfterUpload,
}: {
  partition: Partition
  onAfterUpload: () => void
}) {
  const p = partition
  const fileRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uploadFn = chooseUploadFn(p)
  const canUpload = !!uploadFn && !p.running

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // reset so re-picking the same file still fires
    if (!file || !uploadFn) return

    setError(null)
    setProgress(0)
    try {
      await uploadFn(file, setProgress)
      onAfterUpload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setProgress(null)
    }
  }

  const uploading = progress !== null

  return (
    <li className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{p.label}</span>
            {p.running && <Badge tone="emerald">running</Badge>}
            {p.nextOta && <Badge tone="sky">next OTA</Badge>}
            {p.version && (
              <span className="font-mono text-xs text-muted-foreground">
                v{p.version}
              </span>
            )}
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {p.type}/{p.subtype} · 0x{p.offset.toString(16)} · {fmtSize(p.size)}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".bin"
            className="hidden"
            onChange={onFileChosen}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!canUpload || uploading}
            onClick={() => fileRef.current?.click()}
            title={
              !uploadFn
                ? "This partition can't be updated over HTTP"
                : p.running
                  ? "Cannot overwrite the running slot"
                  : "Upload a .bin file"
            }
          >
            <UploadIcon /> Upload
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={backend.partitionDownloadUrl(p.label)}
              download={`${p.label}.bin`}
            >
              <DownloadIcon /> Download
            </a>
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </li>
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function chooseUploadFn(
  p: Partition,
):
  | ((file: File, onProgress: (n: number) => void) => Promise<unknown>)
  | null {
  if (!p.uploadable) return null
  if (p.type === "app") {
    // Backend always writes to the next-OTA slot. We only render the Upload
    // button on the non-running app partition, so this is safe.
    return (f, op) => backend.uploadFirmware(f, op)
  }
  if (p.label === "www") return (f, op) => backend.uploadWww(f, op)
  return null
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: "emerald" | "sky"
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  )
}

function UpdateAvailableCard({
  current,
  release,
}: {
  current: string
  release: ReleaseInfo
}) {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <ArrowUpCircleIcon className="size-5 text-emerald-500" />
        <h2 className="text-lg font-semibold">Update Available</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Version{" "}
        <span className="font-mono font-medium text-foreground">
          {release.version}
        </span>{" "}
        is available (you have <span className="font-mono">{current}</span>).
        Download the binaries from GitHub and upload them below.
      </p>

      <div className="mt-3">
        <Button variant="outline" size="sm" asChild>
          <a href={release.url} target="_blank" rel="noopener noreferrer">
            Go to release
            <ExternalLinkIcon className="ml-1.5 size-3" />
          </a>
        </Button>
      </div>
    </div>
  )
}
