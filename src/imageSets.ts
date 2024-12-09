export interface ImageInfo {
  url: string;
  defaultDescription: string;
}

function processImageUrl(url: string): string {
  return `${url}?auto=format&fit=crop&w=400&h=300&q=80`;
}

export const IMAGE_SETS = {
  nature: [
    {
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      defaultDescription: 'mountains and lake with reflection'
    },
    {
      url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
      defaultDescription: 'hiker on top of a mountain range'
    },
    {
      url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff',
      defaultDescription: 'cliffside in yosemite national park'
    },
    {
      url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
      defaultDescription: 'firepit in the mountains overlooking the sunset over the water'
    },
    {
      url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05',
      defaultDescription: 'fog rolling over the Scottish Highlands'
    }
  ].map(info => ({
    ...info,
    url: processImageUrl(info.url)
  })),
  
  urban: [
    {
      url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000',
      defaultDescription: 'pedestrian crossing in New York City with yellow cabs'
    },
    {
      url: 'https://images.unsplash.com/photo-1444723121867-7a241cacace9',
      defaultDescription: 'night skyline of downtown Los Angeles'
    },
    {
      url: 'https://images.unsplash.com/photo-1460472178825-e5240623afd5',
      defaultDescription: 'Boston skyline with skyscrapers under a grey sky'
    },
    {
      url: 'https://images.unsplash.com/photo-1465447142348-e9952c393450',
      defaultDescription: 'complex highway interchange amidst city buildings and parks'
    }
  ].map(info => ({
    ...info,
    url: processImageUrl(info.url)
  })),

  landmarks: [
    {
      url: 'https://images.unsplash.com/photo-1722028848725-9b9a95518c8f',
      defaultDescription: 'statue of liberty against blue sky'
    },
    {
      url: 'https://images.unsplash.com/photo-1579463870606-64fcb6423feb',
      defaultDescription: 'cloud gate bean sculpture in chicago'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1697729441569-f706fdd1f71c',
      defaultDescription: 'taj mahal with reflection pools'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1661914240950-b0124f20a5c1',
      defaultDescription: 'tokyo tower lit up at night with mount fuji in the background'
    },
    {
      url: 'https://images.unsplash.com/photo-1723946373346-555e307602c3',
      defaultDescription: 'inside the roman colosseum'
    },
    {
      url: 'https://images.unsplash.com/photo-1707621724113-2d05615e50ef',
      defaultDescription: 'christ the redeemer statue in rio'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1664304492320-8359efcaad38',
      defaultDescription: 'great wall of china winding through mountains'
    },
    {
      url: 'https://images.unsplash.com/photo-1535399475061-ad1dca038c26',
      defaultDescription: 'louvre pyramid at sunset'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1673266633864-4cfdcf42eb9c',
      defaultDescription: 'golden gate bridge in fog'
    }
  ].map(info => ({
    ...info,
    url: processImageUrl(info.url)
  })),

  playtest: [
    {
      url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      defaultDescription: 'mountains reflecting in a lake'
    },
    {
      url: 'https://images.unsplash.com/photo-1682686581498-5e85c7228119',
      defaultDescription: 'scuba diver underwater'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1664304492320-8359efcaad38',
      defaultDescription: 'great wall of china stretching across mountains'
    },
    {
      url: 'https://images.unsplash.com/photo-1454179083322-198bb4daae41',
      defaultDescription: 'three cows with tagged ears'
    },
    {
      url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
      defaultDescription: 'firepit in the mountains overlooking the sunset over the water'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1668146927669-f2edf6e86f6f',
      defaultDescription: 'plate of sushi rolls'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1697729441569-f706fdd1f71c',
      defaultDescription: 'taj mahal with reflection pool'
    },
    {
      url: 'https://images.unsplash.com/photo-1722028848725-9b9a95518c8f',
      defaultDescription: 'statue of liberty'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1673266633864-4cfdcf42eb9c',
      defaultDescription: 'golden gate bridge at sunset'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1661922380380-e214c7130cad',
      defaultDescription: 'yellow taxi on brooklyn bridge'
    },
    {
      url: 'https://images.unsplash.com/photo-1551415923-a2297c7fda79',
      defaultDescription: 'penguins on ice in antarctica'
    },
    {
      url: 'https://images.unsplash.com/photo-1579463870606-64fcb6423feb',
      defaultDescription: 'the bean sculpture in chicago'
    },
    {
      url: 'https://images.unsplash.com/photo-1669655139688-72e3cd7a8d9c',
      defaultDescription: 'beans on toast'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1730833407702-253d157ffd7a',
      defaultDescription: 'three cups of tea being poured'
    },
    {
      url: 'https://images.unsplash.com/photo-1601055653962-b77991d1c2b5',
      defaultDescription: 'sea lions lounging on pier 39'
    }
  ].map(info => ({
    ...info,
    url: processImageUrl(info.url)
  })),
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function getRandomImageSet(): ImageInfo[] {
  // Get all available sets
  const setNames = Object.keys(IMAGE_SETS) as (keyof typeof IMAGE_SETS)[];
  
  // Randomly select between 3 and 5 sets
  const numSets = getRandomInt(3, 5);
  const selectedSets = shuffleArray(setNames).slice(0, numSets);
  
  // Calculate how many images to take from each set
  const totalImages = 15;
  const imagesPerSet = Math.floor(totalImages / numSets);
  const remainder = totalImages % numSets;
  
  let selectedImages: ImageInfo[] = [];
  
  selectedSets.forEach((setName, index) => {
    const set = IMAGE_SETS[setName];
    // Add extra image from remainder if needed
    const numImages = imagesPerSet + (index < remainder ? 1 : 0);
    const shuffledSet = shuffleArray(set);
    selectedImages = selectedImages.concat(shuffledSet.slice(0, numImages));
  });
  
  return shuffleArray(selectedImages);
}

// Use this instead of ACTIVE_IMAGE_SET
export function getGameImages(): ImageInfo[] {
  return getRandomImageSet();
}