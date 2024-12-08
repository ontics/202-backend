import { Request, Response } from 'express';
import { Socket } from 'socket.io';

export type Team = 'green' | 'purple';
export type GamePhase = 'lobby' | 'playing' | 'guessing' | 'gameOver';
export type Role = 'tagger' | 'codebreaker';

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
  formattedSimilarity?: string;
}

export interface Player {
  id: string;
  nickname: string;
  team: Team;
  role: Role;
  isRoomAdmin: boolean;
  roomId: string;
}

export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: Player[];
  images: GameImage[];
  currentTurn: Team;
  timeRemaining: number;
  winner: Team | null;
}

export interface SwitchTeamData {
  roomId: string;
  playerId: string;
  newTeam: Team;
}

export interface SimilarityApiResponse {
  similarity: number;
}

export type ExpressRequest = Request;
export type ExpressResponse = Response;
export type SocketType = Socket;

export interface Query {
  roomId: string;
} 