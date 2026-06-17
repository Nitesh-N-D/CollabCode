import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import * as vscode from "vscode";
import {
  EVENTS,
  type ClientToServerEvents,
  type Hint,
  type PairAssignment,
  type ServerToClientEvents,
  type SessionEvent
} from "@collabcode/shared";

type CollabSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface LocalSession {
  roomCode: string;
  studentId: string;
  displayName: string;
  joinedAt: number;
  events: SessionEvent[];
}

class CollabCodeClient implements vscode.Disposable {
  private socket?: CollabSocket;
  private session?: LocalSession;
  private readonly status: vscode.StatusBarItem;
  private snapshotTimer?: NodeJS.Timeout;
  private lastEditAt = Date.now();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.status.command = "collabcode.joinRoom";
    this.status.text = "$(radio-tower) CollabCode: Join";
    this.status.tooltip = "Join a CollabCode classroom";
    this.status.show();
    this.disposables.push(
      this.status,
      vscode.workspace.onDidChangeTextDocument(() => {
        this.lastEditAt = Date.now();
      }),
      vscode.window.onDidChangeTextEditorSelection(() => this.sendSnapshot())
    );
  }

  async join(): Promise<void> {
    const previous = this.context.globalState.get<string>("collabcode.roomCode");
    const roomCode = await vscode.window.showInputBox({
      prompt: "Enter the classroom room code",
      placeHolder: "CS101",
      value: previous
    });
    if (!roomCode) return;
    const config = vscode.workspace.getConfiguration("collabcode");
    let displayName = config.get<string>("displayName")?.trim();
    if (!displayName) {
      displayName = await vscode.window.showInputBox({
        prompt: "Name shown to your instructor",
        placeHolder: "Asha Rao"
      });
    }
    if (!displayName) return;
    const studentId =
      this.context.globalState.get<string>("collabcode.studentId") ?? randomUUID();
    await this.context.globalState.update("collabcode.studentId", studentId);
    await this.context.globalState.update("collabcode.roomCode", roomCode.toUpperCase());
    this.leave(false);
    this.session = {
      roomCode: roomCode.toUpperCase(),
      studentId,
      displayName,
      joinedAt: Date.now(),
      events: []
    };
    const serverUrl = config.get<string>("serverUrl") ?? "http://localhost:4000";
    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000
    });
    this.socket.on("connect", () => {
      if (!this.session) return;
      this.socket?.emit(EVENTS.STUDENT_JOIN, {
        roomCode: this.session.roomCode,
        studentId: this.session.studentId,
        displayName: this.session.displayName,
        token: "extension-local"
      });
      this.status.text = `$(broadcast) CollabCode: ${this.session.roomCode}`;
      this.status.backgroundColor = undefined;
    });
    this.socket.on("disconnect", () => {
      this.status.text = "$(sync~spin) CollabCode: Reconnecting";
      this.status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    });
    this.socket.on(EVENTS.HINT_RECEIVE, (hint) => this.receiveHint(hint));
    this.socket.on(EVENTS.PAIR_ASSIGNED, (pair) => this.receivePair(pair, false));
    this.socket.on(EVENTS.PAIR_SWAP, (pair) => this.receivePair(pair, true));
    this.socket.on(EVENTS.ERROR, ({ message }) =>
      vscode.window.showErrorMessage(`CollabCode: ${message}`)
    );
    const interval = Math.max(1000, config.get<number>("snapshotIntervalMs") ?? 2000);
    this.snapshotTimer = setInterval(() => this.sendSnapshot(), interval);
    this.sendSnapshot();
    void vscode.window.showInformationMessage(`Joined CollabCode room ${this.session.roomCode}.`);
  }

  requestHelp(): void {
    if (!this.session || !this.socket) {
      void vscode.window.showWarningMessage("Join a CollabCode room first.");
      return;
    }
    void vscode.window
      .showInputBox({
        prompt: "Optional private note for your instructor",
        placeHolder: "I am unsure how to start the base case"
      })
      .then((message) => {
        if (!this.session) return;
        this.socket?.emit(EVENTS.HELP_REQUEST, {
          roomCode: this.session.roomCode,
          studentId: this.session.studentId,
          message
        });
        void vscode.window.showInformationMessage("Your instructor was notified privately.");
      });
  }

  async exportSession(): Promise<void> {
    if (!this.session) {
      void vscode.window.showWarningMessage("There is no CollabCode session to export.");
      return;
    }
    const destination = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(
        `collabcode-${this.session.roomCode}-${new Date().toISOString().slice(0, 10)}.json`
      ),
      filters: { JSON: ["json"] }
    });
    if (!destination) return;
    await vscode.workspace.fs.writeFile(
      destination,
      Buffer.from(JSON.stringify(this.session, null, 2), "utf8")
    );
    void vscode.window.showInformationMessage("CollabCode session exported.");
  }

  leave(notify = true): void {
    if (this.snapshotTimer) clearInterval(this.snapshotTimer);
    this.snapshotTimer = undefined;
    this.socket?.disconnect();
    this.socket = undefined;
    this.session = undefined;
    this.status.text = "$(radio-tower) CollabCode: Join";
    this.status.backgroundColor = undefined;
    if (notify) void vscode.window.showInformationMessage("Left the CollabCode room.");
  }

  dispose(): void {
    this.leave(false);
    for (const disposable of this.disposables) disposable.dispose();
  }

  private sendSnapshot(): void {
    if (!this.session || !this.socket?.connected) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== "file") return;
    const timestamp = Date.now();
    const event: SessionEvent = {
      id: randomUUID(),
      type: "snapshot",
      timestamp,
      fileName: vscode.workspace.asRelativePath(editor.document.uri),
      languageId: editor.document.languageId,
      content: editor.document.getText(),
      cursorLine: editor.selection.active.line + 1,
      idleMs: timestamp - this.lastEditAt
    };
    this.session.events.push(event);
    if (this.session.events.length > 10_000) this.session.events.shift();
    this.socket.emit(EVENTS.CODE_SNAPSHOT, {
      roomCode: this.session.roomCode,
      studentId: this.session.studentId,
      displayName: this.session.displayName,
      fileName: event.fileName!,
      languageId: event.languageId!,
      content: event.content!,
      cursorLine: event.cursorLine!,
      timestamp,
      idleMs: event.idleMs!,
      errorCount: vscode.languages
        .getDiagnostics(editor.document.uri)
        .filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error).length
    });
  }

  private receiveHint(hint: Hint): void {
    if (!this.session) return;
    this.session.events.push({
      id: randomUUID(),
      type: "hint_received",
      timestamp: Date.now(),
      meta: { hintId: hint.id, hint: hint.hint }
    });
    const action = hint.codeSnippet ? "Show code note" : "Mark read";
    void vscode.window
      .showInformationMessage(`CollabCode hint: ${hint.hint}`, action)
      .then(async (choice) => {
        if (choice === "Show code note" && hint.codeSnippet) {
          const document = await vscode.workspace.openTextDocument({
            content: hint.codeSnippet,
            language: vscode.window.activeTextEditor?.document.languageId ?? "plaintext"
          });
          await vscode.window.showTextDocument(document, { preview: true });
        }
        if (choice && this.session) {
          this.socket?.emit(EVENTS.HINT_READ, {
            roomCode: this.session.roomCode,
            studentId: this.session.studentId,
            hintId: hint.id
          });
        }
      });
  }

  private receivePair(pair: PairAssignment, swapped: boolean): void {
    const verb = swapped ? "Roles swapped" : "Pair assigned";
    void vscode.window.showInformationMessage(
      `${verb}: you are the ${pair.role} with ${pair.partnerName}.`
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const client = new CollabCodeClient(context);
  context.subscriptions.push(
    client,
    vscode.commands.registerCommand("collabcode.joinRoom", () => client.join()),
    vscode.commands.registerCommand("collabcode.leaveRoom", () => client.leave()),
    vscode.commands.registerCommand("collabcode.requestHelp", () => client.requestHelp()),
    vscode.commands.registerCommand("collabcode.exportSession", () => client.exportSession())
  );
}

export function deactivate(): void {}
