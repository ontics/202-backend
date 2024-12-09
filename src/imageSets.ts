interface ImageInfo {
  url: string;
  defaultDescription: string;
}

function processImageUrl(url: string): string {
  return `${url}?auto=format&fit=crop&w=400&h=300&q=80`;
}

export const IMAGE_SETS = {
  nature: [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
    'https://images.unsplash.com/photo-1426604966848-d7adac402bff',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05',
  ].map(url => `${url}?auto=format&fit=crop&w=400&h=300&q=80`),
  
  urban: [
    'https://images.unsplash.com/photo-1449824913935-59a10b8d2000',
    'https://images.unsplash.com/photo-1444723121867-7a241cacace9',
    'https://images.unsplash.com/photo-1460472178825-e5240623afd5',
    'https://images.unsplash.com/photo-1465447142348-e9952c393450',
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327',
  ].map(url => `${url}?auto=format&fit=crop&w=400&h=300&q=80`),

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
      defaultDescription: 'cows grazing in a field'
    },
    {
      url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
      defaultDescription: 'campfire at night'
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

  landmarks: [
    'https://images.unsplash.com/photo-1722028848725-9b9a95518c8f', // Statue of Liberty
    'https://images.unsplash.com/photo-1579463870606-64fcb6423feb', // The Bean
    'https://plus.unsplash.com/premium_photo-1697729441569-f706fdd1f71c', // Taj Mahal
    'https://images.unsplash.com/photo-1716220902614-cbe6d1d9af09', // Tokyo Tower
    'https://images.unsplash.com/photo-1723946373346-555e307602c3', // Colosseum Interior
    'https://images.unsplash.com/photo-1707621724113-2d05615e50ef', // Christ the Redeemer
    'https://plus.unsplash.com/premium_photo-1664304492320-8359efcaad38', // Great Wall of China
    'https://images.unsplash.com/photo-1535399475061-ad1dca038c26', // The Louvre
    'https://plus.unsplash.com/premium_photo-1673266633864-4cfdcf42eb9c', // Golden Gate Bridge
  ].map(url => `${url}?auto=format&fit=crop&w=400&h=300&q=80`),
};

// Set this to the image set you want to use
export const ACTIVE_IMAGE_SET = IMAGE_SETS.playtest; 