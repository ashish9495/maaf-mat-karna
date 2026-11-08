import { SaveManager } from './SaveManager';
import { AudioManager } from './AudioManager';
import { toast } from '../ui/dom';

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hidden?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'chappal-queen', name: 'Chappal Queen', icon: '👑', desc: 'Land ten hits in one chase.' },
  { id: 'champion', name: 'Certified Chappal Champion', icon: '🏆', desc: 'Land a 5-hit combo.' },
  { id: 'bully', name: 'Professional Bully', icon: '😈', desc: 'Use every weapon in one chase.' },
  { id: 'no-break', name: "Can't Catch a Break", icon: '🍌', desc: 'Make Baby stumble three times.' },
  { id: 'mumma-wins', name: 'Mumma Wins', icon: '🎉', desc: 'Complete the chase.' },
  { id: 'soft-heart', name: 'Soft Heart', icon: '💗', desc: 'Choose the forgiveness ending.' },
  { id: 'still-angry', name: 'Still Angry', icon: '😤', desc: 'Choose the playful revenge ending.' },
  { id: 'butterfingers', name: 'Butterfingers', icon: '🙈', desc: 'Miss eight shots in a row.', hidden: true },
  { id: 'secret', name: 'Secret Keeper', icon: '💛', desc: 'Find the hidden golden heart.', hidden: true },
  { id: 'hide-seek', name: 'Hide & Seek Champion', icon: '🔎', desc: 'Find Baby while he hides.', hidden: true },
  { id: 'heart-tap', name: 'Heart Overflow', icon: '💞', desc: 'Tap the heart 10 times.', hidden: true },
];

export function unlockAchievement(id: string) {
  if (SaveManager.hasAchievement(id)) return false;
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return false;
  SaveManager.progress.achievements.push(id);
  SaveManager.saveProgress();
  AudioManager.sfx('achievement');
  toast(`<span class="toast-icon">${def.icon}</span><div><small>ACHIEVEMENT UNLOCKED</small><b>${def.name}</b></div>`, 'toast-ach', 3600);
  return true;
}
