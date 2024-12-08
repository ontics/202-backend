import { 
  ExpressRequest, 
  ExpressResponse, 
  SocketType, 
  GameImage, 
  Player, 
  Team,
  Query,
  SwitchTeamData
} from './types';
import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import { nanoid } from 'nanoid';
import cors from 'cors';
import axios from 'axios';
import { descriptionStore } from './imageDescriptions.js';
import { ACTIVE_IMAGE_SET } from './imageSets.js';

const app = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const SIMILARITY_SERVICE_URL = process.env.SIMILARITY_SERVICE_URL || "http://127.0.0.1:5000";
const WARMUP_INTERVAL = 14 * 60 * 1000; // 14 minutes in milliseconds

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

app.get('/', (_req: Request, res: ExpressResponse) => {
  res.status(200).json({ message: 'Server is running' });
});

// In-memory store (replace with a database in production)
const rooms = new Map();

// Replace SAMPLE_IMAGES with ACTIVE_IMAGE_SET in your room creation code

// Add export to make the interface available to other files
export interface Player {
  id: string;
  nickname: string;
  team: Team;
  role: PlayerRole;
  isRoomAdmin: boolean;
  roomId: string;
}

type Team = 'green' | 'purple';
type PlayerRole = 'codebreaker' | 'tagger';

// REST endpoints
interface TestGameplayQuery extends Query {
  word?: string;
  description?: string;
  model?: 'use' | 'sbert';
}

interface SimilarityApiResponse {
  similarity: number;
  model: 'use' | 'sbert';
}

interface RoomResponse {
  roomId: string;
}

interface GameStats {
  correctGuesses: number;
  incorrectGuesses: number;
  totalSimilarity: number;
}

interface Room {
  id: string;
  players: Player[];
  phase: 'lobby' | 'playing' | 'round-end';
  images: GameImage[];
  currentTurn: Team;
  timeRemaining: number;
  winner: Team | null;
  gameStats: {
    green: GameStats;
    purple: GameStats;
  };
}

interface GameImage {
  id: string;
  url: string;
  tags: Tag[];
  team?: string;
  selected?: boolean;
  matched?: boolean;
  matchedWord?: string;
  matchedTag?: Tag;
}

interface Tag {
  text: string;
  playerId: string;
  playerNickname: string;
}

