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
const FRONTEND_URLS = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "https://202-frontend.vercel.app"
];
const SIMILARITY_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://two02-similarity-service.onrender.com'
    : 'http://localhost:5000');

console.log(`[${new Date().toISOString()}] Starting server with configuration:`, {
  NODE_ENV: process.env.NODE_ENV,
  SIMILARITY_SERVICE_URL,
  FRONTEND_URLS
});

// Initialize similarity service
let similarityServiceReady = false;

async function warmupSimilarityService() {
  try {
    console.log(`[${new Date().toISOString()}] Warming up similarity service at: ${SIMILARITY_SERVICE_URL}`);
    
    // First check health with a shorter timeout
    const response = await axios.get(`${SIMILARITY_SERVICE_URL}/health`, { 
      timeout: 5000 
    });
    console.log(`[${new Date().toISOString()}] Similarity service health check response:`, response.data);
    
    if (response.data.status !== 'healthy' || response.data.model_status !== 'loaded') {
      console.log(`[${new Date().toISOString()}] Service not ready yet, status:`, response.data);
      return false;
    }
    
    // Test the similarity service with a longer timeout for the first request
    const testResponse = await axios.post(`${SIMILARITY_SERVICE_URL}/compare`, {
      word: "test",
      description: "test",
      model: "sbert"
    }, { 
      timeout: 30000  // 30 second timeout for the first request
    });
    console.log(`[${new Date().toISOString()}] Similarity service test comparison response:`, testResponse.data);
    
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Similarity service error:`, {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        url: error.config?.url,
        timeout: error.code === 'ECONNABORTED'
      });
    } else {
      console.error(`[${new Date().toISOString()}] Unknown error connecting to similarity service:`, error);
    }
    return false;
  }
}

// Initial warmup
warmupSimilarityService();

// Periodic warmup every 5 minutes
setInterval(warmupSimilarityService, 5 * 60 * 1000);

async function getSimilarityBatch(comparisons: { word: string, description: string }[]) {
  // If service isn't ready, try to warm it up first
  if (!similarityServiceReady) {
    await warmupSimilarityService();
  }

  try {
    console.log(`[${new Date().toISOString()}] Calculating batch similarity for ${comparisons.length} pairs`);
    const response = await axios.post(`${SIMILARITY_SERVICE_URL}/compare-batch`, comparisons, {
      timeout: 30000
    });
    console.log(`[${new Date().toISOString()}] Batch similarity response:`, response.data);
    similarityServiceReady = true;
    return response.data;
  } catch (error) {
    similarityServiceReady = false;
    if (axios.isAxiosError(error)) {
      console.error(`[${new Date().toISOString()}] Batch similarity calculation error:`, {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        url: error.config?.url
      });
      // Provide fallback similarities
      return comparisons.map(({ word, description }) => {
        const w = word.toLowerCase();
        const d = description.toLowerCase();
        if (w === d) return { similarity: 1.0, model: 'sbert' };
        if (w.includes(d) || d.includes(w)) return { similarity: 0.8, model: 'sbert' };
        return { similarity: 0.0, model: 'sbert' };
      });
    }
    throw error;
  }
}

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URLS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Enable CORS for all routes
app.use(cors({
  origin: FRONTEND_URLS,
  credentials: true
}));

// Add request logging middleware
app.use((req: Request, res: Response, next) => {
  console.log(`${req.method} ${req.path}`, {
    origin: req.headers.origin,
    host: req.headers.host
  });
  next();
});

// In-memory store (replace with a database in production)
const rooms = new Map<string, GameState>();

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Create room endpoint
app.post('/api/rooms', async (_req: Request, res: Response) => {
  console.log(`[${new Date().toISOString()}] Attempting to create room`);
  try {
    // Try to warm up similarity service but don't wait for the result
    warmupSimilarityService().catch(console.error);
    
    const roomId = nanoid(6);
    console.log(`[${new Date().toISOString()}] Generated room ID:`, roomId);
    
    const room: GameState = {
      id: roomId,
      roomId,
      players: [],
      phase: 'lobby',
      images: ACTIVE_IMAGE_SET.map((imageInfo) => ({
        id: nanoid(),
        url: imageInfo.url,
        team: Math.random() < 0.5 ? 'green' : 'purple',
        tags: [],
        selected: false,
        matched: false,
        matchedWord: '',
        similarity: 0
      })),
      currentTurn: 'green',
      timeRemaining: 120,
      winner: null,
      gameStats: {
        green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
        purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
      }
    };

    // Set default descriptions for each image
    ACTIVE_IMAGE_SET.forEach((imageInfo) => {
      descriptionStore.setDefaultDescription(imageInfo.url, imageInfo.defaultDescription);
    });
    
    rooms.set(roomId, room);
    console.log(`[${new Date().toISOString()}] Room created successfully:`, roomId);
    res.json({ roomId });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error creating room:`, error);
    res.status(500).json({ error: 'Failed to create room' });
  }
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
app.post('/api/clear-descriptions/:roomId', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    descriptionStore.clearRoomDescriptions(roomId);
    res.json({ success: true });
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

  socket.on('start-game', async (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // Start warming up the service but don't wait for it
    warmupSimilarityService().catch(console.error);

    // Create array of exactly 15 images
    const images = ACTIVE_IMAGE_SET.slice(0, 15).map(imageInfo => ({
      id: nanoid(),
      url: imageInfo.url,
      team: 'unassigned' as Team | 'red',
      tags: [],
      selected: false,
      matched: false,
      matchedWord: '',
      similarity: 0
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

    // Set default descriptions
    ACTIVE_IMAGE_SET.forEach((imageInfo) => {
      descriptionStore.setDefaultDescription(imageInfo.url, imageInfo.defaultDescription);
    });

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
          descriptionStore.addDescription(roomId, image.url, tag.text);
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
    
    // Clear descriptions for this room
    descriptionStore.clearRoomDescriptions(roomId);
    
    // Reset game state but keep players with their teams and roles
    room.phase = 'lobby';
    room.timeRemaining = 120;
    room.currentTurn = 'green';
    room.winner = null;
    room.images = ACTIVE_IMAGE_SET.map(imageInfo => ({
      id: nanoid(),
      url: imageInfo.url,
      team: Math.random() < 0.5 ? 'green' : 'purple',
      tags: [],
      selected: false,
      matched: false,
      matchedWord: '',
      similarity: 0
    }));
    room.gameStats = {
      green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
      purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
    };

    // Re-set default descriptions
    ACTIVE_IMAGE_SET.forEach((imageInfo) => {
      descriptionStore.setDefaultDescription(imageInfo.url, imageInfo.defaultDescription);
    });

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

    const unmatchedImages = room.images.filter(img => !img.matched);
    const comparisons = [];
    const imageDescriptionCounts = new Map<string, number>();

    // First pass: collect all comparisons and count descriptions per image
    for (const img of unmatchedImages) {
      const playerTags = img.tags.map(t => t.text);
      // Only get stored descriptions if there are no player tags
      const descriptions = playerTags.length > 0 
        ? playerTags 
        : descriptionStore.getDescriptions(roomId, img.url);
      
      imageDescriptionCounts.set(img.id, descriptions.length);

      for (const desc of descriptions) {
        comparisons.push({
          word: word.toLowerCase(),
          description: desc.toLowerCase()
        });
      }
    }

    try {
      io.to(roomId).emit('guess-start');

      const similarities = await getSimilarityBatch(comparisons);
      
      // Track which similarities belong to which image
      let currentIndex = 0;
      const imageMatches = unmatchedImages.map(img => {
        const playerTags = img.tags.map(t => t.text);
        // Only get stored descriptions if there are no player tags
        const descriptions = playerTags.length > 0 
          ? playerTags 
          : descriptionStore.getDescriptions(roomId, img.url);
        
        // Find the best similarity among this image's descriptions
        let maxSimilarity = 0;
        let bestDescription = '';
        let bestTag = null;

        // Look at similarities only for this image's descriptions
        descriptions.forEach((desc, i) => {
          const similarity = similarities[currentIndex + i].similarity;
          if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestDescription = desc;
            bestTag = img.tags.find(t => t.text === desc);
          }
        });

        // Move index forward by number of descriptions for this image
        currentIndex += descriptions.length;

        return {
          image: img,
          similarity: maxSimilarity,
          matchedDescription: bestDescription,
          matchedTag: bestTag,
          isDefaultDescription: !bestTag
        };
      });

      console.log(`[${new Date().toISOString()}] Image matches:`, 
        imageMatches.map(m => ({
          imageId: m.image.id,
          similarity: m.similarity,
          description: m.matchedDescription
        }))
      );

      const matches = imageMatches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, count);

      await new Promise(resolve => setTimeout(resolve, 3000));

      for (const match of matches) {
        const image = match.image;
        
        image.matched = true;
        image.matchedWord = word;
        image.similarity = match.similarity;
        
        // If it matched with a default description, store it
        if (match.isDefaultDescription) {
          image.defaultDescription = match.matchedDescription;
          image.matchedTag = undefined;
        } else {
          image.matchedTag = match.matchedTag || undefined;
          image.defaultDescription = undefined;
        }

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
    } catch (error) {
      console.error('Error processing guess:', error);
      io.to(roomId).emit('guess-end');
    }
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});