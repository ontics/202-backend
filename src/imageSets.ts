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

  transport: [
    {
      url: 'https://images.unsplash.com/photo-1687973692549-cdabe636547f',
      defaultDescription: 'cowboy on horseback in the sandy desert plains'
    },
    {
      url: 'https://images.unsplash.com/photo-1518123417771-4a83068af6e3',
      defaultDescription: 'a man landing his skateboard off a handrail beside a concrete staircase'
    },
    {
      url: 'https://images.unsplash.com/photo-1559845865-5c82500c0f5a',
      defaultDescription: 'the london eye ferris wheel under a dark cloudy sky'
    },
    {
      url: 'https://images.unsplash.com/photo-1493673155827-a7617e74a0ca',
      defaultDescription: 'two pilots in a small airplane cockpit flying over a city visible through the windshield'
    },
    {
      url: 'https://images.unsplash.com/photo-1652090379496-4219a00c8ebf',
      defaultDescription: 'an italian formula 1 racecar on the track'
    },
    {
      url: 'https://images.unsplash.com/photo-1527431293370-0cd188ca5d15',
      defaultDescription: 'a sailboat moored in the marina at sunset, tethered to a buoy'
    },
    {
      url: 'https://images.unsplash.com/photo-1442570468985-f63ed5de9086',
      defaultDescription: 'a train traveling along a curved railway bridge through a lush forest, with a smiling person leaning out the door'
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
    },
    {
      url: 'https://images.unsplash.com/photo-1599689444589-133726281155',
      defaultDescription: 'a pedestrian crossing in London with a wait signal'
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
      url: 'https://images.unsplash.com/photo-1539053447282-6f32f2bddfed',
      defaultDescription: 'taking a picture of christ the redeemer statue in Rio de Janeiro'
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

  misc2: [
    {
      url: 'https://images.unsplash.com/photo-1545672968-3ef43aceabe3',
      defaultDescription: 'a hand holding a single ticket into the Philadelphia Zoo'
    },
    {
      url: 'https://images.unsplash.com/photo-1485313260896-6e6edf486858',
      defaultDescription: 'a quarterback practicing a pass in a football field'
    },
    {
      url: 'https://images.unsplash.com/photo-1545262841-5283004cef19', // Backup: https://images.unsplash.com/photo-1631961890892-d8d24f0b6e04
      defaultDescription: 'a hand with a wristwatch pushing a lit screen with its index finger'
    }
  ],

  miscellaneous: [
    {
      url: 'https://images.unsplash.com/photo-1682686581498-5e85c7228119',
      defaultDescription: 'scuba diver underwater'
    },
    {
      url: 'https://images.unsplash.com/photo-1454179083322-198bb4daae41',
      defaultDescription: 'three cows with tagged ears'
    },
    {
      url: 'https://plus.unsplash.com/premium_photo-1668146927669-f2edf6e86f6f',
      defaultDescription: 'plate of sushi rolls'
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
  // Get all available sets that have enough images
  const setNames = Object.keys(IMAGE_SETS) as (keyof typeof IMAGE_SETS)[];
  const validSets = setNames.filter(setName => IMAGE_SETS[setName].length >= 5);
  
  if (validSets.length < 5) {
    console.error('Not enough valid image sets available');
    throw new Error('Not enough valid image sets available');
  }

  // Randomly choose between two strategies:
  // 1. 5 sets of 3 images each
  // 2. 3 sets of 5 images each
  const useFiveSets = Math.random() < 0.5;

  if (useFiveSets) {
    // Strategy 1: 5 sets of 3 images each
    const selectedSets = shuffleArray(validSets).slice(0, 5);
    let selectedImages: ImageInfo[] = [];

    selectedSets.forEach(setName => {
      const set = IMAGE_SETS[setName];
      const shuffledSet = shuffleArray(set);
      selectedImages = selectedImages.concat(shuffledSet.slice(0, 3));
    });

    return shuffleArray(selectedImages);
  } else {
    // Strategy 2: 3 sets of 5 images each
    const selectedSets = shuffleArray(validSets).slice(0, 3);
    let selectedImages: ImageInfo[] = [];

    selectedSets.forEach(setName => {
      const set = IMAGE_SETS[setName];
      const shuffledSet = shuffleArray(set);
      selectedImages = selectedImages.concat(shuffledSet.slice(0, 5));
    });

    return shuffleArray(selectedImages);
  }
}

// Use this instead of ACTIVE_IMAGE_SET
export function getGameImages(): ImageInfo[] {
  return getRandomImageSet();
}