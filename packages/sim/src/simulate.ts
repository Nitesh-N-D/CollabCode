import "dotenv/config";
import { io, type Socket } from "socket.io-client";
import {
  EVENTS,
  type ClientToServerEvents,
  type ServerToClientEvents
} from "@collabcode/shared";

type SimSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SERVER_URL = process.env.SIM_SERVER_URL ?? "http://localhost:4000";
const ROOM_CODE = (process.env.SIM_ROOM ?? "CS101").toUpperCase();
const DURATION = Number(process.argv.find((arg) => arg.startsWith("--duration="))?.split("=")[1] ?? 0);

const scenarios = [
  {
    name: "Asha Rao",
    file: "fibonacci.py",
    progress: [
      "def fibonacci(n):\n    pass",
      "def fibonacci(n):\n    if n <= 1:\n        return n",
      "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)",
      "def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)\n\nassert fibonacci(10) == 55"
    ]
  },
  {
    name: "Noah Kim",
    file: "fibonacci.py",
    stuckAt: 1,
    progress: [
      "def fib(n):\n    pass",
      "def fib(n):\n    if n == 0:\n        pass  # what belongs here?",
      "def fib(n):\n    if n == 0:\n        return 0\n    return fib(n - 1)"
    ]
  },
  {
    name: "Maya Chen",
    file: "iterative.py",
    progress: [
      "def fibonacci(n):\n    values = []",
      "def fibonacci(n):\n    values = []\n    a, b = 0, 1",
      "def fibonacci(n):\n    values = []\n    a, b = 0, 1\n    for _ in range(n):\n        values.append(a)\n        a, b = b, a + b\n    return values"
    ]
  },
  {
    name: "Eli Brooks",
    file: "solution.py",
    stuckAt: 0,
    askForHelp: true,
    progress: [
      "# I know recursion is involved, but where do I start?",
      "def fibonacci(n):\n    # start with the smallest inputs\n    pass"
    ]
  },
  {
    name: "Sofia Patel",
    file: "test_fibonacci.py",
    progress: [
      "from fibonacci import fibonacci\n\nassert fibonacci(0) == 0",
      "from fibonacci import fibonacci\n\nassert fibonacci(0) == 0\nassert fibonacci(1) == 1",
      "from fibonacci import fibonacci\n\nassert fibonacci(0) == 0\nassert fibonacci(1) == 1\nassert fibonacci(10) == 55"
    ]
  }
] as const;

function runStudent(scenario: (typeof scenarios)[number], index: number): SimSocket {
  const studentId = `sim-${index}-${scenario.name.toLowerCase().replaceAll(" ", "-")}`;
  const socket: SimSocket = io(SERVER_URL, { reconnection: true });
  let progress = 0;
  let lastProgress = Date.now();
  let hintReceived = false;

  socket.on("connect", () => {
    socket.emit(EVENTS.STUDENT_JOIN, {
      roomCode: ROOM_CODE,
      studentId,
      displayName: scenario.name,
      token: "simulator"
    });
    console.log(`[sim] ${scenario.name} joined ${ROOM_CODE}`);
  });

  socket.on(EVENTS.HINT_RECEIVE, (hint) => {
    hintReceived = true;
    console.log(`[sim] ${scenario.name} received hint: ${hint.hint}`);
    setTimeout(() => {
      progress = Math.min(progress + 1, scenario.progress.length - 1);
      lastProgress = Date.now();
    }, 1500);
  });

  setInterval(() => {
    const stuck = "stuckAt" in scenario && progress >= scenario.stuckAt && !hintReceived;
    const content = scenario.progress[Math.min(progress, scenario.progress.length - 1)];
    socket.emit(EVENTS.CODE_SNAPSHOT, {
      roomCode: ROOM_CODE,
      studentId,
      displayName: scenario.name,
      fileName: scenario.file,
      languageId: "python",
      content,
      cursorLine: content.split("\n").length,
      timestamp: Date.now(),
      idleMs: stuck ? Date.now() - lastProgress + 70_000 : Math.floor(Math.random() * 3500),
      errorCount: stuck ? 2 : 0
    });
  }, 2000);

  setInterval(() => {
    const stuck = "stuckAt" in scenario && progress >= scenario.stuckAt && !hintReceived;
    if (!stuck && progress < scenario.progress.length - 1) {
      progress += 1;
      lastProgress = Date.now();
    }
  }, 6000 + index * 900);

  if ("askForHelp" in scenario && scenario.askForHelp) {
    setTimeout(() => {
      socket.emit(EVENTS.HELP_REQUEST, {
        roomCode: ROOM_CODE,
        studentId,
        message: "I understand the goal, but I cannot identify the first base case."
      });
    }, 9000);
  }
  return socket;
}

async function main(): Promise<void> {
  const health = await fetch(`${SERVER_URL}/health`);
  if (!health.ok) throw new Error(`Server health check failed: ${health.status}`);
  console.log(`[sim] Starting ${scenarios.length} students against ${SERVER_URL}`);
  const sockets = scenarios.map(runStudent);
  if (DURATION > 0) {
    setTimeout(() => {
      sockets.forEach((socket) => socket.disconnect());
      console.log(`[sim] Completed ${DURATION}ms smoke run.`);
      process.exit(0);
    }, DURATION);
  }
}

main().catch((error) => {
  console.error("[sim] Failed:", error);
  process.exit(1);
});
