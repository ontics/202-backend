import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface StoredDescription {
  imageUrl: string;
  descriptions: string[];
}

interface RoomDescriptions {
  [imageUrl: string]: string[];
}

interface DescriptionStore {
  [roomId: string]: RoomDescriptions;
}

class ImageDescriptionStore {
  private storePath: string;
  private descriptions: DescriptionStore;
  private defaultDescriptions: { [imageUrl: string]: string } = {};

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    this.storePath = path.join(__dirname, 'imageDescriptions.json');
    this.descriptions = {};
  }

  addDescription(roomId: string, imageUrl: string, description: string) {
    if (!this.descriptions[roomId]) {
      this.descriptions[roomId] = {};
    }
    if (!this.descriptions[roomId][imageUrl]) {
      this.descriptions[roomId][imageUrl] = [];
    }
    if (!this.descriptions[roomId][imageUrl].includes(description)) {
      this.descriptions[roomId][imageUrl].push(description);
    }
  }

  getDescriptions(roomId: string, imageUrl: string, excludeDescriptions: string[] = []): string[] {
    const roomDescriptions = this.descriptions[roomId]?.[imageUrl] || [];
    const filteredDescriptions = roomDescriptions.filter(desc => !excludeDescriptions.includes(desc));
    
    // If no descriptions exist for this image in this room, return the default description
    if (filteredDescriptions.length === 0 && this.defaultDescriptions[imageUrl]) {
      return [this.defaultDescriptions[imageUrl]];
    }
    
    return filteredDescriptions;
  }

  clearRoomDescriptions(roomId: string) {
    delete this.descriptions[roomId];
  }

  setDefaultDescription(imageUrl: string, description: string) {
    this.defaultDescriptions[imageUrl] = description;
  }

  getDefaultDescription(imageUrl: string): string | undefined {
    return this.defaultDescriptions[imageUrl];
  }
}

export const descriptionStore = new ImageDescriptionStore(); 