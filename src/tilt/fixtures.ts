// Canned Tilt sessions for demos and UI iteration. Gated by TILT_TUI_FIXTURE,
// so the TUI runs with no tilt process, cluster, or network. The value is a
// built-in fixture name (see FIXTURES) or a path to a JSON array of view
// messages, e.g. ones captured from a live `/ws/view` socket.
//
// Fixture data goes through the same dispatchViewResponse path as live
// WebSocket messages, so the app's own parsing runs on it.

import { call, createSignal, resource, sleep, spawn, type Operation } from "effection";
import {
  RuntimeStatus,
  UpdateStatus,
  type APIButton,
  type APILogList,
  type APIResource,
  type APIViewResponse,
} from "./api-types";
import {
  dispatchViewResponse,
  TiltClient,
  type ButtonsUpdate,
  type EngineDump,
  type LogsUpdate,
  type ResourcesUpdate,
  type SessionUpdate,
  type TiltSignals,
  type TiltStreams,
} from "./client";

interface ResourceSpec {
  name: string;
  // The resource's Tiltfile label, which the tree groups by.
  group?: string;
  kind: "k8s" | "local" | "tiltfile";
  runtime: RuntimeStatus;
  update: UpdateStatus;
  endpoint?: string;
  error?: string;
  disabled?: boolean;
  deps?: string[];
  logs: string[];
}

const now = Date.now();
const ago = (seconds: number): string => new Date(now - seconds * 1000).toISOString();

const DEMO: ResourceSpec[] = [
  {
    name: "(Tiltfile)",
    kind: "tiltfile",
    runtime: RuntimeStatus.NotApplicable,
    update: UpdateStatus.Ok,
    logs: ["Loading Tiltfile at: /home/dev/shop/Tiltfile", "Successfully loaded Tiltfile (412ms)"],
  },
  {
    name: "postgres",
    group: "infra",
    kind: "k8s",
    runtime: RuntimeStatus.Ok,
    update: UpdateStatus.Ok,
    logs: [
      "PostgreSQL init process complete; ready for start up.",
      "LOG:  database system is ready to accept connections",
    ],
  },
  {
    name: "redis",
    group: "infra",
    kind: "k8s",
    runtime: RuntimeStatus.Ok,
    update: UpdateStatus.Ok,
    logs: ["Ready to accept connections tcp"],
  },
  {
    name: "migrations",
    group: "infra",
    kind: "local",
    runtime: RuntimeStatus.NotApplicable,
    update: UpdateStatus.Ok,
    deps: ["postgres"],
    logs: [
      "Running migrations against postgres://shop@postgres:5432/shop",
      "  ✓ 0007_add_order_status",
      "  ✓ 0008_index_orders_by_customer",
      "2 migrations applied",
    ],
  },
  {
    name: "api",
    group: "backend",
    kind: "k8s",
    runtime: RuntimeStatus.Ok,
    update: UpdateStatus.Ok,
    endpoint: "http://localhost:8080",
    deps: ["postgres", "redis", "migrations"],
    logs: [
      "Building Dockerfile for platform linux/arm64",
      "  [2/4] RUN go mod download  1.9s",
      "  [4/4] RUN go build -o /bin/api ./cmd/api  6.2s",
      "Step 1 - 8.4s (Building Dockerfile)",
      'level=info msg="listening" addr=:8080',
      'level=info msg="GET /healthz" status=200 dur=0.4ms',
      'level=info msg="GET /v1/orders" status=200 dur=12.7ms',
    ],
  },
  {
    name: "worker",
    group: "backend",
    kind: "k8s",
    runtime: RuntimeStatus.Pending,
    update: UpdateStatus.InProgress,
    deps: ["redis"],
    logs: [
      "Building Dockerfile for platform linux/arm64",
      "  [3/4] COPY . .  0.2s",
      "  [4/4] RUN go build -o /bin/worker ./cmd/worker",
    ],
  },
  {
    name: "web",
    group: "frontend",
    kind: "k8s",
    runtime: RuntimeStatus.Ok,
    update: UpdateStatus.Ok,
    endpoint: "http://localhost:3000",
    deps: ["api"],
    logs: [
      "vite v6.3.5 building for development...",
      "  ➜  Local:   http://localhost:3000/",
      "page reload src/routes/orders.tsx",
    ],
  },
  {
    name: "storybook",
    group: "frontend",
    kind: "local",
    runtime: RuntimeStatus.Error,
    update: UpdateStatus.Error,
    error: "exit status 1",
    logs: [
      "storybook v8.6.0 started",
      "ERROR in ./src/components/OrderTable.stories.tsx",
      "Module not found: Error: Can't resolve './OrderTable.mock'",
      "exit status 1",
    ],
  },
  {
    name: "e2e",
    group: "frontend",
    kind: "local",
    runtime: RuntimeStatus.NotApplicable,
    update: UpdateStatus.None,
    disabled: true,
    logs: [],
  },
];

