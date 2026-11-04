/**
 * Server-only download of a routine from a user-supplied link.
 *
 * The URL comes straight from the client, so the fetch is hardened against
 * SSRF: HTTPS on the default port only, no embedded credentials, every
 * resolved address (including each redirect hop) must be public, and the
 * check runs inside the socket's own DNS lookup so a rebinding answer cannot
 * slip past it. Responses are capped in size and time.
 *
 * Common share links (Google Sheets, GitHub, Gist, Dropbox) are rewritten to
 * their raw/export form so a trainer can paste the link they already have.
 */
import dns from "node:dns";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

/** A failure whose message is safe to show the user (Spanish UI). */
export class RoutineFetchError extends Error {}

const BLOCKED = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  BLOCKED.addSubnet(addr, prefix, "ipv4");
}
// IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched against the IPv4 rules above by
// BlockList itself; adding ::ffff:0:0/96 here would block every IPv4 address.
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  BLOCKED.addSubnet(addr, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return true;
  return BLOCKED.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * Validates the link and rewrites known share URLs to a raw/export URL.
 * Throws RoutineFetchError with a user-facing reason when the link is unusable.
 */
export function normalizeRoutineUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new RoutineFetchError("El enlace no es una URL válida.");
  }
  if (url.protocol !== "https:") {
    throw new RoutineFetchError("El enlace debe empezar por https://.");
  }
  if (url.username || url.password) {
    throw new RoutineFetchError("El enlace no puede incluir usuario ni contraseña.");
  }
  if (url.port && url.port !== "443") {
    throw new RoutineFetchError("El enlace no puede usar un puerto personalizado.");
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  // Google Sheets: /spreadsheets/d/{id}/edit#gid=N → CSV export of that tab.
  if (host === "docs.google.com" && parts[0] === "spreadsheets" && parts[1] === "d" && parts[2]) {
    const gid = new URLSearchParams(url.hash.slice(1)).get("gid") ?? url.searchParams.get("gid");
    const out = new URL(`https://docs.google.com/spreadsheets/d/${parts[2]}/export`);
    out.searchParams.set("format", "csv");
    if (gid) out.searchParams.set("gid", gid);
    return out;
  }

  // GitHub file view: /{owner}/{repo}/blob/{ref}/{path} → raw file.
  if (host === "github.com" && parts[2] === "blob" && parts.length >= 5) {
    const [owner, repo, , ...rest] = parts;
    return new URL(`https://raw.githubusercontent.com/${owner}/${repo}/${rest.join("/")}`);
  }

  // Gist page: /{owner}/{id} → raw content of its first file.
  if (host === "gist.github.com" && parts.length === 2) {
    return new URL(`https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw`);
  }

  // Dropbox share link: force a direct download.
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    url.searchParams.delete("dl");
    url.searchParams.set("dl", "1");
    return url;
  }

  url.hash = "";
  return url;
}

/** DNS lookup that refuses to hand the socket any non-public address. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(
        new RoutineFetchError("El enlace apunta a una dirección no permitida."),
        "",
        4,
      );
    }
    if ((options as dns.LookupOptions).all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0]!.address, list[0]!.family);
    }
  });
};

function getOnce(url: URL): Promise<{ redirect: string } | { body: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  // Node skips `lookup` for IP literals, so check them here.
  if (net.isIP(host) && isBlockedAddress(host)) {
    return Promise.reject(new RoutineFetchError("El enlace apunta a una dirección no permitida."));
  }

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { accept: "application/json, text/csv, text/plain, */*" },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new RoutineFetchError(`El enlace respondió con un error (HTTP ${status}).`));
          return;
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          reject(new RoutineFetchError("El archivo del enlace es demasiado grande (máx. 1 MB)."));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new RoutineFetchError("El archivo del enlace es demasiado grande (máx. 1 MB)."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy(new RoutineFetchError("El enlace tardó demasiado en responder."));
    });
    req.on("error", reject);
  });
}

/** Downloads the routine text behind a (normalized) link. */
export async function fetchRoutineFromUrl(raw: string): Promise<string> {
  let url = normalizeRoutineUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let outcome: Awaited<ReturnType<typeof getOnce>>;
    try {
      outcome = await getOnce(url);
    } catch (error) {
      if (error instanceof RoutineFetchError) throw error;
      throw new RoutineFetchError("No se pudo descargar la rutina desde ese enlace.");
    }
    if ("body" in outcome) return outcome.body;
    // Redirect targets get the same protocol/port/credential checks.
    url = normalizeRoutineUrl(outcome.redirect);
  }
  throw new RoutineFetchError("El enlace redirige demasiadas veces.");
}

/** Infers the format from the downloaded text: a JSON object or CSV rows. */
export function detectRoutineFormat(content: string): "json" | "csv" {
  return content.trimStart().startsWith("{") ? "json" : "csv";
}
