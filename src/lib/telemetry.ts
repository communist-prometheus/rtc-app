// Browser-side telemetry client for rtc-less.
//
// Posts span and metric records to the telemetry collector at the
// URL configured by the PUBLIC_TELEMETRY_URL build env, falling back
// to https://telemetry.comprom.org in production. The collector
// schema is the in-house format defined in
// `packages/rtc-telemetry/src/types.ts` — NOT OTLP. We avoid the
// OpenTelemetry SDK to keep the bundle small.
//
// Failure semantics: every send is fire-and-forget. The collector
// being unreachable must NEVER affect the call. The whole module
// silently no-ops on any error.

const DEFAULT_URL = 'https://telemetry.comprom.org'

const getEndpoint = (): string => {
  // Read at call time so test runs can override via globalThis.
  const fromGlobal = (globalThis as Record<string, unknown>)[
    '__TELEMETRY_URL__'
  ]
  if (typeof fromGlobal === 'string' && fromGlobal) return fromGlobal
  // PUBLIC_* vars are inlined at Astro build time.
  const env = import.meta.env as Record<string, string | undefined>
  const fromBuild = env['PUBLIC_TELEMETRY_URL']
  return fromBuild || DEFAULT_URL
}

type SpanName =
  | 'room.session.start'
  | 'room.session.end'
  | 'user.connect'
  | 'user.disconnect'
  | 'ice.event'

type SpanAttributes = {
  readonly [key: string]: string | number | undefined
}

type Span = {
  readonly traceId: string
  readonly spanId: string
  readonly name: SpanName
  readonly timestamp: string
  readonly attributes: SpanAttributes
}

type MetricSample = {
  readonly connectionId: string
  readonly timestamp: string
  readonly rttMs: number
  readonly jitterMs: number
  readonly packetLossPct: number
  readonly bitrateKbps: number
}

const newId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2)

const isoNow = (): string => new Date().toISOString()

type CallRecord = {
  readonly path: string
  readonly body: unknown
  readonly transport: 'fetch' | 'beacon'
  readonly status?: number
  readonly error?: string
  readonly timestamp: string
}

const recordCall = (record: CallRecord): void => {
  const w = globalThis as Record<string, unknown>
  const arr = (w['__telemetryCalls'] as CallRecord[] | undefined) ?? []
  arr.push(record)
  w['__telemetryCalls'] = arr
}

const post = async (path: string, body: unknown): Promise<void> => {
  const endpoint = getEndpoint()
  if (!endpoint) return
  try {
    const res = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
    recordCall({
      path,
      body,
      transport: 'fetch',
      status: res.status,
      timestamp: isoNow(),
    })
  } catch (err) {
    /* fire-and-forget — telemetry is observability, not functionality */
    recordCall({
      path,
      body,
      transport: 'fetch',
      error: (err as { message?: string } | null)?.message ?? 'unknown',
      timestamp: isoNow(),
    })
  }
}

const postBeacon = (path: string, body: unknown): void => {
  const endpoint = getEndpoint()
  if (!endpoint) return
  try {
    const blob = new Blob([JSON.stringify(body)], {
      type: 'application/json',
    })
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(`${endpoint}${path}`, blob)
      recordCall({
        path,
        body,
        transport: 'beacon',
        timestamp: isoNow(),
      })
      return
    }
    void post(path, body)
  } catch (err) {
    recordCall({
      path,
      body,
      transport: 'beacon',
      error: (err as { message?: string } | null)?.message ?? 'unknown',
      timestamp: isoNow(),
    })
  }
}

const sendSpan = async (
  name: SpanName,
  spanId: string,
  attributes: SpanAttributes,
  options?: { readonly traceId?: string; readonly beacon?: boolean }
): Promise<void> => {
  const span: Span = {
    traceId: options?.traceId ?? newId(),
    spanId,
    name,
    timestamp: isoNow(),
    attributes,
  }
  if (options?.beacon) {
    postBeacon('/v1/traces', { spans: [span] })
  } else {
    await post('/v1/traces', { spans: [span] })
  }
}

const sendMetrics = async (
  metrics: readonly MetricSample[]
): Promise<void> => {
  if (metrics.length === 0) return
  await post('/v1/metrics', { metrics })
}

/**
 * Public API.
 *
 * The session id is the spanId of the room.session.start span.
 * The connection id is the spanId of the user.connect span.
 * Both are passed back to the caller so subsequent spans can
 * reference them by attribute.
 */
export const telemetry = {
  startRoomSession: async (roomId: string): Promise<string> => {
    // sessionId == roomId is deterministic, so multiple peers
    // joining the same room point at the same DB row. The collector
    // uses INSERT OR IGNORE so only the first joiner creates it.
    await sendSpan('room.session.start', roomId, {
      'room.id': roomId,
    })
    return roomId
  },

  endRoomSession: async (sessionId: string): Promise<void> => {
    await sendSpan('room.session.end', newId(), {
      'session.id': sessionId,
    })
  },

  endRoomSessionBeacon: (sessionId: string): void => {
    postBeacon('/v1/traces', {
      spans: [
        {
          traceId: newId(),
          spanId: newId(),
          name: 'room.session.end',
          timestamp: isoNow(),
          attributes: { 'session.id': sessionId },
        },
      ],
    })
  },

  trackUserConnect: async (
    sessionId: string,
    userId: string,
    nickname: string
  ): Promise<string> => {
    const connectionId = newId()
    await sendSpan('user.connect', connectionId, {
      'session.id': sessionId,
      'user.id': userId,
      user_agent: globalThis.navigator?.userAgent ?? '',
      nickname,
    })
    return connectionId
  },

  trackUserDisconnect: async (
    connectionId: string
  ): Promise<void> => {
    await sendSpan('user.disconnect', newId(), {
      'connection.id': connectionId,
    })
  },

  trackUserDisconnectBeacon: (connectionId: string): void => {
    postBeacon('/v1/traces', {
      spans: [
        {
          traceId: newId(),
          spanId: newId(),
          name: 'user.disconnect',
          timestamp: isoNow(),
          attributes: { 'connection.id': connectionId },
        },
      ],
    })
  },

  trackIceEvent: async (
    connectionId: string,
    eventType: string,
    extras: SpanAttributes = {}
  ): Promise<void> => {
    await sendSpan('ice.event', newId(), {
      'connection.id': connectionId,
      'ice.event_type': eventType,
      ...extras,
    })
  },

  pushQualitySample: async (
    sample: MetricSample
  ): Promise<void> => {
    await sendMetrics([sample])
  },

  setEndpointForTesting: (url: string | undefined): void => {
    ;(globalThis as Record<string, unknown>)[
      '__TELEMETRY_URL__'
    ] = url
  },
}
