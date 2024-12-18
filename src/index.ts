import express, { Request, Response, RequestHandler } from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { nanoid } from 'nanoid';
import cors from 'cors';
import axios from 'axios';
import { descriptionStore } from './imageDescriptions.js';
import { getGameImages, type ImageInfo } from './imageSets.js';
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

// Helper function for shuffling arrays
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const app = express();
const server = createServer(app);
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
      timeout: 5000  // Reduced timeout for local development
    });
    console.log(`[${new Date().toISOString()}] Similarity service health check response:`, response.data);
    
    if (response.data.status !== 'healthy' || response.data.model_status !== 'loaded') {
      console.log(`[${new Date().toISOString()}] Service not ready yet, status:`, response.data);
      return false;
    }
    
    // Test the similarity service with a shorter timeout for local development
    const testResponse = await axios.post(`${SIMILARITY_SERVICE_URL}/compare`, {
      word: "test",
      description: "test",
      model: "sbert"
    }, { 
      timeout: 10000  // Reduced timeout for local development
    });
    console.log(`[${new Date().toISOString()}] Similarity service test comparison response:`, testResponse.data);
    
    similarityServiceReady = true;
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
    similarityServiceReady = false;
    return false;
  }
}

// Initial warmup
warmupSimilarityService();

// Periodic warmup every 30 seconds for local development, 10 minutes for production
const warmupInterval = process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 30 * 1000;
setInterval(warmupSimilarityService, warmupInterval);

