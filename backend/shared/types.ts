export type SymbolChar = "★" | "●" | "♥" | "■" | "▲" | "◆" | "☀" | "☂";

export interface Player {
  userId: string;
  displayName?: string;
  score: number;
}

// Client -> Server messages
export interface JoinRoomMessage {
  type: "join_room";
  roomId: string;
  userId: string;
}

export interface SubmitSequenceMessage {
  type: "submit_sequence";
  round: number;
  userId: string;
  sequence: SymbolChar[];
  timeMs: number;
}

export interface PlayerReadyMessage {
  type: "player_ready";
  userId: string;
}

export type ClientToServerMessage =
  | JoinRoomMessage
  | SubmitSequenceMessage
  | PlayerReadyMessage;

// Server -> Client messages
export interface RoomStateMessage {
  type: "room_state";
  roomId: string;
  players: Player[];
  status: "waiting" | "in_round" | "finished";
}

export interface RoundStartMessage {
  type: "round_start";
  round: number;
  sequence: SymbolChar[];
  displayMs: number;
}

export interface EnterSequenceMessage {
  type: "enter_sequence";
  round: number;
}

export interface RoundResultMessage {
  type: "round_result";
  round: number;
  correctSequence: SymbolChar[];
  roundWinnerUserId: string | null;
  scores: Record<string, number>; // userId -> score
}

export interface MatchEndMessage {
  type: "match_end";
  winnerUserId: string;
  scores: Record<string, number>;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export interface PlayerReadyServerMessage {
  type: "player_ready";
  userId: string;
}

export type ServerToClientMessage =
  | RoomStateMessage
  | RoundStartMessage
  | EnterSequenceMessage
  | RoundResultMessage
  | MatchEndMessage
  | ErrorMessage
  | PlayerReadyServerMessage;
