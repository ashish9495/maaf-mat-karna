/**
 * MEMORY MONTAGE — 5 to 8 memory cards shown during the final cinematic.
 *
 * photo: path under /public (e.g. 'assets/memories/memory-3.jpg'). Leave '' for a placeholder.
 * date:  optional. Leave '' to hide. (No dates are filled in: add the real ones yourself.)
 * Edit the titles and captions freely — these are your words to her.
 */
export interface MemoryCard {
  photo: string;
  title: string;
  date: string;
  caption: string;
  /** decoration emoji shown on the polaroid corner */
  sticker: string;
}

export const memories: MemoryCard[] = [
  {
    photo: 'assets/memories/memory-1.jpg',
    title: 'Where everything started...',
    date: '',
    caption: 'Somewhere between ordinary days, you became my favorite part of life.',
    sticker: '🌸',
  },
  {
    photo: 'assets/memories/memory-2.jpg',
    title: 'My favorite happiness',
    date: '',
    caption: 'No matter how difficult a day gets, seeing you smile still means everything to me.',
    sticker: '😊',
  },
  {
    photo: 'assets/memories/memory-3.jpg',
    title: 'Every little thing',
    date: '',
    caption: "All the little things I've done came from wanting to see you happy.",
    sticker: '🎁',
  },
  {
    photo: 'assets/memories/memory-4.jpg',
    title: "Even when we're silly",
    date: '',
    caption: "We can be completely ridiculous sometimes, but you're still my favorite person.",
    sticker: '🤪',
  },
  {
    photo: 'assets/memories/memory-5.jpg',
    title: 'Every moment together',
    date: '',
    caption: "Every memory with you is another story I'd gladly live again.",
    sticker: '📸',
  },
  {
    photo: 'assets/memories/memory-6.jpg',
    title: 'The days ahead',
    date: '',
    caption:
      "I cannot promise I'll never make mistakes. But I can promise to keep learning, listening, and trying to love you better.",
    sticker: '🤞',
  },
  {
    photo: 'assets/memories/memory-7.jpg',
    title: 'You, always',
    date: '',
    caption: 'You are my comfort, my laughter, my favorite adventure, and my favorite person.',
    sticker: '💖',
  },
  {
    photo: 'assets/memories/memory-8.jpg',
    title: 'One last thing, Mumma...',
    date: '',
    caption: 'Even when I run away from your chappal, my heart will always find its way back to you.',
    sticker: '🩴',
  },
];