async function getSimilarityBatch(comparisons: { word: string, description: string }[]) {
  // If service isn't ready, try to warm it up first
  if (!similarityServiceReady) {
    await warmupSimilarityService();
  }

  try {
    console.log(`[${new Date().toISOString()}] Calculating batch similarity for ${comparisons.length} pairs`);
    const response = await axios.post(`${SIMILARITY_SERVICE_URL}/compare-batch`, comparisons, {
      timeout: 60000  // Increase timeout to 60 seconds
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
      // Instead of fallback, throw error to trigger retry
      throw error;
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

app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check if similarity service is ready
    if (!similarityServiceReady) {
      await warmupSimilarityService();
    }
    
    res.json({ 
      status: similarityServiceReady ? 'ok' : 'initializing',
      similarity_service: similarityServiceReady ? 'ready' : 'not_ready'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.json({ 
      status: 'error',
      similarity_service: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create room endpoint
app.post('/api/rooms', async (_req: Request, res: Response) => {
  console.log(`[${new Date().toISOString()}] Attempting to create room`);
  try {
    // Try to warm up similarity service but don't wait for the result
    warmupSimilarityService().catch(console.error);
    
    const roomId = nanoid(6);
    console.log(`[${new Date().toISOString()}] Generated room ID:`, roomId);
    
    const initialImages = getGameImages().map((imageInfo: ImageInfo) => ({
      id: nanoid(),
      url: imageInfo.url,
      team: Math.random() < 0.5 ? 'green' as Team : 'purple' as Team,
      tags: [],
      selected: false,
      matched: false,
      matchedWord: '',
      similarity: 0
    }));

    rooms.set(roomId, {
      id: roomId,
      roomId,
      players: [],
      phase: 'lobby',
      images: initialImages,
      currentTurn: 'green',
      timeRemaining: 60,
      winner: null,
      gameStats: {
        green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
        purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
      }
    });

    // Set default descriptions for each image
    initialImages.forEach((image: GameImage) => {
      const imageInfo = getGameImages().find((info: ImageInfo) => info.url === image.url);
      if (imageInfo?.defaultDescription) {
        descriptionStore.setDefaultDescription(image.url, imageInfo.defaultDescription);
      }
    });

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

      // Check if this is the first player of their team
      const teamPlayers = room.players.filter(p => p.team === player.team);
      if (teamPlayers.length === 0) {
        // If first player of team, make them codebreaker
        player.role = 'codebreaker';
      } else {
        // Otherwise, they're a tagger by default
        player.role = 'tagger';
      }

      room.players.push(player);
    } else {
      // Update existing player data but preserve role and admin status
      room.players[existingPlayerIndex] = {
        ...room.players[existingPlayerIndex],
        ...player,
        role: room.players[existingPlayerIndex].role,
        isRoomAdmin: room.players[existingPlayerIndex].isRoomAdmin
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

    try {
      // Start warming up the service but don't wait for it
      warmupSimilarityService().catch(console.error);

      // Get random selection of images from multiple sets
      const selectedImageInfos = getGameImages();
      
      // Safety check: ensure we have exactly 15 images
      if (selectedImageInfos.length !== 15) {
        console.error(`[${new Date().toISOString()}] Error: Got ${selectedImageInfos.length} images instead of 15`);
        io.to(roomId).emit('game-error', 'Unable to initialize game images. Please try again.');
        return;
      }

      // Initialize game images with IDs first
      const gameImages = selectedImageInfos.map((imageInfo: ImageInfo) => ({
        id: nanoid(),
        url: imageInfo.url,
        team: 'unassigned' as Team | 'red',
        tags: [],
        selected: false,
        matched: false,
        matchedWord: '',
        similarity: 0
      }));

      // Create a copy of the array for shuffling
      const shuffledImages = shuffleArray([...gameImages]);

      // Create an array of team assignments and shuffle it
      const teamAssignments = [
        ...Array(7).fill('green' as Team),
        ...Array(7).fill('purple' as Team),
        'red' as Team
      ];
      const shuffledTeams = shuffleArray(teamAssignments);

      // Assign shuffled teams to images
      shuffledImages.forEach((image, index) => {
        image.team = shuffledTeams[index];
      });

      // Set default descriptions
      selectedImageInfos.forEach((imageInfo: ImageInfo) => {
        if (imageInfo.defaultDescription) {
          descriptionStore.setDefaultDescription(imageInfo.url, imageInfo.defaultDescription);
        }
      });

      // Final safety check: ensure all images have teams assigned
      const unassignedImages = shuffledImages.filter(img => !['red', 'green', 'purple'].includes(img.team as string));
      if (unassignedImages.length > 0) {
        console.error(`[${new Date().toISOString()}] Error: ${unassignedImages.length} images remain unassigned`);
        io.to(roomId).emit('game-error', 'Error assigning teams to images. Please try again.');
        return;
      }

      // Update room state
      room.images = shuffledImages;
      room.phase = 'playing';
      room.timeRemaining = 120;
      room.currentTurn = 'green';
      room.winner = null;
      room.gameStats = {
        green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
        purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
      };

      // Notify clients
      io.to(roomId).emit('game-started', roomId);
      io.to(roomId).emit('room-updated', room);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error starting game:`, error);
      
      // Reset room state on error
      room.phase = 'lobby';
      room.timeRemaining = 120;
      room.images = [];
      
      io.to(roomId).emit('game-error', 'Failed to start game. Please try again.');
      io.to(roomId).emit('room-updated', room);
    }
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

    const newImages = getGameImages().map((imageInfo: ImageInfo) => ({
      id: nanoid(),
      url: imageInfo.url,
      team: Math.random() < 0.5 ? 'green' as Team : 'purple' as Team,
      tags: [],
      selected: false,
      matched: false,
      matchedWord: '',
      similarity: 0
    }));

    room.images = newImages;
    room.gameStats = {
      green: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 },
      purple: { correctGuesses: 0, incorrectGuesses: 0, totalSimilarity: 0 }
    };

    // Re-set default descriptions
    newImages.forEach((image: GameImage) => {
      const imageInfo = getGameImages().find((info: ImageInfo) => info.url === image.url);
      if (imageInfo?.defaultDescription) {
        descriptionStore.setDefaultDescription(image.url, imageInfo.defaultDescription);
      }
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
    // Check if player is the codebreaker for their team
    if (!currentPlayer || 
        currentPlayer.team !== room.currentTurn || 
        currentPlayer.role !== 'codebreaker') return;

    const unmatchedImages = room.images.filter(img => !img.matched);
    const comparisons = [];
    const imageDescriptionCounts = new Map<string, number>();

    // First pass: collect all comparisons and count descriptions per image
    for (const img of unmatchedImages) {
      const playerTags = img.tags.map(t => t.text);
      // If there are player tags, use those. Otherwise use default description
      const descriptions = playerTags.length > 0 
        ? playerTags 
        : [descriptionStore.getDefaultDescription(img.url)].filter(Boolean) as string[];
      
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

      // Calculate similarities
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

      // Enforce minimum buffering time (2 cycles of the animation)
      const BUFFER_CYCLE_TIME = 3000; // 3 seconds per cycle
      const MIN_CYCLES = 2;
      const timeSinceStart = Date.now();
      const minBufferTime = MIN_CYCLES * BUFFER_CYCLE_TIME;
      const remainingBuffer = minBufferTime - (Date.now() - timeSinceStart);
      
      if (remainingBuffer > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingBuffer));
      }

      // Signal that we're about to start revealing matches
      io.to(roomId).emit('match-reveal');

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

        // Check if either team has won
        const greenTeamImages = room.images.filter(img => img.team === 'green');
        const purpleTeamImages = room.images.filter(img => img.team === 'purple');
        const greenTeamCleared = greenTeamImages.every(img => img.matched);
        const purpleTeamCleared = purpleTeamImages.every(img => img.matched);

        if (greenTeamCleared || purpleTeamCleared) {
          await new Promise(resolve => setTimeout(resolve, 3500));
          room.phase = 'gameOver';
          room.winner = greenTeamCleared ? 'green' : 'purple';
          io.to(roomId).emit('room-updated', room);
          io.to(roomId).emit('guess-end');
          return;
        }

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

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});