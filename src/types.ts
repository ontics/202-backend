import { Socket } from 'socket.io';
import { Request, Response } from 'express';

export type Team = 'green' | 'purple';
export type PlayerRole = 'codebreaker' | 'tagger';
export type GamePhase = 'lobby' | 'playing' | 'guessing' | 'gameOver';

export interface Player {
  id: string;
  nickname: string;
  team: Team;
  role: PlayerRole;
  isRoomAdmin: boolean;
  roomId: string;
}

export interface Tag {
  text: string;
  playerId: string;
  playerNickname: string;
}

export interface GameImage {
  id: string;
  url: string;
  team: Team | 'red';
  tags: Tag[];
  selected: boolean;
  matched: boolean;
  matchedWord?: string;
  matchedTag?: Tag;
  similarity?: number;
}

export interface GameStats {
  correctGuesses: number;
  incorrectGuesses: number;
  totalSimilarity: number;
}

export interface GameState {
  id: string;
  roomId: string;
  players: Player[];
  phase: GamePhase;
  images: GameImage[];
  currentTurn: Team;
  timeRemaining: number;
  winner: Team | null;
  gameStats?: {
    green: GameStats;
    purple: GameStats;
  };
}

export interface SwitchTeamData {
  roomId: string;
  playerId: string;
  newTeam: Team;
}

export interface CustomRequest extends Request {
  query: {
    word?: string;
    description?: string;
    model?: 'use' | 'sbert';
  };
}

export interface SimilarityApiResponse {
  similarity: number;
  model: 'use' | 'sbert';
}

export type SocketType = Socket; 