async function warmupSimilarityService() {
  try {
    const response = await axios.get(`${SIMILARITY_SERVICE_URL}/health`);
    if (response.status === 200) {
      console.log(`Similarity service warmed up at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error('Error warming up similarity service:', error);
  }
}

app.post('/api/rooms', async (req: Request, res: Response) => {
  await warmupSimilarityService();
  
  const roomId = nanoid(6);
  
  rooms.set(roomId, {
    id: roomId,
    players: [],
    phase: 'lobby',
    images: ACTIVE_IMAGE_SET.map(url => ({
      id: nanoid(),
      url,
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
  });
  res.status(200).json({ roomId });
});

app.get('/api/rooms/:roomId', (req: ExpressRequest<{ params: { roomId: string } }>, res: ExpressResponse) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room);
});

app.get('/api/test-gameplay', (async (
  req: Request,
  res: Response
) => {
    const { word, description, model = 'use' } = req.query as TestGameplayQuery;
    
    if (!word || !description) {
      res.status(400).json({ 
        error: 'Please provide both word and description parameters' 
      });
      return;
    }

    const startTime = Date.now();
    
    try {
      // Type the response
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
}) as RequestHandler);

// Add this endpoint after your existing routes
app.post('/api/clear-descriptions', (_req, res) => {
  try {
    descriptionStore.clearAllDescriptions();
    res.status(200).json({ message: 'All descriptions cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear descriptions' });
  }
});

// Add this near your other endpoints
if (process.env.NODE_ENV === 'development') {
  app.post('/api/dev/skip-to-phase', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Development only endpoint' });
    }
    
    const { roomId, phase } = req.body;
    const room = rooms.get(roomId);
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.phase = phase;
    room.timeRemaining = 90; // Reset timer
    io.to(roomId).emit('room-updated', room);
    res.json({ success: true });
  });
}

// Add this function at the top
const checkWinCondition = (room) => {
  const greenUnmatched = room.images.filter(img => !img.matched && img.team === 'green');
  const purpleUnmatched = room.images.filter(img => !img.matched && img.team === 'purple');
  
  if (greenUnmatched.length === 0) {
    room.winner = 'green';
    room.phase = 'gameOver';
    // Don't reset any image states
    return true;
  }
  if (purpleUnmatched.length === 0) {
    room.winner = 'purple';
    room.phase = 'gameOver';
    // Don't reset any image states
    return true;
  }
  return false;
}

// Socket.IO events
io.on('connection', (socket: SocketType) => {
  let currentPlayer: Player | null = null;

  socket.on('join-room', ({ roomId, player }) => {
    console.log('Player joining room:', { roomId, player });
    const room = rooms.get(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      return;
    }

    // If player object is provided, use it
    if (player) {
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
    }
    
    socket.join(roomId);
    
    // Send current game state to the joining player
    socket.emit('game-state', room);
    io.to(roomId).emit('room-updated', room);
  });

  // Add disconnect handler
  socket.on('disconnect', () => {
    if (currentPlayer) {
      const room = rooms.get(currentPlayer.roomId);
      if (room) {
        room.players = room.players.filter((p: Player) => p.id !== currentPlayer?.id);
        io.to(currentPlayer.roomId).emit('room-updated', room);
      }
    }
  });

  socket.on('switch-team', ({ roomId, playerId, newTeam }: SwitchTeamData) => {
    console.log(`Received switch-team event:`, { roomId, playerId, newTeam });
    
    const room = rooms.get(roomId);
    if (!room) {
      console.log('Room not found:', roomId);
      return;
    }

    console.log('Before switch - Players:', room.players);
    
    room.players = room.players.map((p: Player) =>
      p.id === playerId ? { ...p, team: newTeam } : p
    );
    
    console.log('After switch - Players:', room.players);
    
    io.to(roomId).emit('room-updated', room);
    console.log('Emitted room-updated event');
  });

  // Game Flow Control
  socket.on('start-game', (roomId: string) => {
    console.log('Received start-game event for room:', roomId);
    const room = rooms.get(roomId);
    if (room) {
      // Create array of exactly 15 images
      const images = ACTIVE_IMAGE_SET.slice(0, 15).map(url => ({
        id: nanoid(),
        url,
        team: 'unassigned' as Team | 'red',
        tags: [],
        selected: false,
        matched: false,
        matchedWord: '',
        similarity: 0
      }));

      // Create array of indices and shuffle
      const indices = Array.from({length: 15}, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Assign teams and log counts
      let greenCount = 0, purpleCount = 0, redCount = 0;

      // Assign teams
      for (let i = 0; i < 7; i++) {
        images[indices[i]].team = 'green';
        greenCount++;
      }
      for (let i = 7; i < 14; i++) {
        images[indices[i]].team = 'purple';
        purpleCount++;
      }
      images[indices[14]].team = 'red';
      redCount++;

      console.log(`Team distribution - Green: ${greenCount}, Purple: ${purpleCount}, Red: ${redCount}`);

      room.images = images;
      room.phase = 'playing';
      room.timeRemaining = 120;
      room.currentTurn = 'green';
      room.winner = null;

      io.to(roomId).emit('game-started', roomId);
      io.to(roomId).emit('room-updated', room);
    }
  });

  // Tagging Phase
  socket.on('submit-tag', async ({ 
    roomId, 
    playerId, 
    imageId, 
    tag 
  }: {
    roomId: string;
    playerId: string;
    imageId: string;
    tag: string;
  }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    
    const image = room.images.find((img: GameImage) => img.id === imageId);
    if (image) {
      // Add the new tag
      image.tags.push({ text: tag, playerId });
      
      // Only emit the updated image
      io.to(roomId).emit('image-updated', {
        roomId,
        imageId,
        image
      });
    }
  });

  // Guessing Phase
  socket.on('select-image', ({ roomId, playerId, imageId }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    
    const image = room.images.find((img: GameImage) => img.id === imageId);
    if (image) {
      image.selected = true;
      // Check if this was correct selection
      if (image.team === room.currentTurn) {
        image.matched = true;
        // Check for win condition
      }
      // Switch turns
      room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
    }
    io.to(roomId).emit('room-updated', room);
  });

  // Helper function to store descriptions from images
  const storeDescriptionsFromImages = (images: GameImage[], roomId: string) => {
    console.log('Storing descriptions for room:', roomId);
    images.forEach((image: GameImage) => {
      if (image.tags && image.tags.length > 0) {
        image.tags.forEach((tag: Tag) => {
          console.log('Storing description:', tag.text, 'for image:', image.url);
          descriptionStore.addDescription(image.url, tag.text);
        });
      }
    });
  };

  // Phase change handler
  socket.on('phase-change', ({ roomId, phase, images, skipToPhase, timerExpired }: { 
    roomId: string;
    phase: string;
    images?: GameImage[];
    skipToPhase?: boolean;
    timerExpired?: boolean;
  }) => {
    console.log('Phase change:', { roomId, phase, skipToPhase, timerExpired });
    const room = rooms.get(roomId);
    if (!room) return;

    // If transitioning from playing to guessing, store all current descriptions
    if (phase === 'guessing' && (room.phase === 'playing' || room.phase === 'lobby')) {
      // Store descriptions from both current room state and any new images
      storeDescriptionsFromImages(room.images, roomId);
      if (images) {
        storeDescriptionsFromImages(images, roomId);
      }
    }

    // Update room state
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

  // Timer expired handler
  socket.on('timer-expired', ({ roomId, images }) => {
    console.log('Timer expired for room:', roomId);
    const room = rooms.get(roomId);
    if (!room) return;

    // Store all current descriptions
    storeDescriptionsFromImages(room.images, roomId);
    
    // Update room phase and reset timer
    room.phase = 'guessing';
    room.timeRemaining = 60;
    room.currentTurn = 'green';
    
    // Mark all images as not selected for the guessing phase
    room.images = room.images.map(img => ({
      ...img,
      selected: false
    }));

    // Save and broadcast the updated room state
    rooms.set(roomId, room);
    io.to(roomId).emit('room-updated', room);
  });

  // Timer update handler
  socket.on('timer-update', ({ roomId, timeRemaining }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.timeRemaining = timeRemaining;
    io.to(roomId).emit('room-updated', room);
  });

  // Role Switching
  socket.on('switch-role', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    room.players = room.players.map((p: Player) =>
      p.id === playerId 
        ? { ...p, role: p.role === 'tagger' ? 'codebreaker' : 'tagger' }
        : p
    );
    io.to(roomId).emit('room-updated', room);
  });

  // Game Reset
  socket.on('reset-game', ({ roomId }) => {
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
      matched: false,
      matchedWord: '',
      similarity: 0
    }));
    io.to(roomId).emit('room-updated', room);
  });

  // Add tag handler
  socket.on('add-tag', ({ roomId, imageId, tag, playerId, playerNickname }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const image = room.images.find((img: GameImage) => img.id === imageId);
    if (image) {
      // Remove any existing tag from this player
      image.tags = image.tags.filter((t: Tag) => t.playerId !== playerId);
      
      // Add the new tag
      image.tags.push({ text: tag, playerId, playerNickname });
      
      // Save the room state
      rooms.set(roomId, room);

      // During playing phase, only send the player's own tags back
      if (room.phase === 'playing') {
        socket.emit('image-updated', {
          roomId,
          imageId,
          image: {
            ...image,
            tags: image.tags.filter((t: Tag) => t.playerId === playerId)
          }
        });
      } else {
        // In other phases, broadcast the full image state to everyone
        io.to(roomId).emit('image-updated', {
          roomId,
          imageId,
          image
        });
      }
    }
  });

  // Update the submitGuess handler
  socket.on('submit-guess', async ({ roomId, playerId, word, count }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const currentPlayer = room.players.find(p => p.id === playerId);
    if (!currentPlayer || currentPlayer.team !== room.currentTurn) return;

    // Get matches sorted by similarity
    const imageMatches = await Promise.all(
      room.images
        .filter(img => !img.matched)
        .map(async (img) => {
          const playerTags = img.tags.map(t => t.text);
          const storedDescriptions = descriptionStore.getDescriptions(img.url, playerTags);
          const allDescriptions = [...playerTags, ...storedDescriptions];

          let maxSimilarity = 0;
          let bestDescription = '';
          let bestTag = null;

          for (const desc of allDescriptions) {
            try {
              const response = await axios.post(`${SIMILARITY_SERVICE_URL}/compare`, {
                word: word.toLowerCase(),
                description: desc.toLowerCase(),
                model: 'sbert'
              });
              
              if (response.data.similarity > maxSimilarity) {
                maxSimilarity = response.data.similarity;
                bestDescription = desc;
                // Find the tag object that matches this description
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

    // Sort matches by similarity
    const matches = imageMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, count);

    // Emit guess start to trigger buffering animation for ALL players
    io.to(roomId).emit('guess-start');

    // Wait 3 seconds before starting reveals
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Process matches one by one with delays
    for (const match of matches) {
      const image = match.image;
      
      // Update image state
      image.matched = true;
      image.matchedWord = word;
      image.similarity = match.similarity;
      image.matchedTag = match.matchedTag;

      // Send update for this match
      io.to(roomId).emit('room-updated', room);

      // If assassin is matched, end game after animation
      if (image.team === 'red') {
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.phase = 'gameOver';
        room.winner = room.currentTurn === 'green' ? 'purple' : 'green';
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      // If wrong team's image is matched, switch turns and stop processing
      if (image.team !== room.currentTurn) {
        room.gameStats[room.currentTurn].incorrectGuesses++;
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      // Update stats for correct match
      room.gameStats[room.currentTurn].correctGuesses++;
      room.gameStats[room.currentTurn].totalSimilarity += match.similarity;

      // Check for win condition after each match
      const unmatched = room.images.filter(img => !img.matched && img.team === room.currentTurn);
      if (unmatched.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        room.phase = 'gameOver';
        room.winner = room.currentTurn;
        io.to(roomId).emit('room-updated', room);
        io.to(roomId).emit('guess-end');
        return;
      }

      // Wait before revealing next match
      await new Promise(resolve => setTimeout(resolve, 3500));
    }

    // Switch turns after successful guesses if game isn't over
    if (room.phase !== 'gameOver') {
      room.currentTurn = room.currentTurn === 'green' ? 'purple' : 'green';
      io.to(roomId).emit('room-updated', room);
    }
    io.to(roomId).emit('guess-end');
  });

  socket.on('set-role', ({ roomId, playerId, role }) => {
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