const FIXTURES: Record<string, ResourceSpec[]> = { default: DEMO };

const buildSpan = (name: string): string => `build:${name}`;
const runtimeSpan = (name: string): string => `pod:${name}`;

function apiResource(spec: ResourceSpec, order: number): APIResource {
  const building = spec.update === UpdateStatus.InProgress;
  // Staggered start times and varied build durations, so the tree's
  // "5m ago · 8.4s" lines differ like a real session's.
  const started = 300 + order * 7;
  const duration = 1 + ((order * 37) % 11) + 0.4 * (order % 3);
  return {
    apiVersion: "tilt.dev/v1alpha1",
    kind: "UIResource",
    metadata: {
      annotations: {},
      creationTimestamp: ago(3600),
      labels: spec.group ? { [spec.group]: spec.group } : {},
      name: spec.name,
      resourceVersion: "1",
      uid: `uid-${spec.name}`,
    },
    spec: {},
    status: {
      order,
      conditions: [],
      disableStatus: {
        disabledCount: spec.disabled ? 1 : 0,
        enabledCount: spec.disabled ? 0 : 1,
        sources: [],
        state: spec.disabled ? "Disabled" : "Enabled",
      },
      runtimeStatus: spec.runtime,
      updateStatus: spec.update,
      pendingBuildSince: building ? ago(4) : undefined,
      buildHistory: spec.disabled
        ? []
        : [
            {
              startTime: ago(building ? 4 : started),
              finishTime: building ? undefined : ago(started - duration),
              error: spec.error,
              spanID: buildSpan(spec.name),
            },
          ],
      lastDeployTime: building ? undefined : ago(started - duration),
      endpointLinks: spec.endpoint ? [{ url: spec.endpoint }] : [],
      specs: spec.kind === "tiltfile" ? [] : [{ id: `${spec.kind}:${spec.name}`, type: spec.kind }],
      ...(spec.kind === "k8s"
        ? {
            k8sResourceInfo: {
              allContainersReady: spec.runtime === RuntimeStatus.Ok,
              displayNames: [],
              podCreationTime: ago(280),
              podName: `${spec.name}-7d9f8c6b5-x2k4p`,
              podRestarts: 0,
              podStatus: spec.runtime === RuntimeStatus.Ok ? "Running" : "Pending",
              spanID: runtimeSpan(spec.name),
            },
          }
        : {}),
    },
  };
}

function logList(specs: ResourceSpec[]): APILogList {
  const spans: APILogList["spans"] = {};
  const segments: APILogList["segments"] = [];
  for (const spec of specs) {
    spans[buildSpan(spec.name)] = { manifestName: spec.name };
    spec.logs.forEach((text, i) => {
      segments.push({
        time: ago(300 - i),
        text: `${text}\n`,
        level: /error|exit status/i.test(text) ? "ERROR" : "INFO",
        spanId: buildSpan(spec.name),
      });
    });
  }
  return { segments, spans };
}

function viewFor(specs: ResourceSpec[], logs: APILogList = logList(specs)): APIViewResponse {
  const tiltStartTime = ago(3600);
  return {
    tiltStartTime,
    isComplete: true,
    uiSession: {
      metadata: {
        annotations: {},
        creationTimestamp: tiltStartTime,
        labels: {},
        name: "Tiltfile",
        resourceVersion: "1",
        uid: "uid-session",
      },
      status: { tiltStartTime, tiltfileKey: "/home/dev/shop/Tiltfile" },
    },
    uiResources: specs.map((spec, i) => apiResource(spec, i + 1)),
    uiButtons: [],
    logList: logs,
  };
}

