import express, { Request, Response, RequestHandler } from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { nanoid } from 'nanoid';
import cors from 'cors';
import axios from 'axios';
import { descriptionStore } from './imageDescriptions.js';
import { ACTIVE_IMAGE_SET } from './imageSets.js';
import {
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
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SIMILARITY_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://127.0.0.1:5000";

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: FRONTEND_URL
}));

// In-memory store (replace with a database in production)
const rooms = new Map<string, GameState>();

async function warmupSimilarityService() {
  try {
    const response = await axios.get(`${SIMILARITY_SERVICE_URL}/health`);
    console.log('Similarity service health check:', response.data);
  } catch (error) {
    console.error('Error warming up similarity service:', error);
  }
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

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
const testGameplay: RequestHandler = async (req: CustomRequest, res: Response) => {
  const { word, description, model = 'use' } = req.query;
  
  if (!word || !description) {
    res.status(400).json({ 
      error: 'Please provide both word and description parameters' 
    });
    return;
  }

  const startTime = Date.now();
  
  try {
    const response = await axios.post<SimilarityApiResponse>(
      `${SIMILARITY_SERVICE_URL}/compare`,
      { word, description, model }
    );

    res.json({
      word,
      description,
      similarity: response.data.similarity,
      model,
      timeTaken: Date.now() - startTime
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate similarity' });
  }
};

app.get('/api/test-gameplay', testGameplay);

// Clear descriptions endpoint
app.post('/api/clear-descriptions', (_req: Request, res: Response) => {
  try {
    descriptionStore.clearAllDescriptions();
    res.status(200).json({ message: 'All descriptions cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear descriptions' });
  }
});

// Development endpoints
if (process.env.NODE_ENV === 'development') {
  app.post('/api/dev/skip-to-phase', (req: Request, res: Response) => {
    const { roomId, phase } = req.body;
    const room = rooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.phase = phase as GameState['phase'];
    room.timeRemaining = 90;
    io.to(roomId).emit('room-updated', room);
    res.json({ success: true });
  });
}

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

    currentPlayer = player;
    
    // Check if player already exists in the room
    const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
    
    if (existingPlayerIndex === -1) {
      // Only set as admin if this is the first player
      if (room.players.length === 0) {
        player.isRoomAdmin = true;
      }
      room.players.push(player);
    } else {
      // Update existing player data
      room.players[existingPlayerIndex] = {
        ...room.players[existingPlayerIndex],
        ...player,
        isRoomAdmin: room.players[existingPlayerIndex].isRoomAdmin // Preserve admin status
      };
    }
    
    socket.join(roomId);
    socket.emit('game-state', room);
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('disconnect', () => {
    if (currentPlayer) {
      const room = rooms.get(currentPlayer.roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== currentPlayer?.id);
        io.to(currentPlayer.roomId).emit('room-updated', room);
      }
    }
  });

  socket.on('switch-team', ({ roomId, playerId, newTeam }: SwitchTeamData) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.map(p =>
      p.id === playerId ? { ...p, team: newTeam } : p
    );
    
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('start-game', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Create array of exactly 15 images
    const images = ACTIVE_IMAGE_SET.slice(0, 15).map(url => ({
      id: nanoid(),
      url,
      team: 'unassigned' as Team | 'red',
      tags: [],
      selected: false,
      matched: false
    }));

    // Create array of indices and shuffle
    const indices = Array.from({ length: 15 }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Assign teams
    for (let i = 0; i < 7; i++) {
      images[indices[i]].team = 'green';
    }
    for (let i = 7; i < 14; i++) {
      images[indices[i]].team = 'purple';
    }
    images[indices[14]].team = 'red';

    room.images = images;
    room.phase = 'playing';
    room.timeRemaining = 120;
    room.currentTurn = 'green';
    room.winner = null;

    io.to(roomId).emit('game-started', roomId);
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('submit-tag', ({ roomId, playerId, imageId, tag }: { 
    roomId: string;
    playerId: string;
    imageId: string;
    tag: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    
    const image = room.images.find(img => img.id === imageId);
    if (image) {
      image.tags.push({ text: tag, playerId, playerNickname: '' });
      io.to(roomId).emit('image-updated', { roomId, imageId, image });
    }
  });

  socket.on('select-image', ({ roomId, playerId, imageId }: {
    roomId: string;
    playerId: string;
    imageId: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    
    const image = room.images.find(img => img.id === imageId);
    if (image) {
      image.selected = true;
      if (image.team === room.currentTurn) {
        image.matched = true;
      }
      room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
      io.to(roomId).emit('room-updated', room);
    }
  });

  const storeDescriptionsFromImages = (images: GameImage[], roomId: string) => {
    images.forEach(image => {
      if (image.tags && image.tags.length > 0) {
        image.tags.forEach(tag => {
          descriptionStore.addDescription(image.url, tag.text);
        });
      }
    });
  };

  socket.on('phase-change', ({ roomId, phase, images }: {
    roomId: string;
    phase: GameState['phase'];
    images?: GameImage[];
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (phase === 'guessing' && (room.phase === 'playing' || room.phase === 'lobby')) {
      storeDescriptionsFromImages(room.images, roomId);
      if (images) {
        storeDescriptionsFromImages(images, roomId);
      }
    }

    room.phase = phase;
    if (images) {
      room.images = images;
    }

    if (phase === 'guessing') {
      room.timeRemaining = 60;
      room.currentTurn = 'green';
    }

    io.to(roomId).emit('room-updated', room);
  });

  socket.on('timer-expired', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    storeDescriptionsFromImages(room.images, roomId);
    
    room.phase = 'guessing';
    room.timeRemaining = 60;
    room.currentTurn = 'green';
    room.images = room.images.map(img => ({ ...img, selected: false }));

    rooms.set(roomId, room);
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('timer-update', ({ roomId, timeRemaining }: {
    roomId: string;
    timeRemaining: number;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.timeRemaining = timeRemaining;
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('switch-role', ({ roomId, playerId }: {
    roomId: string;
    playerId: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players = room.players.map(p =>
      p.id === playerId 
        ? { ...p, role: p.role === 'tagger' ? 'codebreaker' : 'tagger' }
        : p
    );
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('reset-game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.phase = 'lobby';
    room.timeRemaining = 120;
    room.currentTurn = 'green';
    room.winner = null;
    room.images = ACTIVE_IMAGE_SET.map(url => ({
      id: nanoid(),
      url,
      team: Math.random() < 0.5 ? 'green' : 'purple',
      tags: [],
      selected: false,
      matched: false
    }));
    io.to(roomId).emit('room-updated', room);
  });

  socket.on('add-tag', ({ roomId, imageId, tag, playerId, playerNickname }: {
    roomId: string;
    imageId: string;
    tag: string;
    playerId: string;
    playerNickname: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const image = room.images.find(img => img.id === imageId);
    if (image) {
      image.tags = image.tags.filter(t => t.playerId !== playerId);
      image.tags.push({ text: tag, playerId, playerNickname });
      
      rooms.set(roomId, room);

      if (room.phase === 'playing') {
        socket.emit('image-updated', {
          roomId,
          imageId,
          image: {
            ...image,
            tags: image.tags.filter(t => t.playerId === playerId)
          }
        });
      } else {
        io.to(roomId).emit('image-updated', {
          roomId,
          imageId,
          image
        });
      }
    }
  });

  socket.on('submit-guess', async ({ roomId, playerId, word, count }: {
    roomId: string;
    playerId: string;
    word: string;
    count: number;
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const currentPlayer = room.players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.team !== room.currentTurn) return;

    const imageMatches = await Promise.all(
      room.images
        .filter(img => !img.matched)
        .map(async img => {
          const playerTags = img.tags.map(t => t.text);
          const storedDescriptions = descriptionStore.getDescriptions(img.url, playerTags);
          const allDescriptions = [...playerTags, ...storedDescriptions];

          let maxSimilarity = 0;
          let bestDescription = '';
          let bestTag = null;

          for (const desc of allDescriptions) {
            try {
              const response = await axios.post<SimilarityApiResponse>(
                `${SIMILARITY_SERVICE_URL}/compare`,
                {
                  word: word.toLowerCase(),
                  description: desc.toLowerCase(),
                  model: 'sbert'
                }
              );
              
              if (response.data.similarity > maxSimilarity) {
                maxSimilarity = response.data.similarity;
                bestDescription = desc;
                bestTag = img.tags.find(t => t.text === desc);
              }
            } catch (error) {
              console.error('Error calculating similarity:', error);
            }
          }

          return {
            image: img,
            similarity: maxSimilarity,
            matchedDescription: bestDescription,
            matchedTag: bestTag
          };
        })
    );

    const matches = imageMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count);

    io.to(roomId).emit('guess-start');
    await new Promise(resolve => setTimeout(resolve, 3000));

    for (const match of matches) {
      const image = match.image;
      
      image.matched = true;
      image.matchedWord = word;
      image.similarity = match.similarity;
      image.matchedTag = match.matchedTag || undefined;

      io.to(roomId).emit('room-updated', room);

      if (image.team === 'red') {
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.phase = 'gameOver';
        room.winner = room.currentTurn === 'green' ? 'purple' : 'green';
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      if (image.team !== room.currentTurn) {
        room.gameStats![room.currentTurn].incorrectGuesses++;
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      room.gameStats![room.currentTurn].correctGuesses++;
      room.gameStats![room.currentTurn].totalSimilarity += match.similarity;

      const unmatched = room.images.filter(img => !img.matched && img.team === room.currentTurn);
      if (unmatched.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.phase = 'gameOver';
        room.winner = room.currentTurn;
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 3500));
    }

    if (room.phase !== 'gameOver') {
      room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
      io.to(roomId).emit('room-updated', room);
    }
    io.to(roomId).emit('guess-end');
  });

  socket.on('set-role', ({ roomId, playerId, role }: {
    roomId: string;
    playerId: string;
    role: Player['role'];
  }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.role = role;
      io.to(roomId).emit('room-updated', room);
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});