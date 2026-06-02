export interface MatchParticipant {
  id: string;
  username: string;
}

export interface MatchSummary {
  id: string;
  gameId: string;
  finishedAt: string;
  participants: MatchParticipant[];
  winnerId: string | null;
  winnerName: string | null;
  turns: number;
}
