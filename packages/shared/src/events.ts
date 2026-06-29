export type StudentStatus =
  | "active"
  | "idle"
  | "stuck"
  | "needs_help"
  | "offline";

export type SessionEventType =
  | "join"
  | "snapshot"
  | "help_request"
  | "hint_received"
  | "hint_read"
  | "pair_start"
  | "pair_swap"
  | "disconnect";

export interface SessionEvent {
  id: string;
  timestamp: number;
  type: SessionEventType;
  fileName?: string;
  languageId?: string;
  content?: string;
  cursorLine?: number;
  idleMs?: number;
  meta?: Record<string, unknown>;
}

export interface StudentJoinPayload {
  roomCode: string;
  studentId: string;
  displayName: string;
  token?: string;
}

export interface InstructorJoinPayload {
  roomCode: string;
  instructorName: string;
  token: string;
}

export interface SessionInfo {
  id: string;
  roomCode: string;
  title: string;
  assignmentName: string;
  instructorName: string;
  active: boolean;
  expiresAt: number | null;
}

export interface CodeSnapshotPayload {
  studentId: string;
  roomCode: string;
  displayName: string;
  fileName: string;
  languageId: string;
  content: string;
  cursorLine: number;
  timestamp: number;
  idleMs: number;
  errorCount?: number;
  selectionStartLine?: number;
  selectionEndLine?: number;
}

export interface HelpRequestPayload {
  studentId: string;
  roomCode: string;
  message?: string;
}

export interface SendHintPayload {
  roomCode: string;
  hint: string;
  codeSnippet?: string;
  targetStudentId?: string;
  instructorName: string;
}

export interface Hint {
  id: string;
  roomCode: string;
  hint: string;
  codeSnippet?: string;
  targetStudentId?: string;
  instructorName: string;
  sentAt: number;
  readBy: string[];
  aiGenerated: boolean;
}

export interface AiHintRequest {
  roomCode: string;
  studentId: string;
}

export interface PairAssignmentPayload {
  roomCode: string;
  studentAId: string;
  studentBId: string;
  swapInMs?: number;
}

export interface PairAssignment {
  partnerId: string;
  partnerName: string;
  role: "driver" | "observer";
  swapInMs: number;
  assignedAt: number;
}

export interface StudentState {
  studentId: string;
  displayName: string;
  roomCode: string;
  fileName: string;
  languageId: string;
  content: string;
  cursorLine: number;
  lastSeen: number;
  idleMs: number;
  errorCount: number;
  status: StudentStatus;
  stuckScore: number;
  stuckFlag: boolean;
  helpRequested: boolean;
  connected: boolean;
  selectionStartLine: number;
  selectionEndLine: number;
  focusProtected: boolean;
  editRate: number;
  riskTrend: "stable" | "rising" | "falling";
  socketId?: string;
  pairPartnerId?: string;
  pairRole?: "driver" | "observer";
  sessionEvents: SessionEvent[];
}

export interface StuckAlert {
  id: string;
  roomCode: string;
  studentId?: string;
  displayName: string;
  idleMs: number;
  stuckScore: number;
  lastCode: string;
  fileName: string;
  message: string;
  suggestedHint?: string;
  commonPattern: boolean;
  createdAt: number;
}

export interface ClassroomState {
  id: string;
  roomCode: string;
  title: string;
  assignmentName: string;
  instructorId: string;
  instructorName: string;
  active: boolean;
  endedAt: number | null;
  expiresAt: number | null;
  students: StudentState[];
  hints: Hint[];
  alerts: StuckAlert[];
  createdAt: number;
}

export interface ReplayData {
  studentId: string;
  displayName: string;
  events: SessionEvent[];
}

export interface HeatmapEntry {
  fileName: string;
  lineNumber: number;
  struggleCount: number;
  totalIdleMs: number;
}

export interface AnalyticsReport {
  roomCode: string;
  totalStudents: number;
  connectedStudents: number;
  stuckStudents: number;
  helpRequests: number;
  hintsSent: number;
  averageIdleMs: number;
  heatmap: HeatmapEntry[];
  timeline: AnalyticsTimelinePoint[];
  teachingMoments: TeachingMoment[];
  generatedAt: number;
}

export interface AnalyticsTimelinePoint {
  timestamp: number;
  activeCount: number;
  stuckCount: number;
  idleCount: number;
  helpCount: number;
  averageStuckScore: number;
}

export interface TeachingMoment {
  id: string;
  sessionId: string;
  studentId: string;
  title: string;
  reason: string;
  startAt: number;
  endAt: number;
  createdAt: number;
}

