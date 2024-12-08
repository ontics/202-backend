import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface StoredDescription {
  imageUrl: string;
  descriptions: string[];
}

interface DescriptionStore {
  [imageUrl: string]: string[];
}

class ImageDescriptionStore {
  private storePath: string;
  private descriptions: DescriptionStore;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    this.storePath = path.join(__dirname, 'imageDescriptions.json');
    this.descriptions = this.loadDescriptions();
  }

  private loadDescriptions(): DescriptionStore {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading descriptions:', error);
    }
    return {};
  }

  private saveDescriptions() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.descriptions, null, 2));
    } catch (error) {
      console.error('Error saving descriptions:', error);
    }
  }

  addDescription(imageUrl: string, description: string) {
    if (!this.descriptions[imageUrl]) {
      this.descriptions[imageUrl] = [];
    }
    if (!this.descriptions[imageUrl].includes(description)) {
      this.descriptions[imageUrl].push(description);
      this.saveDescriptions();
    }
  }

  getDescriptions(imageUrl: string, excludeDescriptions: string[] = []): string[] {
    const descriptions = this.descriptions[imageUrl] || [];
    return descriptions.filter(desc => !excludeDescriptions.includes(desc));
  }

  clearAllDescriptions() {
    this.descriptions = {};
    this.saveDescriptions();
  }
}

export const descriptionStore = new ImageDescriptionStore(); 