export async function loadFrames(name: string): Promise<APIViewResponse[]> {
  const specs = FIXTURES[name];
  if (specs) return [viewFor(specs)];
  const file = Bun.file(name);
  if (!(await file.exists())) {
    throw new Error(
      `TILT_TUI_FIXTURE: "${name}" is neither a built-in fixture (${Object.keys(FIXTURES).join(", ")}) nor a file`,
    );
  }
  const frames: unknown = await file.json();
  if (!Array.isArray(frames)) {
    throw new Error(`TILT_TUI_FIXTURE: ${name} must hold a JSON array of view messages`);
  }
  return frames;
}

/**
 * A TiltClient that serves a fixture instead of talking to tilt. Triggering a
 * resource plays a short rebuild, so the demo has something to show.
 */
export class FixtureTiltClient extends TiltClient {
  private signals: TiltSignals | undefined;
  private specs: ResourceSpec[];

  constructor(private readonly fixture: string) {
    super();
    this.specs = (FIXTURES[fixture] ?? []).map((spec) => ({ ...spec, logs: [...spec.logs] }));
  }

  override *useTiltStreams(): Operation<TiltStreams> {
    const frames = yield* call(() => loadFrames(this.fixture));
    // triggerResource sends follow-up updates through the same signals.
    const keep = (signals: TiltSignals): void => {
      this.signals = signals;
    };
    return yield* resource<TiltStreams>(function* (provide) {
      const signals: TiltSignals = {
        resources: createSignal<ResourcesUpdate, void>(),
        buttons: createSignal<ButtonsUpdate, void>(),
        logs: createSignal<LogsUpdate, void>(),
        session: createSignal<SessionUpdate, void>(),
      };
      keep(signals);
      // Consumers subscribe after `provide`, so send on the next tick.
      yield* spawn(function* () {
        yield* sleep(10);
        for (const frame of frames) dispatchViewResponse(frame, signals);
      });
      yield* provide(signals);
    });
  }

  override async getTiltArgs(): Promise<Record<string, string | boolean | undefined>> {
    return {};
  }

  override async getVersion(): Promise<string | null> {
    return "v0.35.0 (fixture)";
  }

  override async checkHealth(): Promise<boolean> {
    return true;
  }

  override async triggerResource(name: string): Promise<void> {
    const spec = this.specs.find((s) => s.name === name);
    if (!spec) return;
    // Log segments are appended by the app, so each update carries only the
    // new lines.
    const emit = (line: string): void => {
      if (!this.signals) return;
      const logs: APILogList = {
        spans: { [buildSpan(name)]: { manifestName: name } },
        segments: [
          {
            time: new Date().toISOString(),
            text: `${line}\n`,
            level: "INFO",
            spanId: buildSpan(name),
          },
        ],
      };
      dispatchViewResponse(viewFor(this.specs, logs), this.signals);
    };
    spec.update = UpdateStatus.InProgress;
    emit(`Rebuilding ${name} (triggered manually)`);
    await Bun.sleep(1500);
    spec.update = UpdateStatus.Ok;
    if (spec.kind === "k8s") spec.runtime = RuntimeStatus.Ok;
    spec.error = undefined;
    emit(`${name} is up to date`);
  }

  override async clickButton(button: APIButton): Promise<APIButton> {
    return button;
  }

  override async dumpEngine(): Promise<EngineDump> {
    return {
      desiredTiltfilePath: "/home/dev/shop/Tiltfile",
      manifestTargets: Object.fromEntries(
        this.specs.map((spec) => [
          spec.name,
          { manifest: { name: spec.name, resourceDependencies: spec.deps ?? null } },
        ]),
      ),
    };
  }
}

export function fixtureName(): string | undefined {
  return process.env.TILT_TUI_FIXTURE || undefined;
}