export interface GroupSuggestion {
  studentIds: string[];
  studentNames: string[];
  reason: string;
}

export interface ClassPulsePayload {
  roomCode: string;
  timestamp: number;
  activeCount: number;
  stuckCount: number;
  editRate: number;
}

export interface ProgressReceipt {
  sessionId: string;
  roomCode: string;
  studentId: string;
  displayName: string;
  codingMs: number;
  activeRatio: number;
  trickyRatio: number;
  hintsReceived: number;
  hintsRead: number;
  endedAt: number | null;
}

export interface ActiveSessionSummary {
  id: string;
  roomCode: string;
  title: string;
  assignmentName: string;
  instructorName: string;
  studentCount: number;
  stuckCount: number;
  pulse: ClassPulsePayload[];
}

export interface IntegrityPair {
  student1Id: string;
  student2Id: string;
  student1Name: string;
  student2Name: string;
  similarityScore: number;
  evidence: string;
}

export interface IntegrityReport {
  suspectedPairs: IntegrityPair[];
  generatedAt: number;
}

export interface ServerToClientEvents {
  [EVENTS.SESSION_INFO]: (info: SessionInfo) => void;
  [EVENTS.SESSION_ENDED]: (data: { roomCode: string; endedAt: number }) => void;
  [EVENTS.STUDENT_JOINED]: (student: StudentState) => void;
  [EVENTS.CLASSROOM_STATE]: (state: ClassroomState) => void;
  [EVENTS.STUDENT_UPDATE]: (student: StudentState) => void;
  [EVENTS.STUCK_ALERT]: (alert: StuckAlert) => void;
  [EVENTS.HINT_RECEIVE]: (hint: Hint) => void;
  [EVENTS.HINT_SENT]: (hint: Hint) => void;
  [EVENTS.HINT_READ_RECEIPT]: (data: { hintId: string; studentId: string }) => void;
  [EVENTS.AI_HINT_RESULT]: (data: { studentId: string; hint: string; cached: boolean }) => void;
  [EVENTS.PAIR_ASSIGNED]: (assignment: PairAssignment) => void;
  [EVENTS.PAIR_SWAP]: (assignment: PairAssignment) => void;
  [EVENTS.REPLAY_DATA]: (data: ReplayData) => void;
  [EVENTS.CLASS_PULSE]: (data: ClassPulsePayload) => void;
  [EVENTS.ERROR]: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  [EVENTS.STUDENT_JOIN]: (payload: StudentJoinPayload) => void;
  [EVENTS.INSTRUCTOR_JOIN]: (payload: InstructorJoinPayload) => void;
  [EVENTS.CODE_SNAPSHOT]: (payload: CodeSnapshotPayload) => void;
  [EVENTS.HELP_REQUEST]: (payload: HelpRequestPayload) => void;
  [EVENTS.SEND_HINT]: (payload: SendHintPayload) => void;
  [EVENTS.REQUEST_AI_HINT]: (payload: AiHintRequest) => void;
  [EVENTS.HINT_READ]: (payload: { roomCode: string; studentId: string; hintId: string }) => void;
  [EVENTS.ASSIGN_PAIR]: (payload: PairAssignmentPayload) => void;
  [EVENTS.REQUEST_REPLAY]: (payload: { roomCode: string; studentId: string }) => void;
  [EVENTS.END_SESSION]: (payload: { roomCode: string }) => void;
}

export const EVENTS = {
  STUDENT_JOIN: "student:join",
  INSTRUCTOR_JOIN: "instructor:join",
  CODE_SNAPSHOT: "code:snapshot",
  HELP_REQUEST: "help:request",
  SEND_HINT: "instructor:hint",
  REQUEST_AI_HINT: "instructor:aiHint",
  HINT_READ: "student:hintRead",
  ASSIGN_PAIR: "instructor:pair",
  REQUEST_REPLAY: "replay:request",
  CLASSROOM_STATE: "classroom:state",
  STUDENT_UPDATE: "student:update",
  STUCK_ALERT: "stuck:alert",
  HINT_RECEIVE: "hint:receive",
  HINT_SENT: "hint:sent",
  HINT_READ_RECEIPT: "hint:readReceipt",
  AI_HINT_RESULT: "hint:aiResult",
  PAIR_ASSIGNED: "pair:assigned",
  PAIR_SWAP: "pair:swap",
  REPLAY_DATA: "replay:data",
  ERROR: "collabcode:error",
  SESSION_INFO: "session:info",
  SESSION_ENDED: "session:ended",
  STUDENT_JOINED: "student:joined"
  ,END_SESSION: "instructor:endSession",
  CLASS_PULSE: "analytics:classPulse"
} as const;
