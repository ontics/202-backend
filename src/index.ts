import express, { Request, Response, RequestHandler } from 'express';
import http from 'http';
import cors from 'cors';
import { nanoid } from 'nanoid';
import axios from 'axios';
import { Server } from 'socket.io';
import { descriptionStore } from './imageDescriptions.js';
import { ACTIVE_IMAGE_SET } from './imageSets.js';
import type { 
  GameState, 
  GameImage, 
  Player, 
  Team, 
  Tag, 
  SwitchTeamData, 
  SocketType,
  CustomRequest,
  SimilarityApiResponse 
} from './types.js';

const app = express();
const server = http.createServer(app);

// Configure CORS for socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const SIMILARITY_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://127.0.0.1:5000";

// Store rooms in memory
const rooms = new Map<string, GameState>();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Warmup similarity service
const warmupSimilarityService = async () => {
  try {
    const response = await axios.get(`${SIMILARITY_SERVICE_URL}/health`);
    console.log('Similarity service health check:', response.data);
  } catch (error) {
    console.error('Error warming up similarity service:', error);
  }
};

// Create room endpoint
app.post('/api/rooms', async (_req: Request, res: Response) => {
  await warmupSimilarityService();
  
  const roomId = nanoid(6);
  const room: GameState = {
    id: roomId,
    roomId,
    players: [],
    phase: 'lobby',
    images: ACTIVE_IMAGE_SET.map((url: string) => ({
      id: nanoid(),
      url,
      team: Math.random() < 0.5 ? 'green' : 'purple',
      tags: [],
      selected: false,
      matched: false
    })),
    currentTurn: 'green',
    timeRemaining: 120,
    winner: null,
    gameStats: {
      green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
      purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
    }
  };
  
  rooms.set(roomId, room);
  res.json({ roomId });
});

// Get room endpoint
app.get('/api/rooms/:roomId', (req: Request, res: Response) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  
  res.json(room);
});

// Test gameplay endpoint
const testGameplayHandler: RequestHandler = async (req: CustomRequest, res: Response) => {
  const { word, description, model = 'use' } = req.query;
  
  if (!word || !description) {
    res.status(400).json({ 
      error: 'Please provide both word and description parameters' 
    });
    return;
  }

  const startTime = Date.now();
  
  try {
    const response = await axios.post<SimilarityApiResponse>(`${SIMILARITY_SERVICE_URL}/compare`, {
      word,
      description,
      model
    });

    const timeTaken = Date.now() - startTime;

    res.json({
      word,
      description,
      similarity: response.data.similarity,
      model,
      timeTaken
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate similarity' });
  }
};

app.get('/api/test-gameplay', testGameplayHandler);

// Socket.io connection handler
io.on('connection', (socket: SocketType) => {
  console.log('Client connected:', socket.id);
  
  let currentPlayer: Player | null = null;

  socket.on('join-room', ({ roomId, player }: { roomId: string; player: Player }) => {
    console.log('Player joining room:', { roomId, player });
    const room = rooms.get(roomId);
    if (!room) {
      console.error('Room not found:', roomId);
      return;
    }

    // Rest of the socket handlers...
// ... existing code ... 